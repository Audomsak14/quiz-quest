const { gameService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

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

	deleteHistory: asyncHandler(async (req, res) => {
		const result = await gameService.deleteHistory(req.query);
		res.json({ success: true, ...result });
	}),
};

module.exports = gameController;
