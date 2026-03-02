const express = require('express');
const { z } = require('zod');
const { authController } = require('../controllers');
const { validateBody } = require('../middleware/validation.middleware');

const router = express.Router();

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

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);

module.exports = router;
