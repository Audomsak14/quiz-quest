const express = require('express');
const authRoutes = require('./auth.route');
const questionSetRoutes = require('./question-set.route');
const roomRoutes = require('./room.route');
const gameRoutes = require('./game.route');
const teacherRoutes = require('./teacher.route');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/questions', questionSetRoutes);
router.use('/rooms', roomRoutes);
router.use('/game', gameRoutes);
router.use('/teacher', teacherRoutes);

module.exports = router;
