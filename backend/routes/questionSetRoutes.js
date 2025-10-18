import express from "express";
import QuestionSet from "../models/QuestionSet.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET all question sets
router.get("/", requireAuth, async (req, res) => {
  try {
    const sets = await QuestionSet.find({ createdBy: req.user.id });
    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one question set
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const set = await QuestionSet.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!set) return res.status(404).json({ error: "Not found" });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE question set
router.post("/", requireAuth, async (req, res) => {
  try {
    const body = { ...req.body, createdBy: req.user.id };
    const newSet = new QuestionSet(body);
    await newSet.save();
    res.json(newSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE question set
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await QuestionSet.findOneAndUpdate({ _id: req.params.id, createdBy: req.user.id }, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE question set
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await QuestionSet.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    res.json({ message: "ลบสำเร็จ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
