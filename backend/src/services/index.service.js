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

		if (room.status !== 'waiting') {
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

const teacherService = {
	async dashboard() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [studentsJoined, attemptsAgg, testsToday] = await Promise.all([
			prisma.roomPlayer.count({
				where: { kickedAt: null },
			}),
			prisma.gameAttempt.aggregate({
				_avg: { score: true },
			}),
			prisma.room.count({
				where: {
					createdAt: { gte: todayStart },
				},
			}),
		]);

		return {
			studentsJoined,
			averageScorePercent: Number((attemptsAgg._avg.score || 0).toFixed(2)),
			testsToday,
		};
	},
};

module.exports = {
	authService,
	questionSetService,
	roomService,
	gameService,
	teacherService,
};
