// backend/routes/rooms.js
import express from "express";
import Room from "../models/Room.js";

const router = express.Router();

// ดึงห้องทั้งหมด
router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สร้างห้องใหม่
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    const room = new Room({ name, description });
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// อัปเดตห้อง
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const room = await Room.findByIdAndUpdate(
      id,
      { name, description },
      { new: true }
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ลบห้อง
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Room.findByIdAndDelete(id);
    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
