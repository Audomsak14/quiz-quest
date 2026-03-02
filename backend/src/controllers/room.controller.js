const { roomService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

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
};

module.exports = roomController;
