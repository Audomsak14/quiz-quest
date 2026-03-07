const { teacherService } = require('../services');
const asyncHandler = require('./_shared/async-handler');

const teacherController = {
	dashboard: asyncHandler(async (req, res) => {
		const stats = await teacherService.dashboard(req.user);
		res.json({ success: true, stats });
	}),

	todayParticipants: asyncHandler(async (req, res) => {
		if (req.user?.role !== 'teacher') {
			return res.status(403).json({ success: false, error: 'Forbidden' });
		}
		const data = await teacherService.todayParticipants();
		res.json({ success: true, ...data });
	}),

	todayTests: asyncHandler(async (req, res) => {
		if (req.user?.role !== 'teacher') {
			return res.status(403).json({ success: false, error: 'Forbidden' });
		}
		const data = await teacherService.todayTests();
		res.json({ success: true, ...data });
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
