const prisma = require('../../config/prisma');

function appError(message, statusCode = 400) {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
}

function toMongoLikeId(value) {
	return String(value);
}

function generateRoomCode(length = 6) {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueRoomCode() {
	for (let index = 0; index < 8; index += 1) {
		const code = generateRoomCode();
		const existing = await prisma.room.findUnique({ where: { code } });
		if (!existing) {
			return code;
		}
	}

	throw appError('Unable to generate room code', 500);
}

function mapRoom(room) {
	return {
		_id: toMongoLikeId(room.id),
		id: room.id,
		code: room.code,
		name: room.name,
		status: room.status,
		isActive: room.isActive,
		questionSetId: room.questionSetId ? toMongoLikeId(room.questionSetId) : null,
		createdAt: room.createdAt,
		updatedAt: room.updatedAt,
	};
}

function mapQuestionSet(questionSet) {
	return {
		_id: toMongoLikeId(questionSet.id),
		id: questionSet.id,
		title: questionSet.title,
		description: questionSet.description,
		createdBy: questionSet.createdBy,
		timeLimit: questionSet.timeLimit,
		map: questionSet.map,
		questions: (questionSet.questions || []).map((question) => ({
			_id: toMongoLikeId(question.id),
			id: question.id,
			question: question.question,
			type: question.type,
			options: Array.isArray(question.options) ? question.options : [],
			correctAnswer: question.correctAnswer,
			points: question.points,
		})),
		createdAt: questionSet.createdAt,
		updatedAt: questionSet.updatedAt,
	};
}

module.exports = {
	prisma,
	appError,
	toMongoLikeId,
	generateUniqueRoomCode,
	mapRoom,
	mapQuestionSet,
};
