const { Server } = require('socket.io');
const prisma = require('../config/prisma');

const roomStates = new Map();
const socketIndex = new Map();

const toRoomId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const roomChannel = (roomId) => `room:${roomId}`;

const sanitizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPublicPlayer = (player) => ({
  playerId: player.playerId,
  name: player.name,
  role: player.role,
  x: player.x,
  y: player.y,
  score: player.score,
  answeredCount: player.answered.size,
  completed: !!player.completed,
  completionTime: player.completionTime || null,
});

const toPublicRoomState = (room) => ({
  roomId: String(room.roomId),
  status: room.status,
  competition: room.competition,
  startedAt: room.startedAt,
  players: Array.from(room.players.values()).map(toPublicPlayer),
});

const emitRoomState = (io, roomId) => {
  const room = roomStates.get(roomId);
  if (!room) return;
  io.to(roomChannel(roomId)).emit('roomState', toPublicRoomState(room));
};

const ensureRoomState = async (roomId) => {
  if (roomStates.has(roomId)) {
    return roomStates.get(roomId);
  }

  const roomRecord = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!roomRecord) return null;

  const room = {
    roomId,
    status: roomRecord.status || 'waiting',
    competition: false,
    startedAt: null,
    players: new Map(),
  };

  roomStates.set(roomId, room);
  return room;
};

const emitGameResultsIfComplete = (io, roomId) => {
  const room = roomStates.get(roomId);
  if (!room) return;

  const students = Array.from(room.players.values()).filter((player) => player.role !== 'teacher');
  if (!students.length) return;

  const completed = students.filter((player) => player.completed);
  if (completed.length < students.length) {
    io.to(roomChannel(roomId)).emit('gameProgress', {
      roomId: String(roomId),
      totalPlayers: students.length,
      completedPlayers: completed.length,
    });
    return;
  }

  const rankings = completed
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.completionTime || Infinity) !== (b.completionTime || Infinity)) {
        return (a.completionTime || Infinity) - (b.completionTime || Infinity);
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'th');
    })
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.playerId,
      playerName: player.name,
      finalScore: player.score,
      completionTime: player.completionTime || null,
      questionsAnswered: player.answered.size,
      timestamp: Date.now(),
    }));

  io.to(roomChannel(roomId)).emit('gameResults', {
    roomId: String(roomId),
    totalPlayers: students.length,
    rankings,
    finishedAt: Date.now(),
  });
};

const removePlayerFromRoom = (io, roomId, playerId, reason = 'left') => {
  const room = roomStates.get(roomId);
  if (!room) return;

  if (!room.players.has(playerId)) return;
  room.players.delete(playerId);

  io.to(roomChannel(roomId)).emit('playerLeft', {
    roomId: String(roomId),
    playerId,
    reason,
  });

  emitRoomState(io, roomId);
};

