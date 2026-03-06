const express = require('express');
const { teacherController } = require('../controllers');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('teacher'), teacherController.dashboard);
router.get('/tests-today', requireAuth, requireRole('teacher'), teacherController.testsToday);
router.get('/students', requireAuth, requireRole('teacher'), teacherController.students);

module.exports = router;
