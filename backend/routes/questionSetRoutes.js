import express from "express";
import QuestionSet from "../models/QuestionSet.js";

const router = express.Router();

// GET all question sets
router.get("/", async (req, res) => {
  try {
    const sets = await QuestionSet.find();
    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one question set
router.get("/:id", async (req, res) => {
  try {
    const set = await QuestionSet.findById(req.params.id);
    if (!set) return res.status(404).json({ error: "Not found" });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE question set
router.post("/", async (req, res) => {
  try {
    const newSet = new QuestionSet(req.body);
    await newSet.save();
    res.json(newSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE question set
router.put("/:id", async (req, res) => {
  try {
    const updated = await QuestionSet.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE question set
router.delete("/:id", async (req, res) => {
  try {
    await QuestionSet.findByIdAndDelete(req.params.id);
    res.json({ message: "ลบสำเร็จ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
