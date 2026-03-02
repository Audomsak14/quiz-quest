const express = require('express');
const { z } = require('zod');
const { roomController } = require('../controllers');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateBody, validateParams } = require('../middleware/validation.middleware');

const router = express.Router();

const idParamSchema = z.object({
	roomId: z.coerce.number().int().positive(),
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

router.post('/', requireAuth, validateBody(roomCreateSchema), roomController.create);
router.get('/by-code/:code', roomController.getByCode);
router.get('/:roomId', validateParams(idParamSchema), roomController.getById);
router.put('/:roomId', validateParams(idParamSchema), validateBody(roomUpdateSchema), roomController.update);
router.get('/:roomId/players', validateParams(idParamSchema), roomController.getPlayers);
router.post('/:roomId/join', validateParams(idParamSchema), validateBody(joinRoomSchema), roomController.join);
router.post('/:roomId/kick-all', validateParams(idParamSchema), roomController.kickAll);

module.exports = router;
