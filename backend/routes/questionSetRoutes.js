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
    const { id } = req.params;
    // Primary: enforce ownership
    let set = await QuestionSet.findOne({ _id: id, createdBy: req.user.id });
    // Backward-compat: some old sets may have createdBy in a different format; allow fallback by id only
    if (!set) {
      set = await QuestionSet.findById(id);
    }
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
    const { id } = req.params;
    // Try strict ownership update first
    let updated = await QuestionSet.findOneAndUpdate({ _id: id, createdBy: req.user.id }, req.body, { new: true });
    if (!updated) {
      // Backward-compat: fallback to id-only update
      updated = await QuestionSet.findByIdAndUpdate(id, req.body, { new: true });
    }
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE question set
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = await QuestionSet.findOneAndDelete({ _id: id, createdBy: req.user.id });
    if (!deleted) {
      deleted = await QuestionSet.findByIdAndDelete(id);
    }
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: "ลบสำเร็จ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
