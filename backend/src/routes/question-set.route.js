const express = require('express');
const { z } = require('zod');
const { questionSetController } = require('../controllers');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateBody, validateParams } = require('../middleware/validation.middleware');

const router = express.Router();

const setIdParamSchema = z.object({
	setId: z.coerce.number().int().positive(),
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

router.get('/sets', questionSetController.list);
router.get('/sets/:setId', validateParams(setIdParamSchema), questionSetController.getById);
router.post('/sets', requireAuth, validateBody(questionSetSchema), questionSetController.create);
router.put('/sets/:setId', requireAuth, validateParams(setIdParamSchema), validateBody(questionSetSchema), questionSetController.update);
router.delete('/sets/:setId', requireAuth, validateParams(setIdParamSchema), questionSetController.remove);

module.exports = router;
