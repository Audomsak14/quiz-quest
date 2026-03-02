const { questionSetService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

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

module.exports = questionSetController;
