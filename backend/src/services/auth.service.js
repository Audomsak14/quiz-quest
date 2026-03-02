const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const { prisma, appError, toMongoLikeId } = require('./_shared/service-utils');

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

module.exports = authService;
