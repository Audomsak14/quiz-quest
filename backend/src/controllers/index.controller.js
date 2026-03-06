const {
	authService,
	questionSetService,
	roomService,
	gameService,
	teacherService,
} = require('../services/index.service');

function asyncHandler(handler) {
	return async (req, res, next) => {
		try {
			await handler(req, res);
		} catch (error) {
			next(error);
		}
	};
}

const authController = {
	register: asyncHandler(async (req, res) => {
		const user = await authService.register(req.body);
		res.status(201).json({ success: true, user });
	}),

	login: asyncHandler(async (req, res) => {
		const result = await authService.login(req.body);
		res.json({ success: true, ...result });
	}),
};

const questionSetController = {
	list: asyncHandler(async (_req, res) => {
		const data = await questionSetService.list();
		res.json(data);
	}),

	getById: asyncHandler(async (req, res) => {
		const data = await questionSetService.getById(Number(req.params.setId));
		res.json(data);
	}),

	create: asyncHandler(async (req, res) => {
		const data = await questionSetService.create(req.body);
		res.status(201).json(data);
	}),

	update: asyncHandler(async (req, res) => {
		const data = await questionSetService.update(Number(req.params.setId), req.body);
		res.json(data);
	}),

	remove: asyncHandler(async (req, res) => {
		const data = await questionSetService.remove(Number(req.params.setId));
		res.json({ success: true, ...data });
	}),
};

const roomController = {
	create: asyncHandler(async (req, res) => {
		const room = await roomService.create({
			...req.body,
			questionSetId: req.body.questionSetId ? Number(req.body.questionSetId) : null,
		});
		res.status(201).json(room);
	}),

	getById: asyncHandler(async (req, res) => {
		const room = await roomService.getById(Number(req.params.roomId));
		res.json(room);
	}),

	getByCode: asyncHandler(async (req, res) => {
		const room = await roomService.getByCode(req.params.code);
		res.json(room);
	}),

	update: asyncHandler(async (req, res) => {
		const room = await roomService.updateRoom(Number(req.params.roomId), req.body);
		res.json(room);
	}),

	getPlayers: asyncHandler(async (req, res) => {
		const players = await roomService.getPlayers(Number(req.params.roomId));
		res.json(players);
	}),

	join: asyncHandler(async (req, res) => {
		const player = await roomService.joinRoom(Number(req.params.roomId), req.body);
		res.status(201).json({ success: true, player });
	}),

	kickAll: asyncHandler(async (req, res) => {
		const result = await roomService.kickAll(Number(req.params.roomId));
		res.json({ success: true, ...result });
	}),

	kickPlayer: asyncHandler(async (req, res) => {
		const roomId = Number(req.params.roomId);
		const playerId = Number(req.params.playerId);
		const result = await roomService.kickPlayer(roomId, playerId);
		res.json({ success: true, ...result });
	}),

	leave: asyncHandler(async (req, res) => {
		const roomId = Number(req.params.roomId);
		const playerId = Number(req.params.playerId);
		const result = await roomService.leaveRoom(roomId, playerId);
		res.json({ success: true, ...result });
	}),
};

const gameController = {
	getRoom: asyncHandler(async (req, res) => {
		const room = await gameService.getRoom(Number(req.params.roomId));
		res.json({ success: true, room });
	}),

	getQuestions: asyncHandler(async (req, res) => {
		const data = await gameService.getQuestions(Number(req.params.roomId));
		res.json({ success: true, ...data });
	}),

	getHistory: asyncHandler(async (req, res) => {
		const data = await gameService.getHistory(req.query);
		res.json({ success: true, ...data });
	}),

	getResults: asyncHandler(async (req, res) => {
		const data = await gameService.getResults(Number(req.params.roomId));
		res.json({ success: true, ...data });
	}),

	deleteHistory: asyncHandler(async (req, res) => {
		const result = await gameService.deleteHistory(req.query);
		res.json({ success: true, ...result });
	}),

	complete: asyncHandler(async (req, res) => {
		const result = await gameService.complete(req.body);
		res.json({ success: true, ...result });
	}),

	upsertState: asyncHandler(async (req, res) => {
		const result = await gameService.upsertLiveState(req.body);
		res.json({ success: true, ...result });
	}),

	getState: asyncHandler(async (req, res) => {
		const result = await gameService.getLiveState(Number(req.params.roomId));
		res.json({ success: true, ...result });
	}),
};

const teacherController = {
	dashboard: asyncHandler(async (_req, res) => {
		const stats = await teacherService.dashboard();
		res.json({ success: true, stats });
	}),

	todayParticipants: asyncHandler(async (req, res) => {
		if (req.user?.role !== 'teacher') {
			return res.status(403).json({ success: false, error: 'Forbidden' });
		}
		const data = await teacherService.todayParticipants();
		res.json({ success: true, ...data });
	}),
};

module.exports = {
	authController,
	questionSetController,
	roomController,
	gameController,
	teacherController,
};
