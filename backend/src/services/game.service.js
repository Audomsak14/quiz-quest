const { prisma, appError, toMongoLikeId, mapRoom } = require('./_shared/service-utils');

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
				_id: toMongoLikeId(item.id),
				roomId: toMongoLikeId(item.roomId),
				playerId: item.playerId,
				playerName: item.playerName,
				score: item.score,
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
};

module.exports = gameService;
