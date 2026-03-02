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

	async testsToday() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const rooms = await prisma.room.findMany({
			where: {
				createdAt: { gte: todayStart },
			},
			include: {
				questionSet: {
					select: {
						title: true,
					},
				},
				_count: {
					select: {
						players: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return rooms.map((room) => ({
			id: room.id,
			code: room.code,
			name: room.name,
			status: room.status,
			questionSetTitle: room.questionSet?.title || 'ไม่ระบุชุดคำถาม',
			playersCount: room._count?.players || 0,
			createdAt: room.createdAt,
		}));
	},
};

module.exports = teacherService;
