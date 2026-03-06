const { questionSetService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

const questionSetController = {
	list: asyncHandler(async (req, res) => {
		const data = await questionSetService.list(req.user);
		res.json(data);
	}),

	getById: asyncHandler(async (req, res) => {
		const data = await questionSetService.getById(Number(req.params.setId), req.user);
		res.json(data);
	}),

	create: asyncHandler(async (req, res) => {
		const data = await questionSetService.create(req.body, req.user);
		res.status(201).json(data);
	}),

	update: asyncHandler(async (req, res) => {
		const data = await questionSetService.update(Number(req.params.setId), req.body, req.user);
		res.json(data);
	}),

	remove: asyncHandler(async (req, res) => {
		const data = await questionSetService.remove(Number(req.params.setId), req.user);
		res.json({ success: true, ...data });
	}),
};

module.exports = questionSetController;