const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('joinRoom', async (payload = {}) => {
      const roomId = toRoomId(payload.roomId);
      if (!roomId) return;

      const room = await ensureRoomState(roomId);
      if (!room) {
        socket.emit('roomState', { roomId: String(roomId), status: 'missing', players: [] });
        return;
      }

      const role = payload.role === 'teacher' ? 'teacher' : 'student';
      const name = String(payload.name || payload.playerName || 'Player').trim() || 'Player';
      const playerId = String(payload.playerId || `${name}_${socket.id}`);

      socket.join(roomChannel(roomId));

      const existing = room.players.get(playerId);
      const player = {
        playerId,
        name,
        role,
        x: sanitizeNumber(existing?.x, role === 'teacher' ? 100 : 420),
        y: sanitizeNumber(existing?.y, role === 'teacher' ? 120 : 540),
        score: sanitizeNumber(existing?.score, 0),
        answered: existing?.answered || new Set(),
        completed: !!existing?.completed,
        completionTime: existing?.completionTime || null,
        socketId: socket.id,
      };

      room.players.set(playerId, player);
      socketIndex.set(socket.id, { roomId, playerId });

      socket.emit('roomState', toPublicRoomState(room));
      socket.to(roomChannel(roomId)).emit('playerJoined', toPublicPlayer(player));
      emitRoomState(io, roomId);
    });

    socket.on('playerMove', (payload = {}) => {
      const index = socketIndex.get(socket.id);
      const roomId = toRoomId(payload.roomId) || index?.roomId;
      const playerId = String(payload.playerId || index?.playerId || '');
      if (!roomId || !playerId) return;

      const room = roomStates.get(roomId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      player.x = sanitizeNumber(payload.x, player.x);
      player.y = sanitizeNumber(payload.y, player.y);

      io.to(roomChannel(roomId)).emit('playerMoved', {
        roomId: String(roomId),
        playerId,
        x: player.x,
        y: player.y,
      });
    });

    socket.on('sendAnswer', (payload = {}) => {
      const index = socketIndex.get(socket.id);
      const roomId = toRoomId(payload.roomId) || index?.roomId;
      const playerId = String(payload.playerId || index?.playerId || '');
      if (!roomId || !playerId) return;

      const room = roomStates.get(roomId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      const questionId = String(payload.questionId || '');
      const earned = sanitizeNumber(payload.earned, 0);
      const alreadyAnswered = questionId ? player.answered.has(questionId) : false;
      if (!alreadyAnswered && questionId) {
        player.answered.add(questionId);
      }
      if (!alreadyAnswered) {
        player.score += earned;
      }

      const answerPayload = {
        roomId: String(roomId),
        playerId,
        playerName: player.name,
        questionId,
        selectedIndex: sanitizeNumber(payload.selectedIndex, 0),
        correct: !!payload.correct,
        earned: alreadyAnswered ? 0 : earned,
        score: player.score,
        answeredCount: player.answered.size,
        timestamp: payload.timestamp || Date.now(),
      };

      io.to(roomChannel(roomId)).emit('questionAnswered', answerPayload);
      io.to(roomChannel(roomId)).emit('answerSubmitted', answerPayload);
      io.to(roomChannel(roomId)).emit('gameProgress', {
        roomId: String(roomId),
        playerId,
        score: player.score,
        answeredCount: player.answered.size,
      });
      emitRoomState(io, roomId);
    });

    socket.on('gameCompleted', (payload = {}) => {
      const index = socketIndex.get(socket.id);
      const roomId = toRoomId(payload.roomId) || index?.roomId;
      const playerId = String(payload.playerId || index?.playerId || '');
      if (!roomId || !playerId) return;

      const room = roomStates.get(roomId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      const finalScore = sanitizeNumber(payload.finalScore, player.score);
      player.score = finalScore;
      player.completed = true;
      player.completionTime = sanitizeNumber(payload.completionTime, Date.now());

      io.to(roomChannel(roomId)).emit('gameProgress', {
        roomId: String(roomId),
        playerId,
        score: player.score,
        completed: true,
        completionTime: player.completionTime,
      });

      emitRoomState(io, roomId);
      emitGameResultsIfComplete(io, roomId);
    });

    socket.on('startGame', async (payload = {}) => {
      const roomId = toRoomId(payload.roomId);
      if (!roomId) return;

      const room = await ensureRoomState(roomId);
      if (!room) return;

      room.status = 'active';
      room.startedAt = Date.now();
      room.players.forEach((player) => {
        player.score = 0;
        player.answered = new Set();
        player.completed = false;
        player.completionTime = null;
      });

      try {
        await prisma.room.update({ where: { id: roomId }, data: { status: 'active' } });
      } catch {}

      io.to(roomChannel(roomId)).emit('gameStarted', {
        roomId: String(roomId),
        startedAt: room.startedAt,
      });
      emitRoomState(io, roomId);
    });

    socket.on('setCompetition', (payload = {}) => {
      const roomId = toRoomId(payload.roomId);
      if (!roomId) return;
      const room = roomStates.get(roomId);
      if (!room) return;

      room.competition = !!payload.enabled;
      io.to(roomChannel(roomId)).emit('competitionMode', {
        roomId: String(roomId),
        enabled: room.competition,
      });
      emitRoomState(io, roomId);
    });

    socket.on('kickPlayer', (payload = {}) => {
      const roomId = toRoomId(payload.roomId);
      const playerId = String(payload.playerId || '');
      if (!roomId || !playerId) return;

      const room = roomStates.get(roomId);
      if (!room) return;
      const target = room.players.get(playerId);
      if (!target) return;

      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit('kicked', { roomId: String(roomId), playerId });
        targetSocket.disconnect(true);
      }

      removePlayerFromRoom(io, roomId, playerId, 'kicked');
    });

    socket.on('returnToLobby', async (payload = {}) => {
      const roomId = toRoomId(payload.roomId);
      if (!roomId) return;

      const room = roomStates.get(roomId);
      if (!room) return;

      for (const player of room.players.values()) {
        if (player.role === 'teacher') continue;
        const targetSocket = io.sockets.sockets.get(player.socketId);
        if (targetSocket) {
          targetSocket.emit('kicked', { roomId: String(roomId), playerId: player.playerId });
          targetSocket.disconnect(true);
        }
      }

      room.status = 'waiting';
      room.startedAt = null;
      for (const [playerId, player] of room.players.entries()) {
        if (player.role !== 'teacher') {
          room.players.delete(playerId);
        }
      }

      try {
        await prisma.room.update({ where: { id: roomId }, data: { status: 'waiting' } });
      } catch {}

      emitRoomState(io, roomId);
    });

    socket.on('disconnect', () => {
      const index = socketIndex.get(socket.id);
      if (!index) return;

      socketIndex.delete(socket.id);

      const room = roomStates.get(index.roomId);
      if (!room) return;

      const player = room.players.get(index.playerId);
      if (!player) return;
      if (player.socketId !== socket.id) return;

      removePlayerFromRoom(io, index.roomId, index.playerId, 'disconnected');
    });
  });

  return io;
};

module.exports = {
  initializeSocketServer,
};
