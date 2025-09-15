import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import questionRoutes from "./routes/questions.js";
import questionSetRoutes from "./routes/questionSetRoutes.js";
import Room from "./models/Room.js";
import roomRoutes from "./routes/rooms.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
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
app.use("/api/rooms", roomRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Quiz Quest Backend API" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});