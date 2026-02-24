import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from "./routes/auth.js";
import questionRoutes from "./routes/questions.js";
import questionSetRoutes from "./routes/questionSetRoutes.js";
import Room from "./models/Room.js";
import roomRoutes from "./routes/rooms.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const httpServer = createServer(app);
let io;
const PORT = process.env.PORT || 5000;

// Middleware
const devLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl/postman) and same-origin requests
    if (!origin) return callback(null, true);

    // In dev, allow any localhost/loopback port to avoid CORS issues when Next.js chooses another port
    if (process.env.NODE_ENV !== 'production' && devLocalhostOrigin.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

// เชื่อมต่อ MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/quizapp");

mongoose.connection.on("connected", async () => {
  console.log("✅ Connected to MongoDB");
  // Backfill room codes for existing documents and ensure unique index
  try {
    const gen = () => Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const needsFix = await Room.find({ $or: [ { roomCode: { $exists: false } }, { roomCode: null }, { roomCode: '' } ] });
    if (needsFix.length) {
      for (const r of needsFix) {
        let attempts = 0;
        while (attempts < 5) {
          const code = gen();
          const exists = await Room.findOne({ roomCode: code });
          if (!exists) {
            r.roomCode = code;
            r.code = code;
            await r.save();
            break;
          }
          attempts++;
        }
      }
    }
    // Ensure unique index only when roomCode exists (avoid null duplicate issues)
    await Room.collection.createIndex(
      { roomCode: 1 },
      { unique: true, partialFilterExpression: { roomCode: { $exists: true, $type: 'string' } } }
    );
  } catch (e) {
    console.error("⚠️ Room code backfill/index ensure failed:", e.message);
  }
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/questionsets", questionSetRoutes);
// Backward compatibility alias: allow /api/questions/sets/* to access question set routes
app.use("/api/questions/sets", questionSetRoutes);
app.use("/api/rooms", roomRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Quiz Quest Backend API" });
});

// Game API endpoints
// Get questions for a specific room/game
app.get("/api/game/questions/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Find the room to get questionSetId
    const room = await Room.findById(roomId).populate('questionSetId');
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (!room.questionSetId) {
      return res.status(400).json({ error: "Room has no associated question set" });
    }

    // Get questions from the question set
    const questionSet = room.questionSetId;
    
    // Transform questions to game format (no hard limit)
    const total = Array.isArray(questionSet.questions) ? questionSet.questions.length : 0;
    // Map size used by frontend MapGameNew
    const MAP_WIDTH = 1200;
    const MAP_HEIGHT = 800;
    // We'll layout in 2 columns to keep spacing clear
    const cols = 2;
    const rows = Math.max(1, Math.ceil(total / cols));
    const xPositions = [200, 800]; // left/right columns
    const topMargin = 120;
    const bottomMargin = 80;
    const usableHeight = Math.max(100, MAP_HEIGHT - topMargin - bottomMargin);
    const rowGap = rows > 1 ? Math.floor(usableHeight / (rows - 1)) : 0;

    const gameQuestions = questionSet.questions.map((q, index) => {
      // Find correct answer index
      let answerIndex = 0;
      if (typeof q.correctAnswer === 'string') {
        answerIndex = q.options.findIndex(option => option === q.correctAnswer);
        if (answerIndex === -1) answerIndex = 0; // Fallback
      } else {
        answerIndex = q.correctAnswer;
      }

      // Position within 2-column grid that adapts to number of rows
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = xPositions[col] || 200;
      const y = topMargin + row * rowGap;

      return {
        id: `q${index + 1}`,
        text: q.question,
        choices: q.options,
        answerIndex: answerIndex,
        points: q.points || 100,
        x,
        y
      };
    });

    res.json({
      success: true,
      roomId,
      questionSetTitle: questionSet.title,
      questions: gameQuestions
    });

  } catch (error) {
    console.error("Error fetching game questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

// Get room info for game
app.get("/api/game/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findById(roomId).populate('questionSetId');
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      success: true,
      room: {
        id: room._id,
        name: room.name,
        description: room.description,
        status: room.status,
        questionSetId: room.questionSetId?._id,
        questionSetTitle: room.questionSetId?.title || 'Unknown'
      }
    });

  } catch (error) {
    console.error("Error fetching room info:", error);
    res.status(500).json({ error: "Failed to fetch room info" });
  }
});

