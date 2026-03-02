const { authService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

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

module.exports = authController;
