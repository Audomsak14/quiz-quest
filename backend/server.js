import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import questionRoutes from "./routes/questions.js";
import roomRoutes from "./routes/rooms.js";

const app = express();
app.use(cors());
app.use(express.json());

// เชื่อม MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/quizapp")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/rooms", roomRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));
