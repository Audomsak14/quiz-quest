const express = require('express');
const { teacherController } = require('../controllers');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/dashboard', requireAuth, teacherController.dashboard);
router.get('/tests-today', requireAuth, teacherController.testsToday);

module.exports = router;
