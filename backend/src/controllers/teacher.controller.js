const { teacherService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

const teacherController = {
	dashboard: asyncHandler(async (_req, res) => {
		const stats = await teacherService.dashboard();
		res.json({ success: true, stats });
	}),

	testsToday: asyncHandler(async (_req, res) => {
		const tests = await teacherService.testsToday();
		res.json({ success: true, tests });
	}),
};

module.exports = teacherController;
