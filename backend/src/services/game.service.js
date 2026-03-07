const { prisma, appError, toMongoLikeId, mapRoom } = require('./_shared/service-utils');

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const getAttemptPlayerKey = (attempt) => {
	const idKey = normalizeKey(attempt?.playerId);
	if (idKey) return `id:${idKey}`;
	const nameKey = normalizeKey(attempt?.playerName);
	if (nameKey) return `name:${nameKey}`;
	return '';
};

const buildDerivedRankLookup = (roomAttempts = []) => {
	const byRoom = new Map();

	for (const attempt of roomAttempts) {
		const roomId = Number(attempt?.roomId);
		if (!Number.isInteger(roomId) || roomId <= 0) continue;
		const playerKey = getAttemptPlayerKey(attempt);
		if (!playerKey) continue;

		if (!byRoom.has(roomId)) byRoom.set(roomId, new Map());
		const bestByPlayer = byRoom.get(roomId);
		const current = bestByPlayer.get(playerKey);
		const nextScore = Number(attempt?.score || 0);
		const nextTimestamp = attempt?.timestamp ? new Date(attempt.timestamp).getTime() : Number.POSITIVE_INFINITY;

		if (!current) {
			bestByPlayer.set(playerKey, {
				playerKey,
				playerName: String(attempt?.playerName || ''),
				score: nextScore,
				timestamp: nextTimestamp,
			});
			continue;
		}

		if (nextScore > current.score || (nextScore === current.score && nextTimestamp < current.timestamp)) {
			bestByPlayer.set(playerKey, {
				...current,
				score: nextScore,
				timestamp: nextTimestamp,
				playerName: String(attempt?.playerName || current.playerName || ''),
			});
		}
	}

	const lookup = new Map();

	for (const [roomId, bestByPlayer] of byRoom.entries()) {
		const rows = Array.from(bestByPlayer.values())
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
				return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'th');
			});

		const totalPlayers = rows.length;
		rows.forEach((row, index) => {
			lookup.set(`${roomId}:${row.playerKey}`, {
				rank: index + 1,
				totalPlayers,
			});
		});
	}

	return lookup;
};

const gameService = {
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
			questions,
		};
	},

	async getHistory(query) {
		const limit = Math.min(Number(query.limit) || 50, 500);
		const where = {};

		if (query.roomId) {
			where.roomId = Number(query.roomId);
		}

		if (query.playerId) {
			where.playerId = String(query.playerId);
		} else if (query.name) {
			where.playerName = String(query.name);
		}

		const attempts = await prisma.gameAttempt.findMany({
			where,
			orderBy: { timestamp: 'desc' },
			take: limit,
		});

		const roomIds = Array.from(new Set(attempts.map((item) => Number(item.roomId)).filter((id) => Number.isInteger(id) && id > 0)));
		let derivedRankLookup = new Map();
		if (roomIds.length) {
			const roomAttempts = await prisma.gameAttempt.findMany({
				where: { roomId: { in: roomIds } },
				select: {
					roomId: true,
					playerId: true,
					playerName: true,
					score: true,
					timestamp: true,
				},
			});
			derivedRankLookup = buildDerivedRankLookup(roomAttempts);
		}

		const scores = attempts.map((item) => item.score);
		const total = scores.length;
		const averageScore = total ? Number((scores.reduce((sum, item) => sum + item, 0) / total).toFixed(2)) : 0;
		const bestScore = total ? Math.max(...scores) : 0;

		return {
			summary: {
				totalTests: total,
				totalAttempts: total,
				averageScore,
				bestScore,
			},
			attempts: attempts.map((item) => ({
				...(function deriveRankFields() {
					const explicitRank = Number(item.rank);
					const explicitTotalPlayers = Number(item.totalPlayers);
					const hasExplicit = Number.isInteger(explicitRank) && explicitRank > 0 && Number.isInteger(explicitTotalPlayers) && explicitTotalPlayers > 0;
					if (hasExplicit) {
						return { rank: explicitRank, totalPlayers: explicitTotalPlayers };
					}

					const derived = derivedRankLookup.get(`${Number(item.roomId)}:${getAttemptPlayerKey(item)}`);
					if (derived) {
						return { rank: derived.rank, totalPlayers: derived.totalPlayers };
					}

					return { rank: null, totalPlayers: null };
				})(),
				_id: toMongoLikeId(item.id),
				roomId: toMongoLikeId(item.roomId),
				playerId: item.playerId,
				playerName: item.playerName,
				score: item.score,
				timestamp: item.timestamp,
			})),
		};
	},

	async createHistory(payload) {
		const roomId = Number(payload.roomId);
		if (!Number.isInteger(roomId) || roomId <= 0) {
			throw appError('Invalid roomId', 400);
		}

		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const score = Number(payload.score) || 0;

		const record = await prisma.gameAttempt.create({
			data: {
				roomId,
				playerId: payload.playerId ? String(payload.playerId) : null,
				playerName: payload.playerName ? String(payload.playerName) : null,
				score,
				totalPlayers: payload.totalPlayers ? Number(payload.totalPlayers) : null,
				rank: payload.rank ? Number(payload.rank) : null,
			},
		});

		return {
			attempt: {
				_id: toMongoLikeId(record.id),
				roomId: toMongoLikeId(record.roomId),
				playerId: record.playerId,
				playerName: record.playerName,
				score: record.score,
				rank: record.rank,
				totalPlayers: record.totalPlayers,
				timestamp: record.timestamp,
			},
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

	async clearRoomHistory(roomId) {
		const room = await prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw appError('Room not found', 404);
		}

		const deleted = await prisma.gameAttempt.deleteMany({
			where: { roomId },
		});

		return {
			roomId: toMongoLikeId(roomId),
			deleted: deleted.count,
		};
	},
};

module.exports = gameService;
