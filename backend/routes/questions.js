import express from "express";
import Question from "../models/Question.js";

const router = express.Router();

/// ดึงห้องทั้งหมด พร้อม populate questions
router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find().populate("questions"); // ✅ populate
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สร้างคำถามใหม่
router.post("/", async (req, res) => {
  const { title, options, answer } = req.body;
  try {
    const newQ = new Question({ title, options, answer });
    await newQ.save();
    res.json(newQ);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// แก้ไขคำถาม
router.put("/:id", async (req, res) => {
  try {
    const q = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// ลบคำถาม
router.delete("/:id", async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ message: "ลบสำเร็จ" });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
