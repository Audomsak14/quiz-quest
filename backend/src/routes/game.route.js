const express = require('express');
const { z } = require('zod');
const { gameController } = require('../controllers');
const { validateParams } = require('../middleware/validation.middleware');

const router = express.Router();

const idParamSchema = z.object({
	roomId: z.coerce.number().int().positive(),
});

router.get('/room/:roomId', validateParams(idParamSchema), gameController.getRoom);
router.get('/questions/:roomId', validateParams(idParamSchema), gameController.getQuestions);
router.delete('/history/room/:roomId', validateParams(idParamSchema), gameController.clearRoomHistory);
router.get('/history', gameController.getHistory);
router.post('/history', gameController.createHistory);
router.delete('/history', gameController.deleteHistory);

module.exports = router;
