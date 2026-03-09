const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../middleware/auth.middleware');

function appError(message, statusCode = 400) {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
}

function toMongoLikeId(value) {
	return String(value);
}

function generateRoomCode(length = 6) {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueRoomCode() {
	for (let index = 0; index < 8; index += 1) {
		const code = generateRoomCode();
		const existing = await prisma.room.findUnique({ where: { code } });
		if (!existing) {
			return code;
		}
	}

	throw appError('Unable to generate room code', 500);
}

// Live game state (in-memory) for spectator mode fallback.
// This is intentionally non-persistent; restarting the backend clears it.
const liveStateByRoom = new Map();

// Archived live state (in-memory) so teacher can still spectate the last known position
// for a short time after a player leaves/kicked. Non-persistent; backend restart clears it.
const archivedLiveStateByRoom = new Map();

// Completion metadata (in-memory) keyed by room and player.
// Used to return completion durations even though attempts only persist score + timestamp.
const completionMetaByRoom = new Map();

// Track kicked players (in-memory) so we can reject further live-state updates
// without hitting the database on every /api/game/state POST.
const kickedPlayersByRoom = new Map();

function getKickedRoomSet(roomId) {
	const key = Number(roomId);
	if (!kickedPlayersByRoom.has(key)) {
		kickedPlayersByRoom.set(key, new Set());
	}
	return kickedPlayersByRoom.get(key);
}

function getLiveRoomMap(roomId) {
	const key = Number(roomId);
	if (!liveStateByRoom.has(key)) {
		liveStateByRoom.set(key, new Map());
	}
	return liveStateByRoom.get(key);
}

function getArchivedRoomMap(roomId) {
	const key = Number(roomId);
	if (!archivedLiveStateByRoom.has(key)) {
		archivedLiveStateByRoom.set(key, new Map());
	}
	return archivedLiveStateByRoom.get(key);
}

function getCompletionMetaMap(roomId) {
	const key = Number(roomId);
	if (!completionMetaByRoom.has(key)) {
		completionMetaByRoom.set(key, new Map());
	}
	return completionMetaByRoom.get(key);
}

async function persistAttemptFromLiveState(roomId, playerId) {
	const rid = Number(roomId);
	const pid = String(playerId);
	if (!Number.isFinite(rid) || rid <= 0) return;
	if (!pid) return;

	let live = null;
	try {
		const roomMap = getLiveRoomMap(rid);
		pruneStaleStates(roomMap, { now: Date.now() });
		live = roomMap.get(pid) || null;
	} catch {}

	if (!live) return;

	const score = Number.isFinite(Number(live.score)) ? Number(live.score) : 0;
	const playerName = live.playerName ? String(live.playerName) : null;
	const nowMs = Date.now();

	// Record elapsed time (best-effort) in memory so /api/game/results can return it.
	try {
		const meta = getCompletionMetaMap(rid);
		const key = `id:${pid}`;
		const existing = meta.get(key) || {};
		const hasCompletion = (existing.completionTime != null) && Number.isFinite(Number(existing.completionTime));
		const startedAt = (typeof existing.startedAt === 'number') ? existing.startedAt : null;
		const completionTime = hasCompletion
			? existing.completionTime
			: (startedAt != null ? Math.max(0, nowMs - startedAt) : null);
		meta.set(key, { ...existing, completionTime });
	} catch {}

	// Persist score snapshot so teacher can still see rankings after a player leaves.
	try {
		await prisma.$transaction(async (tx) => {
			await tx.gameAttempt.deleteMany({ where: { roomId: rid, playerId: pid } });
			await tx.gameAttempt.create({
				data: {
					roomId: rid,
					playerId: pid,
					playerName,
					score,
				},
			});

			const attempts = await tx.gameAttempt.findMany({
				where: { roomId: rid },
				orderBy: [{ score: 'desc' }, { timestamp: 'asc' }],
			});

			const activePlayers = await tx.roomPlayer.count({
				where: { roomId: rid, kickedAt: null },
			});

			for (let index = 0; index < attempts.length; index += 1) {
				const attempt = attempts[index];
				await tx.gameAttempt.update({
					where: { id: attempt.id },
					data: { rank: index + 1, totalPlayers: activePlayers || attempts.length },
				});
			}
		});
	} catch {}
}

function pruneStaleStates(roomMap, { now = Date.now(), maxAgeMs = 30_000 } = {}) {
	for (const [playerId, state] of roomMap.entries()) {
		if (!state || typeof state.updatedAt !== 'number' || now - state.updatedAt > maxAgeMs) {
			roomMap.delete(playerId);
		}
	}
}

function pruneArchivedStates(roomMap, { now = Date.now(), maxAgeMs = 30 * 60_000 } = {}) {
	for (const [playerId, state] of roomMap.entries()) {
		const ts = state?.archivedAt;
		if (!state || typeof ts !== 'number' || now - ts > maxAgeMs) {
			roomMap.delete(playerId);
		}
	}
}

function removeLiveState(roomId, playerId) {
	const rid = Number(roomId);
	if (!Number.isFinite(rid) || rid <= 0) return;
	const key = String(playerId);
	const roomMap = liveStateByRoom.get(rid);
	if (!roomMap) return;
	const existing = roomMap.get(key);
	if (existing) {
		try {
			const archived = getArchivedRoomMap(rid);
			archived.set(key, { ...existing, archivedAt: Date.now() });
		} catch {}
	}
	roomMap.delete(key);
}

function markKicked(roomId, playerIds) {
	const set = getKickedRoomSet(roomId);
	for (const pid of playerIds) {
		set.add(String(pid));
	}
}

function mapRoom(room) {
	return {
		_id: toMongoLikeId(room.id),
		id: room.id,
		code: room.code,
		name: room.name,
		status: room.status,
		isActive: room.isActive,
		questionSetId: room.questionSetId ? toMongoLikeId(room.questionSetId) : null,
		createdAt: room.createdAt,
		updatedAt: room.updatedAt,
	};
}

function mapQuestionSet(questionSet) {
	return {
		_id: toMongoLikeId(questionSet.id),
		id: questionSet.id,
		title: questionSet.title,
		description: questionSet.description,
		createdBy: questionSet.createdBy,
		timeLimit: questionSet.timeLimit,
		map: questionSet.map,
		questions: (questionSet.questions || []).map((question) => ({
			_id: toMongoLikeId(question.id),
			id: question.id,
			question: question.question,
			type: question.type,
			options: Array.isArray(question.options) ? question.options : [],
			correctAnswer: question.correctAnswer,
			points: question.points,
		})),
		createdAt: questionSet.createdAt,
		updatedAt: questionSet.updatedAt,
	};
}

function calcMaxScoreFromQuestionSet(questionSet) {
	const questions = Array.isArray(questionSet?.questions) ? questionSet.questions : [];
	if (!questions.length) return 0;
	let sum = 0;
	for (const q of questions) {
		const pts = Number(q?.points);
		sum += (Number.isFinite(pts) && pts > 0) ? pts : 0;
	}
	return sum;
}

function calcPercentScore(score, maxScore) {
	const raw = Number(score) || 0;
	const max = Number(maxScore) || 0;
	if (!Number.isFinite(max) || max <= 0) {
		// Fallback: clamp raw to 0..100 so UI never exceeds 100%
		return Math.min(100, Math.max(0, raw));
	}
	const pct = (raw / max) * 100;
	return Math.min(100, Math.max(0, pct));
}

function normalizeDisplayName(value) {
	return String(value || '')
		.normalize('NFKC')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

const authService = {
	async register(payload) {
		const username = payload.username.trim();

		const existing = await prisma.user.findUnique({
			where: { username },
		});

		if (existing) {
			throw appError('Username already exists', 409);
		}

		const passwordHash = await bcrypt.hash(payload.password, 10);

		const user = await prisma.user.create({
			data: {
				username,
				name: username,
				// Do NOT bind role at registration.
				// The UI selects role at login time, and we embed that choice in the JWT.
				role: 'student',
				passwordHash,
			},
		});

		return {
			_id: toMongoLikeId(user.id),
			id: toMongoLikeId(user.id),
			username: user.username,
			role: user.role,
			createdAt: user.createdAt,
		};
	},

	async login(payload) {
		const username = payload.username.trim();

		const user = await prisma.user.findUnique({
			where: { username },
		});

		if (!user) {
			throw appError('Invalid username or password', 401);
		}

		const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
		if (!isValidPassword) {
			throw appError('Invalid username or password', 401);
		}

		// Role is selected at login time (same account can be used for both roles).
		const selectedRoleRaw = payload.role == null ? 'student' : String(payload.role);
		const selectedRole = (selectedRoleRaw === 'teacher' || selectedRoleRaw === 'student')
			? selectedRoleRaw
			: 'student';

		const token = jwt.sign(
			{
				sub: String(user.id),
				username: user.username,
				role: selectedRole,
			},
			JWT_SECRET,
			{ expiresIn: '7d' }
		);

		return {
			token,
			user: {
				id: toMongoLikeId(user.id),
				username: user.username,
				role: selectedRole,
			},
		};
	},
};

const questionSetService = {
	async list(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const sets = await prisma.questionSet.findMany({
			where: { createdBy: owner },
			include: { questions: true },
			orderBy: { createdAt: 'desc' },
		});

		return sets.map(mapQuestionSet);
	},

	async getById(id, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const set = await prisma.questionSet.findUnique({
			where: { id },
			include: { questions: true },
		});

		if (!set || String(set.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		return mapQuestionSet(set);
	},

	async create(payload, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const data = await prisma.questionSet.create({
			data: {
				title: payload.title,
				description: payload.description || '',
				createdBy: owner,
				timeLimit: payload.timeLimit || 30,
				map: payload.map || null,
				questions: {
					create: payload.questions.map((question) => ({
						question: question.question,
						type: question.type || 'multiple-choice',
						options: question.options,
						correctAnswer: question.correctAnswer,
						points: question.points || 1,
					})),
				},
			},
			include: { questions: true },
		});

		return mapQuestionSet(data);
	},

	async update(id, payload, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing || String(existing.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		const updated = await prisma.$transaction(async (transaction) => {
			await transaction.question.deleteMany({ where: { questionSetId: id } });

			return transaction.questionSet.update({
				where: { id },
				data: {
					title: payload.title,
					description: payload.description || '',
					createdBy: owner,
					timeLimit: payload.timeLimit || 30,
					map: payload.map || null,
					questions: {
						create: payload.questions.map((question) => ({
							question: question.question,
							type: question.type || 'multiple-choice',
							options: question.options,
							correctAnswer: question.correctAnswer,
							points: question.points || 1,
						})),
					},
				},
				include: { questions: true },
			});
		});

		return mapQuestionSet(updated);
	},

	async remove(id, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing || String(existing.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		await prisma.questionSet.delete({ where: { id } });
		return { deleted: true };
	},
};

const roomService = {
	async create(payload) {
		const roomCode = await generateUniqueRoomCode();

		const room = await prisma.room.create({
			data: {
				code: roomCode,
				name: payload.name || 'Quiz Room',
				isActive: payload.isActive ?? true,
				status: 'waiting',
				questionSetId: payload.questionSetId || null,
			},
		});

		return mapRoom(room);
	},

	async getById(id) {
		const room = await prisma.room.findUnique({ where: { id } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		return mapRoom(room);
	},

	async getByCode(code) {
		const room = await prisma.room.findUnique({
			where: { code: code.toUpperCase() },
		});

		if (!room) {
			throw appError('Room not found', 404);
		}

		return mapRoom(room);
	},

	async updateRoom(id, payload) {
		const room = await prisma.room.findUnique({ where: { id } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const updated = await prisma.room.update({
			where: { id },
			data: {
				status: payload.status ?? room.status,
			},
		});

		return mapRoom(updated);
	},

	async getPlayers(id) {
		const room = await prisma.room.findUnique({ where: { id } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const players = await prisma.roomPlayer.findMany({
			where: { roomId: id, kickedAt: null },
			orderBy: { joinedAt: 'asc' },
		});

		return players.map((player) => ({
			_id: toMongoLikeId(player.id),
			id: toMongoLikeId(player.id),
			name: player.name,
			joinedAt: player.joinedAt,
		}));
	},

	async joinRoom(roomId, payload) {
		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		if (room.status === 'ended') {
			throw appError('Room is not open for joining', 409);
		}

		const normalizedName = payload.name.trim().toLowerCase();
		const existingPlayers = await prisma.roomPlayer.findMany({
			where: { roomId, kickedAt: null },
			select: { name: true },
		});

		const duplicated = existingPlayers.some((player) => player.name.trim().toLowerCase() === normalizedName);
		if (duplicated) {
			throw appError('ชื่อผู้เล่นซ้ำในห้องนี้', 409);
		}

		const player = await prisma.roomPlayer.create({
			data: {
				roomId,
				name: payload.name.trim(),
			},
		});

		return {
			_id: toMongoLikeId(player.id),
			id: toMongoLikeId(player.id),
			roomId: toMongoLikeId(room.id),
			name: player.name,
			joinedAt: player.joinedAt,
		};
	},

	async leaveRoom(roomId, playerId) {
		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const pid = Number(playerId);
		if (!Number.isFinite(pid) || pid <= 0) throw appError('Invalid playerId', 400);

		const now = new Date();

		// We treat "leave" as "inactive" in the roster (same mechanism as kick: kickedAt != null).
		const updated = await prisma.roomPlayer.updateMany({
			where: { roomId, id: pid, kickedAt: null },
			data: { kickedAt: now },
		});

		if (updated.count > 0) {
			// Persist last known score/time before we clear live-state.
			await persistAttemptFromLiveState(roomId, String(pid));
			// Clear any live state and reject further updates from this player id.
			markKicked(roomId, [String(pid)]);
			removeLiveState(roomId, String(pid));
		}

		return {
			left: updated.count,
			roomId: toMongoLikeId(roomId),
			playerId: toMongoLikeId(pid),
		};
	},

	async kickAll(roomId) {
		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const now = new Date();

		const activePlayers = await prisma.roomPlayer.findMany({
			where: { roomId, kickedAt: null },
			select: { id: true },
		});

		// Mark kicked + clear any live state for these ids (REST spectator mode)
		markKicked(roomId, activePlayers.map((p) => String(p.id)));
		for (const p of activePlayers) {
			removeLiveState(roomId, String(p.id));
		}

		await prisma.$transaction([
			prisma.room.update({
				where: { id: roomId },
				data: { status: 'waiting' },
			}),
			prisma.roomPlayer.updateMany({
				where: { roomId, kickedAt: null },
				data: { kickedAt: now },
			}),
		]);

		return {
			kicked: activePlayers.length,
			roomId: toMongoLikeId(roomId),
		};
	},

	async kickPlayer(roomId, playerId) {
		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const now = new Date();
		const pid = Number(playerId);
		if (!Number.isFinite(pid) || pid <= 0) throw appError('Invalid playerId', 400);

		const updated = await prisma.roomPlayer.updateMany({
			where: { roomId, id: pid, kickedAt: null },
			data: { kickedAt: now },
		});

		if (updated.count > 0) {
			await persistAttemptFromLiveState(roomId, String(pid));
			markKicked(roomId, [String(pid)]);
			removeLiveState(roomId, String(pid));
		}

		return {
			kicked: updated.count,
			roomId: toMongoLikeId(roomId),
			playerId: toMongoLikeId(pid),
		};
	},
};

const gameService = {
	async getResults(roomId) {
		const rid = Number(roomId);
		if (!Number.isFinite(rid) || rid <= 0) throw appError('Invalid roomId', 400);

		const room = await prisma.room.findUnique({ where: { id: rid } });
		if (!room) throw appError('Room not found', 404);

		const attempts = await prisma.gameAttempt.findMany({
			where: { roomId: rid },
			orderBy: [{ score: 'desc' }, { timestamp: 'asc' }],
		});

		let meta = null;
		try { meta = getCompletionMetaMap(rid); } catch {}
		const resolveCompletionTime = (attempt) => {
			if (!meta) return null;
			const pid = attempt.playerId ? String(attempt.playerId) : '';
			const pname = String(attempt.playerName || '');
			if (pid && meta.has(`id:${pid}`)) return meta.get(`id:${pid}`)?.completionTime ?? null;
			if (pname && meta.has(`name:${pname}`)) return meta.get(`name:${pname}`)?.completionTime ?? null;
			return null;
		};

		return {
			roomId: toMongoLikeId(rid),
			rankings: attempts.map((attempt, index) => ({
				rank: attempt.rank ?? (index + 1),
				playerId: attempt.playerId,
				playerName: attempt.playerName,
				finalScore: attempt.score,
				completionTime: resolveCompletionTime(attempt),
				timestamp: attempt.timestamp,
			})),
		};
	},
	async getRoom(roomId) {
		const room = await prisma.room.findUnique({
			where: { id: roomId },
			include: {
				players: {
					where: { kickedAt: null },
					orderBy: { joinedAt: 'asc' },
				},
				questionSet: true,
			},
		});

		if (!room) {
			throw appError('Room not found', 404);
		}

		return {
			...mapRoom(room),
			questionSetTitle: room.questionSet?.title || null,
			questionSetMap: room.questionSet?.map || null,
			players: room.players.map((player) => ({
				playerId: toMongoLikeId(player.id),
				name: player.name,
				role: 'student',
			})),
		};
	},

	async getQuestions(roomId) {
		const room = await prisma.room.findUnique({
			where: { id: roomId },
			include: {
				questionSet: {
					include: {
						questions: {
							orderBy: { id: 'asc' },
						},
					},
				},
			},
		});

		if (!room) {
			throw appError('Room not found', 404);
		}

		const questions = (room.questionSet?.questions || []).map((question, index) => {
			const options = Array.isArray(question.options) ? question.options : [];
			return {
				id: toMongoLikeId(question.id),
				text: question.question,
				choices: options,
				answerIndex: Math.max(0, options.findIndex((item) => item === question.correctAnswer)),
				points: question.points || 100,
				x: 240 + (index % 5) * 180,
				y: 140 + Math.floor(index / 5) * 120,
			};
		});

		return {
			roomId: toMongoLikeId(room.id),
			questionSetId: room.questionSet ? toMongoLikeId(room.questionSet.id) : null,
			questionSetTitle: room.questionSet?.title || null,
			timeLimit: Number.isFinite(Number(room.questionSet?.timeLimit)) ? Number(room.questionSet.timeLimit) : 30,
			questions,
		};
	},

	async getHistory(query) {
		const limit = Math.min(Number(query.limit) || 50, 500);
		const where = {};

		if (query.playerId) {
			where.playerId = String(query.playerId);
		} else if (query.name) {
			where.playerName = String(query.name);
		}

		const attempts = await prisma.gameAttempt.findMany({
			where,
			orderBy: { timestamp: 'desc' },
			take: limit,
			include: {
				room: {
					select: {
						name: true,
						questionSet: {
							select: {
								title: true,
								questions: { select: { points: true } },
							},
						},
					},
				},
			},
		});

		const percentScores = attempts.map((item) => {
			const maxScore = calcMaxScoreFromQuestionSet(item?.room?.questionSet);
			return calcPercentScore(item?.score, maxScore);
		});
		const scores = attempts.map((item) => item.score);
		const total = scores.length;
		const averageScore = total ? Number((scores.reduce((sum, item) => sum + item, 0) / total).toFixed(2)) : 0;
		const bestScore = total ? Math.max(...scores) : 0;
		const averageScorePercent = total
			? Number((percentScores.reduce((sum, item) => sum + item, 0) / total).toFixed(2))
			: 0;
		const bestScorePercent = total ? Number(Math.max(...percentScores).toFixed(2)) : 0;

		return {
			summary: {
				totalTests: total,
				totalAttempts: total,
				averageScore,
				averageScorePercent,
				bestScore,
				bestScorePercent,
			},
			attempts: attempts.map((item) => ({
				_id: toMongoLikeId(item.id),
				roomId: toMongoLikeId(item.roomId),
				roomName: item.room?.name || null,
				questionSetTitle: item.room?.questionSet?.title || null,
				playerId: item.playerId,
				playerName: item.playerName,
				score: item.score,
				scorePercent: Number(calcPercentScore(item.score, calcMaxScoreFromQuestionSet(item?.room?.questionSet)).toFixed(2)),
				rank: item.rank,
				totalPlayers: item.totalPlayers,
				timestamp: item.timestamp,
			})),
		};
	},

	async deleteHistory(query) {
		const where = {};

		if (query.playerId) {
			where.playerId = String(query.playerId);
		} else if (query.name) {
			where.playerName = String(query.name);
		}

		if (query.roomId) {
			where.roomId = Number(query.roomId);
		}

		if (query.ts) {
			const date = new Date(query.ts);
			if (Number.isNaN(date.getTime())) {
				throw appError('Invalid timestamp', 400);
			}
			where.timestamp = date;
		}

		const deleted = await prisma.gameAttempt.deleteMany({ where });
		return { deleted: deleted.count };
	},

	async complete(payload) {
		const roomId = Number(payload.roomId);
		const playerId = payload.playerId ? String(payload.playerId) : null;
		const playerName = String(payload.playerName);
		const finalScore = Number(payload.finalScore) || 0;
		const completionTimeMs = payload.completionTime == null ? null : Math.max(0, Number(payload.completionTime) || 0);

		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		// Track duration in memory so teacher + other students can see it.
		try {
			if (completionTimeMs != null) {
				const meta = getCompletionMetaMap(roomId);
				const key = playerId ? `id:${playerId}` : `name:${playerName}`;
				meta.set(key, { completionTime: completionTimeMs });
			}
		} catch {}

		await prisma.$transaction(async (tx) => {
			if (playerId) {
				await tx.gameAttempt.deleteMany({
					where: {
						roomId,
						playerId,
					},
				});
			}

			await tx.gameAttempt.create({
				data: {
					roomId,
					playerId,
					playerName,
					score: finalScore,
				},
			});

			const attempts = await tx.gameAttempt.findMany({
				where: { roomId },
				orderBy: [{ score: 'desc' }, { timestamp: 'asc' }],
			});

			const activePlayers = await tx.roomPlayer.count({
				where: { roomId, kickedAt: null },
			});

			// Update rank/totalPlayers for visibility in history endpoints.
			for (let index = 0; index < attempts.length; index += 1) {
				const attempt = attempts[index];
				await tx.gameAttempt.update({
					where: { id: attempt.id },
					data: { rank: index + 1, totalPlayers: activePlayers || attempts.length },
				});
			}
		});

		const attempts = await prisma.gameAttempt.findMany({
			where: { roomId },
			orderBy: [{ score: 'desc' }, { timestamp: 'asc' }],
		});

		let meta = null;
		try { meta = getCompletionMetaMap(roomId); } catch {}

		const resolveCompletionTime = (attempt) => {
			if (!meta) return null;
			const pid = attempt.playerId ? String(attempt.playerId) : '';
			const pname = String(attempt.playerName || '');
			if (pid && meta.has(`id:${pid}`)) return meta.get(`id:${pid}`)?.completionTime ?? null;
			if (pname && meta.has(`name:${pname}`)) return meta.get(`name:${pname}`)?.completionTime ?? null;
			return null;
		};

		return {
			roomId: toMongoLikeId(roomId),
			rankings: attempts.map((attempt) => ({
				rank: attempt.rank,
				playerId: attempt.playerId,
				playerName: attempt.playerName,
				finalScore: attempt.score,
				completionTime: resolveCompletionTime(attempt),
				timestamp: attempt.timestamp,
			})),
		};
	},

	async upsertLiveState(payload) {
		const roomId = Number(payload.roomId);
		const playerId = String(payload.playerId);
		const playerName = String(payload.playerName);
		const x = Number(payload.x);
		const y = Number(payload.y);
		const score = payload.score == null ? undefined : Number(payload.score);
		const answered = payload.answered == null ? undefined : Number(payload.answered);
		const mode = payload.mode == null ? undefined : String(payload.mode);
		const now = Date.now();

		if (!Number.isFinite(roomId) || roomId <= 0) throw appError('Invalid roomId', 400);
		if (!playerId) throw appError('Invalid playerId', 400);
		if (!playerName) throw appError('Invalid playerName', 400);
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw appError('Invalid position', 400);

		// If player has been kicked, ignore further live-state updates.
		// This keeps teacher view clean even if the client hasn't redirected yet.
		try {
			const kickedSet = getKickedRoomSet(roomId);
			if (kickedSet.has(String(playerId))) {
				return { ignored: true };
			}
		} catch {}

		// Track a best-effort "startedAt" timestamp for elapsed time calculations.
		try {
			const meta = getCompletionMetaMap(roomId);
			const key = `id:${String(playerId)}`;
			const existing = meta.get(key) || {};
			if (typeof existing.startedAt !== 'number') {
				meta.set(key, { ...existing, startedAt: now });
			}
		} catch {}

		const roomMap = getLiveRoomMap(roomId);
		pruneStaleStates(roomMap, { now });
		// If this player is active again, remove any archived snapshot.
		try {
			const archived = getArchivedRoomMap(roomId);
			archived.delete(playerId);
		} catch {}

		const prev = roomMap.get(playerId);
		const next = {
			roomId: toMongoLikeId(roomId),
			playerId,
			playerName,
			x,
			y,
			score: Number.isFinite(score) ? score : (prev?.score ?? 0),
			answered: Number.isFinite(answered) ? answered : (prev?.answered ?? 0),
			mode: mode || prev?.mode || null,
			updatedAt: now,
		};

		roomMap.set(playerId, next);
		return { state: next };
	},

	async getLiveState(roomId) {
		const rid = Number(roomId);
		if (!Number.isFinite(rid) || rid <= 0) throw appError('Invalid roomId', 400);

		const roomMap = getLiveRoomMap(rid);
		const now = Date.now();
		pruneStaleStates(roomMap, { now });
		let archivedMap = null;
		try {
			archivedMap = getArchivedRoomMap(rid);
			pruneArchivedStates(archivedMap, { now });
		} catch { archivedMap = null; }

		// Merge active + archived (active wins) so teacher can still spectate after leave.
		const mergedPlayers = [];
		const seen = new Set();
		for (const p of Array.from(roomMap.values())) {
			if (!p?.playerId) continue;
			seen.add(String(p.playerId));
			mergedPlayers.push(p);
		}
		if (archivedMap) {
			for (const p of Array.from(archivedMap.values())) {
				if (!p?.playerId) continue;
				const pid = String(p.playerId);
				if (seen.has(pid)) continue;
				mergedPlayers.push(p);
			}
		}

		return {
			roomId: toMongoLikeId(rid),
			players: mergedPlayers.map((p) => ({
				playerId: p.playerId,
				playerName: p.playerName,
				x: p.x,
				y: p.y,
				score: p.score ?? 0,
				answered: p.answered ?? 0,
				mode: p.mode ?? null,
				updatedAt: p.updatedAt,
			})),
		};
	},
};

// Non-destructive: hide a name from the "today participants" list only.
// This does NOT delete or modify any GameAttempt history.
// Behavior: hidden until the student plays again (a newer attempt is recorded).
// Note: in-memory only (resets when the backend restarts).
// Map<teacherKey, Map<dayKey, Map<nameKey, hiddenAtMs>>>
const hiddenTodayParticipantsByTeacher = new Map();

const normalizeTeacherKey = (user) => String(user?.username || '').trim().toLowerCase();

const getHiddenMapFor = (teacherKey, dayKey) => {
	if (!teacherKey) return new Map();
	if (!hiddenTodayParticipantsByTeacher.has(teacherKey)) {
		hiddenTodayParticipantsByTeacher.set(teacherKey, new Map());
	}
	const byDay = hiddenTodayParticipantsByTeacher.get(teacherKey);
	if (!byDay.has(dayKey)) {
		byDay.set(dayKey, new Map());
	}
	return byDay.get(dayKey);
};

const getLocalDayKey = (date = new Date()) => {
	const yyyy = String(date.getFullYear());
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
};

const teacherService = {
	async dashboard(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		// Use the same data source as the "รายชื่อนักเรียนที่เข้าร่วมวันนี้" list
		// so the count and the list are always consistent.
		const { participants: todayParticipants } = await this.todayParticipants(user);
		const { tests: todayTests } = await this.todayTestTitles(user);

		const [attempts] = await Promise.all([
			prisma.gameAttempt.findMany({
				where: {
					room: {
						questionSet: { createdBy: owner },
					},
				},
				select: {
					score: true,
					room: {
						select: {
							questionSet: {
								select: {
									questions: { select: { points: true } },
								},
							},
						},
					},
				},
				// Keep it bounded for dashboard; newest first is fine.
				orderBy: { timestamp: 'desc' },
				take: 1000,
			}),
		]);

		const percents = (attempts || []).map((a) => {
			const maxScore = calcMaxScoreFromQuestionSet(a?.room?.questionSet);
			return calcPercentScore(a?.score, maxScore);
		});
		const avgPercentRaw = percents.length
			? (percents.reduce((sum, p) => sum + (Number(p) || 0), 0) / percents.length)
			: 0;
		const avgPercent = Number.isFinite(avgPercentRaw)
			? Number(Math.min(100, Math.max(0, avgPercentRaw)).toFixed(2))
			: 0;

		return {
			studentsJoined: Array.isArray(todayParticipants) ? todayParticipants.length : 0,
			averageScorePercent: avgPercent,
			testsToday: Array.isArray(todayTests) ? todayTests.length : 0,
		};
	},

	async todayTestTitles(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const attempts = await prisma.gameAttempt.findMany({
			where: {
				timestamp: { gte: todayStart },
				room: {
					questionSet: { createdBy: owner },
				},
			},
			select: {
				room: {
					select: {
						questionSet: { select: { title: true } },
					},
				},
				timestamp: true,
			},
			orderBy: { timestamp: 'desc' },
			take: 5000,
		});

		const seen = new Set();
		const tests = [];
		for (const a of attempts || []) {
			const title = String(a?.room?.questionSet?.title || '').trim();
			if (!title) continue;
			const key = title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			tests.push({ title });
			if (tests.length >= 200) break;
		}

		return { tests };
	},

	async todayParticipants(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}
		const teacherKey = normalizeTeacherKey(user);

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const dayKey = getLocalDayKey(todayStart);
		const hiddenMap = getHiddenMapFor(teacherKey, dayKey);

		const attempts = await prisma.gameAttempt.findMany({
			where: {
				timestamp: { gte: todayStart },
				playerName: { not: null },
				room: {
					questionSet: { createdBy: owner },
				},
			},
			select: {
				playerName: true,
				timestamp: true,
			},
			orderBy: { timestamp: 'desc' },
			take: 5000,
		});

		// Group by display name (case-insensitive, normalized) so each student appears once.
		// Also return how many attempts they did today.
		const isPlaceholderName = (nm) => {
			const name = String(nm || '').trim();
			if (!name) return true;
			return (
				/^นักเรียน\s*[A-Z]$/i.test(name) ||
				/^student\s*[A-Z]$/i.test(name) ||
				/^ArchiveTest/i.test(name)
			);
		};

		const byName = new Map();
		for (const a of attempts || []) {
			const nm = normalizeDisplayName(a?.playerName);
			if (!nm) continue;
			if (isPlaceholderName(nm)) continue;
			const key = nm.toLowerCase();
			const hiddenAt = hiddenMap.get(key);
			if (typeof hiddenAt === 'number') {
				const attemptMs = a?.timestamp instanceof Date ? a.timestamp.getTime() : NaN;
				// If the latest attempt is at/before hiddenAt, keep hidden.
				// If a newer attempt exists after hiddenAt, show again.
				if (Number.isFinite(attemptMs) && attemptMs <= hiddenAt) continue;
				// Auto-unhide once we detect a newer attempt.
				hiddenMap.delete(key);
			}
			const prev = byName.get(key);
			if (!prev) {
				// attempts are ordered desc => first seen is the latest pretty name
				byName.set(key, { name: nm, count: 1 });
			} else {
				prev.count += 1;
			}
			if (byName.size >= 500) break;
		}

		// Note: hiddenMap is already stored per-teacher-per-day.

		const participants = Array.from(byName.values());
		participants.sort((a, b) => {
			const dc = (Number(b?.count) || 0) - (Number(a?.count) || 0);
			if (dc !== 0) return dc;
			return String(a?.name || '').localeCompare(String(b?.name || ''), 'th');
		});

		return { participants };
	},

	async todayTests(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		// Return recent test sessions (rooms) with per-student scores so teachers can
		// view both today's and past tests from the same popover.
		const since = new Date();
		// Keep it bounded: 60 days of history is enough for dashboard.
		since.setDate(since.getDate() - 60);
		since.setHours(0, 0, 0, 0);

		const attempts = await prisma.gameAttempt.findMany({
			where: {
				timestamp: { gte: since },
				room: {
					questionSet: { createdBy: owner },
				},
			},
			select: {
				roomId: true,
				playerId: true,
				playerName: true,
				score: true,
				timestamp: true,
				room: {
					select: {
						id: true,
						code: true,
						name: true,
						createdAt: true,
						questionSet: {
							select: {
								id: true,
								title: true,
								questions: { select: { points: true } },
							},
						},
					},
				},
			},
			orderBy: { timestamp: 'desc' },
			take: 15000,
		});

		const isPlaceholderName = (nm) => {
			const name = String(nm || '').trim();
			if (!name) return true;
			return (
				/^นักเรียน\s*[A-Z]$/i.test(name) ||
				/^student\s*[A-Z]$/i.test(name) ||
				/^ArchiveTest/i.test(name)
			);
		};

		const sessionsByRoom = new Map();

		for (const a of attempts || []) {
			const roomId = Number(a?.roomId);
			if (!Number.isInteger(roomId) || roomId <= 0) continue;
			const qs = a?.room?.questionSet || null;
			const title = String(qs?.title || '').trim();
			if (!title) continue;
			const playedAt = a?.timestamp instanceof Date ? a.timestamp : (a?.timestamp ? new Date(a.timestamp) : null);
			const playedAtMs = playedAt instanceof Date && !Number.isNaN(playedAt.getTime()) ? playedAt.getTime() : null;
			if (!playedAtMs) continue;

			if (!sessionsByRoom.has(roomId)) {
				sessionsByRoom.set(roomId, {
					roomId,
					roomCode: String(a?.room?.code || ''),
					roomName: String(a?.room?.name || ''),
					roomCreatedAt: a?.room?.createdAt instanceof Date ? a.room.createdAt : null,
					questionSetId: qs?.id != null ? String(qs.id) : null,
					title,
					maxScore: calcMaxScoreFromQuestionSet(qs),
					lastPlayedAtMs: playedAtMs,
					bestByStudent: new Map(),
				});
			}

			const session = sessionsByRoom.get(roomId);
			if (playedAtMs > (session.lastPlayedAtMs || 0)) session.lastPlayedAtMs = playedAtMs;

			const displayName = normalizeDisplayName(a?.playerName);
			if (!displayName) continue;
			if (isPlaceholderName(displayName)) continue;

			const idKey = String(a?.playerId || '').trim();
			const studentKey = (idKey ? `id:${idKey.toLowerCase()}` : `name:${displayName.toLowerCase()}`);

			const nextScore = Number.isFinite(Number(a?.score)) ? Number(a.score) : 0;
			const prev = session.bestByStudent.get(studentKey);
			if (!prev) {
				session.bestByStudent.set(studentKey, {
					key: studentKey,
					name: displayName,
					score: nextScore,
					playedAtMs,
				});
				continue;
			}

			// Prefer higher score; if tie, prefer newer.
			if (nextScore > prev.score || (nextScore === prev.score && playedAtMs > (prev.playedAtMs || 0))) {
				session.bestByStudent.set(studentKey, {
					...prev,
					score: nextScore,
					playedAtMs,
					name: displayName || prev.name,
				});
			}
		}

		const sessions = Array.from(sessionsByRoom.values())
			.map((s) => {
				const students = Array.from(s.bestByStudent.values())
					.map((st) => {
						const pct = calcPercentScore(st.score, s.maxScore);
						return {
							name: st.name,
							score: st.score,
							percent: Number.isFinite(pct) ? Number(pct.toFixed(2)) : 0,
						};
					})
					.sort((a, b) => {
						if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
						return String(a.name || '').localeCompare(String(b.name || ''), 'th');
					});

				return {
					roomId: String(s.roomId),
					roomCode: s.roomCode || null,
					roomName: s.roomName || null,
					questionSetId: s.questionSetId,
					title: s.title,
					playedAt: new Date(s.lastPlayedAtMs).toISOString(),
					isToday: s.lastPlayedAtMs >= todayStart.getTime(),
					maxScore: s.maxScore,
					students,
				};
			})
			.sort((a, b) => {
				const at = new Date(a.playedAt).getTime();
				const bt = new Date(b.playedAt).getTime();
				if (bt !== at) return bt - at;
				return String(a.title || '').localeCompare(String(b.title || ''), 'th');
			});

		// Keep response bounded for the popover.
		const limited = sessions.slice(0, 50);

		return { tests: limited };
	},

	async deleteTodayParticipant(name, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}
		const teacherKey = normalizeTeacherKey(user);

		const target = normalizeDisplayName(name);
		if (!target) return { hidden: false };
		const targetKey = target.toLowerCase();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const dayKey = getLocalDayKey(todayStart);
		const nowMs = Date.now();
		const hiddenMap = getHiddenMapFor(teacherKey, dayKey);
		hiddenMap.set(targetKey, nowMs);

		// Backward compatible response shape (frontend previously read "deleted").
		return { hidden: true, deleted: 0 };
	},
};

module.exports = {
	authService,
	questionSetService,
	roomService,
	gameService,
	teacherService,
};
