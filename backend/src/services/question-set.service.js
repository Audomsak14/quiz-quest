const { prisma, appError, mapQuestionSet } = require('./_shared/service-utils');

const questionSetService = {
	async list(user) {
		const owner = String(user?.username || '').trim();
		if (!owner) return [];

		const sets = await prisma.questionSet.findMany({
			where: { createdBy: owner },
			include: { questions: true },
			orderBy: { createdAt: 'desc' },
		});

		return sets.map(mapQuestionSet);
	},

	async getById(id, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const set = await prisma.questionSet.findUnique({
			where: { id },
			include: { questions: true },
		});

		if (!set || String(set.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		return mapQuestionSet(set);
	},

	async create(payload, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const data = await prisma.questionSet.create({
			data: {
				title: payload.title,
				description: payload.description || '',
				createdBy: owner,
				timeLimit: payload.timeLimit || 30,
				map: payload.map || null,
				questions: {
					create: payload.questions.map((question) => ({
						question: question.question,
						type: question.type || 'multiple-choice',
						options: question.options,
						correctAnswer: question.correctAnswer,
						points: question.points || 1,
					})),
				},
			},
			include: { questions: true },
		});

		return mapQuestionSet(data);
	},

	async update(id, payload, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing || String(existing.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		const updated = await prisma.$transaction(async (transaction) => {
			await transaction.question.deleteMany({ where: { questionSetId: id } });

			return transaction.questionSet.update({
				where: { id },
				data: {
					title: payload.title,
					description: payload.description || '',
					createdBy: owner,
					timeLimit: payload.timeLimit || 30,
					map: payload.map || null,
					questions: {
						create: payload.questions.map((question) => ({
							question: question.question,
							type: question.type || 'multiple-choice',
							options: question.options,
							correctAnswer: question.correctAnswer,
							points: question.points || 1,
						})),
					},
				},
				include: { questions: true },
			});
		});

		return mapQuestionSet(updated);
	},

	async remove(id, user) {
		const owner = String(user?.username || '').trim();
		if (!owner) {
			throw appError('Unauthorized', 401);
		}

		const existing = await prisma.questionSet.findUnique({ where: { id } });
		if (!existing || String(existing.createdBy || '').trim() !== owner) {
			throw appError('Question set not found', 404);
		}

		await prisma.questionSet.delete({ where: { id } });
		return { deleted: true };
	},
};

module.exports = questionSetService;