// Get game history for a player (by playerId preferred, name fallback)
// Query: ?playerId=<id>&name=<playerName>&limit=50
app.get("/api/game/history", async (req, res) => {
  try {
    const playerIdQ = (req.query.playerId || "").trim();
    const name = (req.query.name || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    if (!playerIdQ && !name) {
      return res.status(400).json({ error: "Missing playerId or name" });
    }

    // Fetch rooms that contain this player's completed records (by id first, else by name)
    const filter = playerIdQ
      ? { "gameData.completedPlayers.playerId": playerIdQ }
      : { "gameData.completedPlayers.playerName": name };
  const rooms = await Room.find(filter).populate('questionSetId').lean();

    // Flatten attempts
    const attempts = [];
    // Precompute per-room rankings for quick lookup
    const perRoomRanks = new Map(); // roomId -> { key -> rank, total }
    for (const room of rooms) {
      const allEntries = Array.isArray(room.gameData?.completedPlayers) ? room.gameData.completedPlayers : [];

      // Build ranks for this room once
      if (!perRoomRanks.has(String(room._id))) {
        const sorted = allEntries.slice().sort((a, b) => {
          if ((a.finalScore ?? 0) !== (b.finalScore ?? 0)) return (b.finalScore ?? 0) - (a.finalScore ?? 0);
          return (a.completionTime ?? Infinity) - (b.completionTime ?? Infinity);
        });
        const rankMap = new Map();
        sorted.forEach((e, idx) => {
          const key = `${e.playerId || e.playerName || 'anon'}@${new Date(e.timestamp || 0).getTime()}`;
          rankMap.set(key, idx + 1);
        });
        perRoomRanks.set(String(room._id), { rankMap, total: sorted.length });
      }

      const entries = allEntries.filter(p => playerIdQ ? (p.playerId === playerIdQ) : (p.playerName === name));
      const qsArr = Array.isArray(room?.questionSetId?.questions) ? room.questionSetId.questions : null;
      const questionsTotal = qsArr ? qsArr.length : undefined;
      const maxPoints = qsArr ? qsArr.reduce((s, q) => s + (typeof q.points === 'number' ? q.points : 100), 0) : null;
      for (const e of entries) {
        const key = `${(e.playerId || e.playerName || 'anon')}@${new Date(e.timestamp || 0).getTime()}`;
        const rankInfo = perRoomRanks.get(String(room._id));
        attempts.push({
          roomId: String(room._id),
          roomName: room.name || 'ห้องไม่ทราบชื่อ',
          roomCode: room.roomCode || room.code,
          questionSetId: room.questionSetId?._id ? String(room.questionSetId._id) : undefined,
          questionSetTitle: room.questionSetId?.title || 'ไม่ทราบชุดข้อสอบ',
          finalScore: e.finalScore ?? 0,
          completionTime: e.completionTime ?? null,
          questionsAnswered: e.questionsAnswered ?? null,
          questionsTotal: Number.isInteger(questionsTotal) ? questionsTotal : null,
          maxPoints: Number.isFinite(maxPoints) ? maxPoints : null,
          rank: rankInfo?.rankMap?.get(key) || null,
          totalPlayers: rankInfo?.total || null,
          correctCount: typeof e.correctCount === 'number' ? e.correctCount : null,
          answers: Array.isArray(e.answers) ? e.answers.map(a => ({
            questionId: a.questionId || null,
            selectedIndex: typeof a.selectedIndex === 'number' ? a.selectedIndex : null,
            correct: !!a.correct,
            earned: typeof a.earned === 'number' ? a.earned : null,
            timestamp: a.timestamp ? new Date(a.timestamp).getTime() : null
          })) : [],
          partial: !!e.partial,
          timestamp: e.timestamp ? new Date(e.timestamp).getTime() : null
        });
      }
    }

    // Sort newest first and clamp to limit
    attempts.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
    const sliced = attempts.slice(0, limit);

    // Summaries
    const totalAttempts = attempts.length;
    const uniqueRooms = new Set(attempts.map(a => a.roomId));
    const totalTests = uniqueRooms.size;
    const avg = totalAttempts ? (attempts.reduce((s,a)=>s+(a.finalScore||0),0)/totalAttempts) : 0;
    const best = attempts.reduce((m,a)=> Math.max(m, a.finalScore||0), 0);

    // Per-room aggregation
    const perRoom = {};
    for (const a of attempts) {
      if (!perRoom[a.roomId]) {
        perRoom[a.roomId] = { roomId: a.roomId, roomName: a.roomName, questionSetTitle: a.questionSetTitle, attempts: 0, bestScore: 0, latestAt: 0 };
      }
      perRoom[a.roomId].attempts += 1;
      perRoom[a.roomId].bestScore = Math.max(perRoom[a.roomId].bestScore, a.finalScore||0);
      perRoom[a.roomId].latestAt = Math.max(perRoom[a.roomId].latestAt, a.timestamp||0);
    }

    res.json({
      success: true,
      playerName: name || null,
      playerId: playerIdQ || null,
      summary: {
        totalTests,
        totalAttempts,
        averageScore: Math.round(avg * 10) / 10,
        bestScore: best
      },
      attempts: sliced,
      perRoom: Object.values(perRoom).sort((a,b)=> (b.latestAt||0) - (a.latestAt||0))
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Initialize Socket.IO
io = new SocketIOServer(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true
  }
});

// In-memory live room state (lightweight realtime layer)
// roomsLive: roomId -> {
//   players: Map<playerId, { name, x, y, role, socketId }>,
//   answers: Map<playerId, Array<{questionId, selectedIndex, correct, earned, timestamp}>>,
//   startedAt?: number,
//   competition?: boolean,
//   kicked?: Map<playerId, number> // until timestamp ms when player can rejoin
// }
const roomsLive = new Map();

// Store game completion results for rankings
// gameResults: roomId -> [{ playerId, playerName, finalScore, completionTime, questionsAnswered, timestamp }]
const gameResults = new Map();

io.on("connection", (socket) => {
  // join real-time room
  socket.on("joinRoom", async ({ roomId, playerId, name, x = 50, y = 40, role = 'student' } = {}) => {
    if (!roomId || !playerId) return;

    // Ensure in-memory room exists before any DB ops so we can always respond
    let room = roomsLive.get(roomId);
    if (!room) {
      room = { players: new Map(), answers: new Map(), kicked: new Map() };
      roomsLive.set(roomId, room);
    }
    // Ensure kicked map exists
    if (!room.kicked) room.kicked = new Map();
    // Ensure answers map exists
    if (!room.answers) room.answers = new Map();

    // If player was recently kicked, block join for a short period
    try {
      const now = Date.now();
      // clean up expired bans
      for (const [pid, until] of room.kicked.entries()) {
        if (!until || until <= now) room.kicked.delete(pid);
      }
      const until = room.kicked.get(playerId);
      if (until && until > now) {
        // Inform client and do not add to players list
        socket.emit('kicked', { roomId, reason: 'temporarily-banned' });
        try { socket.disconnect(true); } catch {}
        return;
      }
    } catch { /* noop */ }

    try {
  socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerId = playerId;
      socket.data.role = role;

  // Track player in memory immediately (dedupe by playerId)
      // Track socket id for this player to kick old sockets if needed
      const existing = room.players.get(playerId);
      room.players.set(playerId, { name: name || "Player", x, y, role, socketId: socket.id });

      // If there was a previous socket for same playerId in the room, notify a left event
      // so clients can drop the old avatar (optional safety)
      if (existing && existing.socketId && existing.socketId !== socket.id) {
        socket.to(roomId).emit("playerLeft", { playerId });
      }

      // Enforce unique student name per room (case-insensitive, trimmed)
      try {
        const norm = String(name || '').trim().toLowerCase();
        if (role === 'student' && norm) {
          for (const [pid, info] of room.players.entries()) {
            if (pid === playerId) continue;
            const normOther = String(info?.name || '').trim().toLowerCase();
            if (normOther && normOther === norm && info?.role !== 'teacher') {
              room.players.delete(pid);
              io.to(roomId).emit('playerLeft', { playerId: pid });
              console.log(`♻️ Replaced existing player with same name '${name}' in room ${roomId}: removed ${pid}, kept ${playerId}`);
              break;
            }
          }
        }
      } catch { /* no-op */ }

      // Try to persist to DB and read status, but don't fail the join if DB errors
      let roomStatus = 'waiting';
      try {
        await Room.findByIdAndUpdate(
          roomId,
          {
            $addToSet: {
              players: {
                name: name || "Player",
                playerId,
                score: 0,
                x,
                y,
                questionsAnswered: []
              }
            }
          },
          { upsert: false }
        );

        const roomDoc = await Room.findById(roomId);
        roomStatus = roomDoc?.status || 'waiting';
      } catch (dbErr) {
        console.warn('joinRoom DB sync warning:', dbErr.message);
      }

      console.log(`✅ ${name || "Player"} (${role}) joined room ${roomId}`);

      // send current room state to this client with status (dedupe by playerId)
      const playersArr = Array.from(room.players.entries()).map(([id, v]) => ({ playerId: id, ...v }));
      const uniquePlayers = Array.from(new Map(playersArr.map(p => [p.playerId, p])).values());
      // Try to include authoritative startedAt
      let startedAtTs = roomsLive.get(roomId)?.startedAt;
  const competitionMode = roomsLive.get(roomId)?.competition || false;
      if (!startedAtTs && roomStatus === 'active') {
        // derive from DB if available
        const startedDoc = await Room.findById(roomId).select('gameData.startedAt');
        if (startedDoc?.gameData?.startedAt) {
          startedAtTs = new Date(startedDoc.gameData.startedAt).getTime();
          const r = roomsLive.get(roomId) || { players: new Map() };
          r.startedAt = startedAtTs;
          roomsLive.set(roomId, r);
        }
      }
      socket.emit("roomState", {
        players: uniquePlayers,
        status: roomStatus,
        startedAt: startedAtTs || null,
        competition: competitionMode
      });

  // notify others (idempotent: receivers should overwrite by playerId)
  socket.to(roomId).emit("playerJoined", { playerId, name: name || "Player", x, y, role });

    } catch (error) {
      console.error('Error in joinRoom (non-DB):', error);

      // fallback - send room state without DB update
      const safeRoom = room || { players: new Map() };
      socket.emit("roomState", {
        players: Array.from(safeRoom.players.entries()).map(([id, v]) => ({ playerId: id, ...v })),
        status: 'waiting'
      });
    }
  });

  // movement broadcast
  socket.on("playerMove", ({ roomId, playerId, x, y } = {}) => {
    if (!roomId || !playerId) return;
    const room = roomsLive.get(roomId);
    if (room && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      p.x = x; p.y = y;
    }
    socket.to(roomId).emit("playerMoved", { playerId, x, y });
  });

  // Kick a player (teacher-only action in UI; server trusts request)
  socket.on('kickPlayer', ({ roomId, playerId } = {}) => {
    if (!roomId || !playerId) return;
    const room = roomsLive.get(roomId);
    if (!room) return;
    const info = room.players.get(playerId);
    // Mark player as kicked for a short duration to prevent instant rejoin
    const KICK_TTL_MS = 60 * 1000; // 1 minute temporary block
    try {
      if (!room.kicked) room.kicked = new Map();
      room.kicked.set(playerId, Date.now() + KICK_TTL_MS);
    } catch { /* noop */ }
    if (info?.socketId) {
      // Notify the player first and then disconnect slightly later to allow packet delivery
      io.to(info.socketId).emit('kicked', { roomId, reason: 'kicked-by-teacher' });
      const target = io.sockets.sockets.get(info.socketId);
      if (target) {
        try { setTimeout(() => { try { target.disconnect(true); } catch { /* noop */ } }, 150); } catch { /* noop */ }
      }
      console.log(`👢 Kicked player ${playerId} (socket ${info.socketId}) from room ${roomId}`);
    } else if (room.players.has(playerId)) {
      // Fallback if socket not found: remove and broadcast manually
      room.players.delete(playerId);
      io.to(roomId).emit('playerLeft', { playerId });
      console.log(`👢 Kicked player ${playerId} from room ${roomId} (no socket)`);
    }
  });

  // Teacher ends session and forces all students back to their lobby
  socket.on('returnToLobby', async ({ roomId } = {}) => {
    try {
      if (!roomId) return;
      const room = roomsLive.get(roomId);
      if (!room) return;
      // Broadcast to all sockets in the room (catch-all)
      try { io.to(roomId).emit('kicked', { roomId, reason: 'return-to-lobby' }); } catch { /* noop */ }
      for (const [pid, info] of room.players.entries()) {
        // Skip teachers
        if (info?.role === 'teacher') continue;
        if (info?.socketId) {
          try {
            io.to(info.socketId).emit('kicked', { roomId, reason: 'return-to-lobby' });
            const target = io.sockets.sockets.get(info.socketId);
            if (target) setTimeout(() => { try { target.disconnect(true); } catch {} }, 100);
          } catch { /* noop */ }
        }
      }
      // Clear non-teacher players from memory
      try {
        for (const [pid, info] of Array.from(room.players.entries())) {
          if (info?.role !== 'teacher') room.players.delete(pid);
        }
      } catch { /* noop */ }

      // Reset DB room status to waiting
      try {
        await Room.findByIdAndUpdate(roomId, { status: 'waiting' });
      } catch {}

      console.log(`↩️  Forced return-to-lobby for all students in room ${roomId}`);
    } catch (e) {
      console.error('Error in returnToLobby:', e);
    }
  });

  // When a player finishes manually (not necessarily all questions), persist a partial snapshot
  socket.on("playerFinished", async ({ roomId, playerId, score, timestamp } = {}) => {
    try {
      if (!roomId || !playerId) return;
      const room = roomsLive.get(roomId);
      const answersArr = Array.isArray(room?.answers?.get(playerId)) ? room.answers.get(playerId) : [];
      const correctCount = answersArr.filter(a => a && a.correct === true).length;
      const finalScore = Number.isFinite(score) ? score : answersArr.reduce((s, a) => s + (Number(a.earned) || 0), 0);
      let totalQuestions = null;
      try {
        const roomDoc = await Room.findById(roomId).populate('questionSetId');
        if (roomDoc?.questionSetId?.questions) totalQuestions = roomDoc.questionSetId.questions.length;
      } catch {}
      const startedAt = roomsLive.get(roomId)?.startedAt;
      const nowTs = timestamp || Date.now();
      const serverElapsed = typeof startedAt === 'number' ? Math.max(0, nowTs - startedAt) : null;

      await Room.findByIdAndUpdate(
        roomId,
        {
          $addToSet: {
            "gameData.completedPlayers": {
              playerId,
              playerName: roomsLive.get(roomId)?.players?.get(playerId)?.name || 'Player',
              partial: true,
              finalScore,
              completionTime: serverElapsed,
              questionsAnswered: answersArr.length,
              correctCount,
              totalQuestions: Number.isInteger(totalQuestions) ? totalQuestions : null,
              answers: answersArr.map(a => ({
                questionId: String(a.questionId || ''),
                selectedIndex: typeof a.selectedIndex === 'number' ? a.selectedIndex : null,
                correct: !!a.correct,
                earned: typeof a.earned === 'number' ? a.earned : null,
                timestamp: a.timestamp ? new Date(a.timestamp) : new Date()
              })),
              timestamp: new Date(nowTs)
            }
          }
        }
      );
    } catch (err) {
      console.warn('playerFinished snapshot failed:', err.message);
    }
  });

  // Allow teacher to toggle competition mode for a room (students compete, teacher watches)
  socket.on('setCompetition', ({ roomId, enabled } = {}) => {
    if (!roomId) return;
    const room = roomsLive.get(roomId) || { players: new Map() };
    room.competition = !!enabled;
    roomsLive.set(roomId, room);
    io.to(roomId).emit('competitionMode', { roomId, enabled: !!enabled });
    console.log(`🏁 Competition mode for room ${roomId} set to ${!!enabled}`);
  });

  // quiz events passthrough
  socket.on("sendAnswer", (payload = {}) => {
    if (!payload.roomId) return;
    // Relay to others
    socket.to(payload.roomId).emit("answerSubmitted", payload);
    try {
      const { roomId, playerId, questionId, selectedIndex, correct, earned, timestamp } = payload;
      if (!roomId || !playerId) return;
      const room = roomsLive.get(roomId) || null;
      if (!room) return;
      if (!room.answers) room.answers = new Map();
      const arr = room.answers.get(playerId) || [];
      arr.push({ questionId, selectedIndex, correct: !!correct, earned: Number(earned) || 0, timestamp: timestamp ? new Date(timestamp).getTime() : Date.now() });
      room.answers.set(playerId, arr);
    } catch { /* noop */ }
  });
  socket.on("nextQuestion", (payload = {}) => {
    if (!payload.roomId) return;
    io.to(payload.roomId).emit("nextQuestion", payload);
  });
  socket.on("playerFinished", (payload = {}) => {
    if (!payload.roomId) return;
    socket.to(payload.roomId).emit("playerFinished", payload);
  });

  // Handle game completion
  socket.on("gameCompleted", async ({ roomId, playerId, playerName, finalScore, completionTime, questionsAnswered, timestamp } = {}) => {
    if (!roomId || !playerId) {
      console.log("❌ gameCompleted event received but missing required data");
      return;
    }

    try {
  const startedAt = roomsLive.get(roomId)?.startedAt;
  const nowTs = timestamp || Date.now();
  const serverElapsed = typeof startedAt === 'number' ? Math.max(0, nowTs - startedAt) : completionTime;
  console.log(`🏆 Game completed by ${playerName} in room ${roomId} - Score: ${finalScore}, Time: ${serverElapsed}ms (server)`);

      // Store game result in memory
      if (!gameResults.has(roomId)) {
        gameResults.set(roomId, []);
      }
      
      // Gather per-question answers if tracked
      const answersArr = Array.isArray(roomsLive.get(roomId)?.answers?.get(playerId))
        ? roomsLive.get(roomId).answers.get(playerId)
        : [];
      const correctCount = answersArr.filter(a => a && a.correct === true).length;

      // Try to get total questions from DB
      let totalQuestions = null;
      try {
        const roomDoc = await Room.findById(roomId).populate('questionSetId');
        if (roomDoc?.questionSetId?.questions) totalQuestions = roomDoc.questionSetId.questions.length;
      } catch { /* noop */ }

      const result = {
        playerId,
        playerName,
        partial: false,
        finalScore,
        completionTime: serverElapsed,
        questionsAnswered,
        correctCount: Number.isFinite(correctCount) ? correctCount : null,
        totalQuestions: Number.isInteger(totalQuestions) ? totalQuestions : null,
        answers: answersArr.map(a => ({
          questionId: String(a.questionId || ''),
          selectedIndex: typeof a.selectedIndex === 'number' ? a.selectedIndex : null,
          correct: !!a.correct,
          earned: typeof a.earned === 'number' ? a.earned : null,
          timestamp: a.timestamp ? new Date(a.timestamp) : new Date()
        })),
        timestamp: timestamp || Date.now()
      };
      
      gameResults.get(roomId).push(result);

      // Update database with completion data
      await Room.findByIdAndUpdate(
        roomId,
        {
          $addToSet: {
            "gameData.completedPlayers": {
              playerId,
              playerName,
              partial: false,
              finalScore,
              completionTime: serverElapsed,
              questionsAnswered,
              correctCount: Number.isFinite(correctCount) ? correctCount : null,
              totalQuestions: Number.isInteger(totalQuestions) ? totalQuestions : null,
              answers: result.answers,
              timestamp: new Date(result.timestamp)
            }
          },
          $set: {
            "players.$[player].score": finalScore,
            "players.$[player].completedAt": new Date(),
            "players.$[player].completionTime": completionTime,
            "players.$[player].questionsAnswered": Array.from({length: questionsAnswered}, (_, i) => `q${i + 1}`)
          }
        },
        {
          arrayFilters: [{ "player.playerId": playerId }],
          upsert: false
        }
      );

      // Calculate and update rankings for this room
      const roomResults = gameResults.get(roomId);
      const rankings = roomResults
        .slice() // Make a copy
        .sort((a, b) => {
          // Primary sort: Higher score wins
          if (a.finalScore !== b.finalScore) {
            return b.finalScore - a.finalScore;
          }
          // Secondary sort: Lower completion time wins (if scores are equal)
          return a.completionTime - b.completionTime;
        })
        .map((result, index) => ({
          ...result,
          rank: index + 1
        }));

      // Broadcast the updated rankings to all players in the room
      io.to(roomId).emit("gameResults", {
        roomId,
        completedPlayer: result,
        rankings: rankings
      });

      console.log(`📊 Rankings updated for room ${roomId}:`, rankings);

    } catch (error) {
      console.error("Error handling game completion:", error);
    }
  });

  // Persist a partial attempt snapshot on disconnect if student answered anything
  socket.on('disconnect', async () => {
    try {
      const roomId = socket.data?.roomId;
      const playerId = socket.data?.playerId;
      const role = socket.data?.role;
      if (!roomId || !playerId || role === 'teacher') return;
      const room = roomsLive.get(roomId);
      const answersArr = Array.isArray(room?.answers?.get(playerId)) ? room.answers.get(playerId) : [];
      if (!answersArr.length) return; // nothing to save
      const correctCount = answersArr.filter(a => a && a.correct === true).length;
      const finalScore = answersArr.reduce((s, a) => s + (Number(a.earned) || 0), 0);
      let totalQuestions = null;
      try {
        const roomDoc = await Room.findById(roomId).populate('questionSetId');
        if (roomDoc?.questionSetId?.questions) totalQuestions = roomDoc.questionSetId.questions.length;
      } catch {}
      const startedAt = roomsLive.get(roomId)?.startedAt;
      const nowTs = Date.now();
      const serverElapsed = typeof startedAt === 'number' ? Math.max(0, nowTs - startedAt) : null;
      await Room.findByIdAndUpdate(roomId, {
        $addToSet: {
          "gameData.completedPlayers": {
            playerId,
            playerName: roomsLive.get(roomId)?.players?.get(playerId)?.name || 'Player',
            partial: true,
            finalScore,
            completionTime: serverElapsed,
            questionsAnswered: answersArr.length,
            correctCount,
            totalQuestions: Number.isInteger(totalQuestions) ? totalQuestions : null,
            answers: answersArr.map(a => ({
              questionId: String(a.questionId || ''),
              selectedIndex: typeof a.selectedIndex === 'number' ? a.selectedIndex : null,
              correct: !!a.correct,
              earned: typeof a.earned === 'number' ? a.earned : null,
              timestamp: a.timestamp ? new Date(a.timestamp) : new Date()
            })),
            timestamp: new Date(nowTs)
          }
        }
      });
    } catch (e) {
      console.warn('disconnect snapshot failed:', e.message);
    }
  });

  // Start game event
  socket.on("startGame", async ({ roomId } = {}) => {
    if (!roomId) {
      console.log("❌ startGame event received but no roomId provided");
      return;
    }
    
    try {
      console.log(`🎮 Game started in room ${roomId} - broadcasting to all players`);

      const startedAt = Date.now();

      // Update database room status and start time
      await Room.findByIdAndUpdate(
        roomId,
        {
          status: 'active',
          'gameData.startedAt': new Date(startedAt)
        }
      );

      // Save to in-memory live state
      const r = roomsLive.get(roomId) || { players: new Map() };
      r.startedAt = startedAt;
      roomsLive.set(roomId, r);

      // Broadcast to all players in the room with server timestamp
      io.to(roomId).emit("gameStarted", { roomId, startedAt });
      console.log(`📡 gameStarted event broadcasted to room ${roomId} at ${startedAt}`);
      
    } catch (error) {
      console.error("Error starting game:", error);
      // Still broadcast even if DB update fails
      const fallback = Date.now();
      const rr = roomsLive.get(roomId) || { players: new Map() };
      rr.startedAt = rr.startedAt || fallback;
      roomsLive.set(roomId, rr);
      io.to(roomId).emit("gameStarted", { roomId, startedAt: rr.startedAt });
    }
  });

  socket.on("disconnect", () => {
    const { roomId, playerId } = socket.data || {};
    if (roomId && playerId) {
      const room = roomsLive.get(roomId);
      if (room) {
        const info = room.players.get(playerId);
        room.players.delete(playerId);
        socket.to(roomId).emit("playerLeft", { playerId });
        // If a controlling teacher leaves, do NOT auto-kick students.
        // Teachers can explicitly end sessions using 'returnToLobby' or 'kick-all'.
        // We still log for observability.
        if (info?.role === 'teacher') {
          console.log(`👋 Teacher left room ${roomId}; students remain in session.`);
        }
        if (room.players.size === 0) roomsLive.delete(roomId);
      }
    }
  });
});

// HTTP endpoint: Kick all students in a room (force disconnect + set room to waiting)
app.post('/api/rooms/:roomId/kick-all', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

    // Only owner can kick-all in this room
    const roomDoc = await Room.findById(roomId);
    if (!roomDoc) return res.status(404).json({ error: 'Room not found' });
    if (String(roomDoc.ownerId || '') !== String(req.user.id || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Broadcast kick event to everyone in the room first
    try { io.to(roomId).emit('kicked', { roomId, reason: 'kick-all' }); } catch {}

    // Disconnect all non-teacher sockets currently in this room
    let kickedCount = 0;
    try {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        const role = s?.data?.role || 'student';
        if (role !== 'teacher') {
          kickedCount += 1;
          // slight delay to allow kicked event to flush
          setTimeout(() => { try { s.disconnect(true); } catch {} }, 100);
        }
      }
    } catch {}

    // Clear in-memory students and apply a short rejoin ban
    try {
      const r = roomsLive.get(roomId);
      if (r) {
        if (!r.kicked) r.kicked = new Map();
        const until = Date.now() + 60 * 1000; // 1 minute temporary block
        for (const [pid, info] of Array.from(r.players.entries())) {
          if (info?.role !== 'teacher') {
            r.players.delete(pid);
            r.kicked.set(pid, until);
          }
        }
      }
    } catch {}

    // Reset room status in DB to 'waiting'
    try { await Room.findByIdAndUpdate(roomId, { status: 'waiting' }); } catch {}

    console.log(`👢 Kick-all executed for room ${roomId} (kicked ${kickedCount} sockets)`);
    return res.json({ ok: true, kicked: kickedCount });
  } catch (e) {
    console.error('kick-all error:', e);
    return res.status(500).json({ error: 'Failed to kick all' });
  }
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Delete history for a player
// DELETE /api/game/history?playerId=... [optional: roomId=..., ts=epoch_ms]
app.delete("/api/game/history", async (req, res) => {
  try {
    const playerId = (req.query.playerId || '').trim();
    const roomId = (req.query.roomId || '').trim();
    const ts = req.query.ts ? new Date(Number(req.query.ts)) : null;
    if (!playerId) return res.status(400).json({ error: 'Missing playerId' });

    if (roomId && ts && !isNaN(ts.getTime())) {
      // Delete a specific attempt in one room by exact timestamp
      const r = await Room.updateOne(
        { _id: roomId },
        { $pull: { 'gameData.completedPlayers': { playerId, timestamp: ts } } }
      );
      return res.json({ success: true, deleted: r.modifiedCount || 0 });
    }

    // Delete all attempts for this player across all rooms
    const r = await Room.updateMany(
      { 'gameData.completedPlayers.playerId': playerId },
      { $pull: { 'gameData.completedPlayers': { playerId } } }
    );
    res.json({ success: true, deletedRooms: r.modifiedCount || 0 });
  } catch (e) {
    console.error('Error deleting history:', e);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});