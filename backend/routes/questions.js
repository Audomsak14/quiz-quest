import express from "express";
import QuestionSet from "../models/QuestionSet.js";

const router = express.Router();

// GET all question sets
router.get("/sets", async (req, res) => {
  try {
    console.log("📋 Fetching all question sets");
    const sets = await QuestionSet.find();
    console.log(`✅ Found ${sets.length} question sets`);
    res.json(sets);
  } catch (err) {
    console.error("❌ Error fetching question sets:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET one question set
router.get("/sets/:id", async (req, res) => {
  try {
    console.log("🔍 Fetching question set:", req.params.id);
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      return res.status(404).json({ error: "Question set not found" });
    }
    res.json(set);
  } catch (err) {
    console.error("❌ Error fetching question set:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE question set
router.post("/sets", async (req, res) => {
  try {
    console.log("📝 Creating new question set:", req.body.title);
    const newSet = new QuestionSet(req.body);
    const savedSet = await newSet.save();
    console.log("✅ Question set created:", savedSet._id);
    res.status(201).json(savedSet);
  } catch (err) {
    console.error("❌ Error creating question set:", err);
    res.status(400).json({ error: err.message });
  }
});

// UPDATE question set
router.put("/sets/:id", async (req, res) => {
  try {
    console.log("✏️ Updating question set:", req.params.id);
    const updatedSet = await QuestionSet.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    if (!updatedSet) {
      return res.status(404).json({ error: "Question set not found" });
    }
    console.log("✅ Question set updated:", updatedSet._id);
    res.json(updatedSet);
  } catch (err) {
    console.error("❌ Error updating question set:", err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE question set
router.delete("/sets/:id", async (req, res) => {
  try {
    console.log("🗑️ Deleting question set:", req.params.id);
    const deletedSet = await QuestionSet.findByIdAndDelete(req.params.id);
    if (!deletedSet) {
      return res.status(404).json({ error: "Question set not found" });
    }
    console.log("✅ Question set deleted:", deletedSet._id);
    res.json({ message: "Question set deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting question set:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;