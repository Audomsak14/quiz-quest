const { teacherService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

const teacherController = {
	dashboard: asyncHandler(async (req, res) => {
		const stats = await teacherService.dashboard(req.user);
		res.json({ success: true, stats });
	}),

	testsToday: asyncHandler(async (req, res) => {
		const tests = await teacherService.testsToday(req.user);
		res.json({ success: true, tests });
	}),

	students: asyncHandler(async (req, res) => {
		const students = await teacherService.students(req.user);
		res.json({ success: true, students });
	}),
};

module.exports = teacherController;
