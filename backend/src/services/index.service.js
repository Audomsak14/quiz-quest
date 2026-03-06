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

function getCompletionMetaMap(roomId) {
	const key = Number(roomId);
	if (!completionMetaByRoom.has(key)) {
		completionMetaByRoom.set(key, new Map());
	}
	return completionMetaByRoom.get(key);
}

function pruneStaleStates(roomMap, { now = Date.now(), maxAgeMs = 30_000 } = {}) {
	for (const [playerId, state] of roomMap.entries()) {
		if (!state || typeof state.updatedAt !== 'number' || now - state.updatedAt > maxAgeMs) {
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
				role: payload.role || 'student',
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

		if (payload.role && payload.role !== user.role) {
			throw appError('Role does not match account', 403);
		}

		const token = jwt.sign(
			{
				sub: String(user.id),
				username: user.username,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: '7d' }
		);

		return {
			token,
			user: {
				id: toMongoLikeId(user.id),
				username: user.username,
				role: user.role,
			},
		};
	},
};

const questionSetService = {
	async list() {
		const sets = await prisma.questionSet.findMany({
			include: { questions: true },
			orderBy: { createdAt: 'desc' },
		});

		return sets.map(mapQuestionSet);
	},

	async getById(id) {
		const set = await prisma.questionSet.findUnique({
			where: { id },
			include: { questions: true },
		});

		if (!set) {
			throw appError('Question set not found', 404);
		}

		return mapQuestionSet(set);
	},

	async create(payload) {
		const data = await prisma.questionSet.create({
			data: {
				title: payload.title,
				description: payload.description || '',
				createdBy: payload.createdBy || null,
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

	async update(id, payload) {
		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing) {
			throw appError('Question set not found', 404);
		}

		const updated = await prisma.$transaction(async (transaction) => {
			await transaction.question.deleteMany({ where: { questionSetId: id } });

			return transaction.questionSet.update({
				where: { id },
				data: {
					title: payload.title,
					description: payload.description || '',
					createdBy: payload.createdBy || null,
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

	async remove(id) {
		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing) {
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

		const roomMap = getLiveRoomMap(roomId);
		pruneStaleStates(roomMap, { now });

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

		return {
			roomId: toMongoLikeId(rid),
			players: Array.from(roomMap.values()).map((p) => ({
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

const teacherService = {
	async dashboard() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [studentsJoined, attempts, testsToday] = await Promise.all([
			prisma.roomPlayer.count({
				where: { kickedAt: null },
			}),
			prisma.gameAttempt.findMany({
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
			prisma.room.count({
				where: {
					createdAt: { gte: todayStart },
				},
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
			studentsJoined,
			averageScorePercent: avgPercent,
			testsToday,
		};
	},

	async todayParticipants() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const attempts = await prisma.gameAttempt.findMany({
			where: {
				timestamp: { gte: todayStart },
				playerName: { not: null },
			},
			select: {
				playerName: true,
				timestamp: true,
			},
			orderBy: { timestamp: 'desc' },
			take: 5000,
		});

		// Group by display name (case-insensitive) so each student appears once.
		// Also return how many attempts they did today.
		const byName = new Map();
		for (const a of attempts || []) {
			const nm = String(a?.playerName || '').trim();
			if (!nm) continue;
			const key = nm.toLowerCase();
			const prev = byName.get(key);
			if (!prev) {
				// attempts are ordered desc => first seen is the latest pretty name
				byName.set(key, { name: nm, count: 1 });
			} else {
				prev.count += 1;
			}
			if (byName.size >= 500) break;
		}

		const participants = Array.from(byName.values());
		participants.sort((a, b) => {
			const dc = (Number(b?.count) || 0) - (Number(a?.count) || 0);
			if (dc !== 0) return dc;
			return String(a?.name || '').localeCompare(String(b?.name || ''), 'th');
		});

		return { participants };
	},
};

module.exports = {
	authService,
	questionSetService,
	roomService,
	gameService,
	teacherService,
};
