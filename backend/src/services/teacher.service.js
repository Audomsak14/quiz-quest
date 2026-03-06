const { prisma } = require('./_shared/service-utils');

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const makeStudentKey = (playerId, playerName) => {
	const idKey = normalizeKey(playerId);
	if (idKey) return `id:${idKey}`;
	const nameKey = normalizeKey(playerName);
	if (nameKey) return `name:${nameKey}`;
	return '';
};

const teacherService = {
	async dashboard(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			return {
				studentsJoined: 0,
				averageScorePercent: 0,
				testsToday: 0,
			};
		}

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [attemptRows, roomPlayerRows, attemptsAgg, testsToday] = await Promise.all([
			prisma.gameAttempt.findMany({
				where: {
					room: {
						questionSet: {
							createdBy: owner,
						},
					},
				},
				select: {
					playerId: true,
					playerName: true,
				},
			}),
			prisma.roomPlayer.findMany({
				where: {
					room: {
						questionSet: {
							createdBy: owner,
						},
					},
				},
				select: {
					name: true,
				},
			}),
			prisma.gameAttempt.aggregate({
				where: {
					room: {
						questionSet: {
							createdBy: owner,
						},
					},
				},
				_avg: { score: true },
			}),
			prisma.room.count({
				where: {
					createdAt: { gte: todayStart },
					questionSet: {
						createdBy: owner,
					},
				},
			}),
		]);

		const uniqueStudents = new Set();
		attemptRows.forEach((item) => {
			const key = makeStudentKey(item.playerId, item.playerName);
			if (key) uniqueStudents.add(key);
		});
		roomPlayerRows.forEach((item) => {
			const key = makeStudentKey('', item.name);
			if (key) uniqueStudents.add(key);
		});

		return {
			studentsJoined: uniqueStudents.size,
			averageScorePercent: Number((attemptsAgg._avg.score || 0).toFixed(2)),
			testsToday,
		};
	},

	async students(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) return [];

		const [attemptRows, roomPlayerRows] = await Promise.all([
			prisma.gameAttempt.findMany({
				where: {
					room: {
						questionSet: {
							createdBy: owner,
						},
					},
				},
				select: {
					roomId: true,
					playerId: true,
					playerName: true,
					score: true,
					timestamp: true,
				},
			}),
			prisma.roomPlayer.findMany({
				where: {
					room: {
						questionSet: {
							createdBy: owner,
						},
					},
				},
				select: {
					roomId: true,
					name: true,
					joinedAt: true,
				},
			}),
		]);

		const map = new Map();

		attemptRows.forEach((item) => {
			const key = makeStudentKey(item.playerId, item.playerName);
			if (!key) return;

			if (!map.has(key)) {
				map.set(key, {
					key,
					playerId: item.playerId ? String(item.playerId) : null,
					playerName: item.playerName ? String(item.playerName) : 'ไม่ระบุชื่อ',
					attemptsCount: 0,
					bestScore: 0,
					lastPlayedAt: null,
					roomIds: new Set(),
				});
			}

			const row = map.get(key);
			row.attemptsCount += 1;
			row.bestScore = Math.max(Number(row.bestScore || 0), Number(item.score || 0));
			if (item.timestamp && (!row.lastPlayedAt || new Date(item.timestamp) > new Date(row.lastPlayedAt))) {
				row.lastPlayedAt = item.timestamp;
			}
			if (Number.isInteger(Number(item.roomId))) {
				row.roomIds.add(Number(item.roomId));
			}
			if (!row.playerName && item.playerName) row.playerName = String(item.playerName);
			if (!row.playerId && item.playerId) row.playerId = String(item.playerId);
		});

		roomPlayerRows.forEach((item) => {
			const key = makeStudentKey('', item.name);
			if (!key) return;

			if (!map.has(key)) {
				map.set(key, {
					key,
					playerId: null,
					playerName: item.name ? String(item.name) : 'ไม่ระบุชื่อ',
					attemptsCount: 0,
					bestScore: 0,
					lastPlayedAt: item.joinedAt || null,
					roomIds: new Set(),
				});
			}

			const row = map.get(key);
			if (Number.isInteger(Number(item.roomId))) {
				row.roomIds.add(Number(item.roomId));
			}
			if (item.joinedAt && (!row.lastPlayedAt || new Date(item.joinedAt) > new Date(row.lastPlayedAt))) {
				row.lastPlayedAt = item.joinedAt;
			}
		});

		return Array.from(map.values())
			.map((item) => ({
				playerId: item.playerId,
				playerName: item.playerName,
				attemptsCount: item.attemptsCount,
				bestScore: item.bestScore,
				roomsCount: item.roomIds.size,
				lastPlayedAt: item.lastPlayedAt,
			}))
			.sort((a, b) => {
				const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
				const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
				if (bTime !== aTime) return bTime - aTime;
				return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'th');
			});
	},

	async testsToday(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) return [];

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const rooms = await prisma.room.findMany({
			where: {
				createdAt: { gte: todayStart },
				questionSet: {
					createdBy: owner,
				},
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
