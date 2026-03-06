const { prisma, appError, toMongoLikeId, generateUniqueRoomCode, mapRoom } = require('./_shared/service-utils');

const roomService = {
	async create(payload) {
		const ownerUsername = String(payload.ownerUsername || '').trim();
		if (!ownerUsername) {
			throw appError('Unauthorized', 401);
		}

		if (payload.questionSetId) {
			const set = await prisma.questionSet.findUnique({
				where: { id: Number(payload.questionSetId) },
				select: { id: true, createdBy: true },
			});

			if (!set || String(set.createdBy || '').trim() !== ownerUsername) {
				throw appError('Question set not found', 404);
			}
		}

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

module.exports = roomService;
