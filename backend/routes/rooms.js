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
    const { questionSetId, name, isActive } = req.body;

    // function to generate candidate code
    const gen = () => Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    // try few times to avoid duplicate key
    let room, attempts = 0;
    while (attempts < 5) {
      const code = gen();
      try {
        room = new Room({
          name: name || "ห้องใหม่",
          questionSetId,
          code,
          roomCode: code,
          status: 'waiting',
          isActive: isActive !== undefined ? isActive : true,
        });
        await room.save();
        break; // success
      } catch (e) {
        // duplicate code, retry
        if (e.code === 11000) {
          attempts += 1;
          continue;
        }
        throw e;
      }
    }

    if (!room) {
      return res.status(500).json({ error: 'ไม่สามารถสร้างโค้ดห้องที่ไม่ซ้ำได้' });
    }

    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get one room
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get players of a room
router.get('/:id/players', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room.players || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// อัปเดตห้อง
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const room = await Room.findByIdAndUpdate(
      id,
      update,
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
