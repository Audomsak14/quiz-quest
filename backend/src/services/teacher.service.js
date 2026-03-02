const { prisma } = require('./_shared/service-utils');

const teacherService = {
	async dashboard() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [studentsJoined, attemptsAgg, testsToday] = await Promise.all([
			prisma.roomPlayer.count({
				where: { kickedAt: null },
			}),
			prisma.gameAttempt.aggregate({
				_avg: { score: true },
			}),
			prisma.room.count({
				where: {
					createdAt: { gte: todayStart },
				},
			}),
		]);

		return {
			studentsJoined,
			averageScorePercent: Number((attemptsAgg._avg.score || 0).toFixed(2)),
			testsToday,
		};
	},
};

module.exports = teacherService;
