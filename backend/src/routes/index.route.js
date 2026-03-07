const express = require('express');
const { z } = require('zod');
const {
	authController,
	questionSetController,
	roomController,
	gameController,
	teacherController,
} = require('../controllers/index.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateBody, validateParams } = require('../middleware/validation.middleware');

const router = express.Router();

const idParamSchema = z.object({
	roomId: z.coerce.number().int().positive(),
});

const kickPlayerParamSchema = z.object({
	roomId: z.coerce.number().int().positive(),
	playerId: z.coerce.number().int().positive(),
});

const setIdParamSchema = z.object({
	setId: z.coerce.number().int().positive(),
});

const registerSchema = z.object({
	username: z.string().trim().min(3),
	password: z.string().min(6),
	role: z.enum(['student', 'teacher']).optional(),
});

const loginSchema = z.object({
	username: z.string().trim().min(1),
	password: z.string().min(1),
	role: z.enum(['student', 'teacher']).optional(),
});

const questionSchema = z.object({
	question: z.string().trim().min(1),
	type: z.string().trim().min(1).optional(),
	options: z.array(z.string().trim().min(1)).min(2),
	correctAnswer: z.string().trim().min(1),
	points: z.number().int().positive().optional(),
});

const questionSetSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().optional(),
	createdBy: z.string().optional(),
	timeLimit: z.number().int().positive().optional(),
	map: z.string().optional(),
	questions: z.array(questionSchema).min(1),
});

const roomCreateSchema = z.object({
	questionSetId: z.coerce.number().int().positive(),
	name: z.string().trim().min(1).optional(),
	isActive: z.boolean().optional(),
});

const roomUpdateSchema = z.object({
	status: z.enum(['waiting', 'active', 'ended']),
});

const joinRoomSchema = z.object({
	name: z.string().trim().min(1),
});

const gameCompleteSchema = z.object({
	roomId: z.coerce.number().int().positive(),
	playerId: z.string().trim().min(1).optional().nullable(),
	playerName: z.string().trim().min(1),
	finalScore: z.coerce.number().int().nonnegative(),
	completionTime: z.coerce.number().int().nonnegative().optional(),
	questionsAnswered: z.coerce.number().int().nonnegative().optional(),
});

const gameStateSchema = z.object({
	roomId: z.coerce.number().int().positive(),
	playerId: z.string().trim().min(1),
	playerName: z.string().trim().min(1),
	x: z.coerce.number(),
	y: z.coerce.number(),
	score: z.coerce.number().int().nonnegative().optional(),
	answered: z.coerce.number().int().nonnegative().optional(),
	mode: z.string().trim().min(1).optional(),
	ts: z.coerce.number().int().nonnegative().optional(),
});

const teacherDeleteTodayParticipantSchema = z.object({
	name: z.string().trim().min(1),
});

router.post('/auth/register', validateBody(registerSchema), authController.register);
router.post('/auth/login', validateBody(loginSchema), authController.login);

router.get('/questions/sets', questionSetController.list);
router.get('/questions/sets/:setId', validateParams(setIdParamSchema), questionSetController.getById);
router.post('/questions/sets', requireAuth, validateBody(questionSetSchema), questionSetController.create);
router.put('/questions/sets/:setId', requireAuth, validateParams(setIdParamSchema), validateBody(questionSetSchema), questionSetController.update);
router.delete('/questions/sets/:setId', requireAuth, validateParams(setIdParamSchema), questionSetController.remove);

router.post('/rooms', requireAuth, validateBody(roomCreateSchema), roomController.create);
router.get('/rooms/by-code/:code', roomController.getByCode);
router.get('/rooms/:roomId', validateParams(idParamSchema), roomController.getById);
router.put('/rooms/:roomId', validateParams(idParamSchema), validateBody(roomUpdateSchema), roomController.update);
router.get('/rooms/:roomId/players', validateParams(idParamSchema), roomController.getPlayers);
router.post('/rooms/:roomId/join', validateParams(idParamSchema), validateBody(joinRoomSchema), roomController.join);
router.post('/rooms/:roomId/leave/:playerId', validateParams(kickPlayerParamSchema), roomController.leave);
router.post('/rooms/:roomId/kick-all', validateParams(idParamSchema), roomController.kickAll);
router.post('/rooms/:roomId/kick/:playerId', validateParams(kickPlayerParamSchema), roomController.kickPlayer);

router.get('/game/room/:roomId', validateParams(idParamSchema), gameController.getRoom);
router.get('/game/questions/:roomId', validateParams(idParamSchema), gameController.getQuestions);
router.get('/game/results/:roomId', validateParams(idParamSchema), gameController.getResults);
router.get('/game/history', gameController.getHistory);
router.delete('/game/history', gameController.deleteHistory);
router.post('/game/complete', validateBody(gameCompleteSchema), gameController.complete);

// Live state (REST fallback for spectator mode when Socket.IO server isn't running)
router.post('/game/state', validateBody(gameStateSchema), gameController.upsertState);
router.get('/game/state/:roomId', validateParams(idParamSchema), gameController.getState);

router.get('/teacher/dashboard', requireAuth, teacherController.dashboard);
router.get('/teacher/today-participants', requireAuth, teacherController.todayParticipants);
router.get('/teacher/today-tests', requireAuth, teacherController.todayTests);
router.post('/teacher/today-participants/delete', requireAuth, validateBody(teacherDeleteTodayParticipantSchema), teacherController.deleteTodayParticipant);

module.exports = router;
