import express from "express";
import Question from "../models/Question.js";
import QuestionSet from "../models/QuestionSet.js";

const router = express.Router();

// ============= QUESTION SETS ROUTES =============

// ดึง Question Sets ทั้งหมด
router.get("/sets", async (req, res) => {
  try {
    const questionSets = await QuestionSet.find()
      .sort({ createdAt: -1 }); // เรียงตาม วันที่สร้างล่าสุด
    res.json(questionSets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ดึง Question Set ตาม ID
router.get("/sets/:id", async (req, res) => {
  try {
    const questionSet = await QuestionSet.findById(req.params.id);
    if (!questionSet) {
      return res.status(404).json({ error: "ไม่พบชุดคำถาม" });
    }
    res.json(questionSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สร้าง Question Set ใหม่
router.post("/sets", async (req, res) => {
  try {
    const { title, description, questions, createdBy, timeLimit, difficulty } = req.body;
    
    const newQuestionSet = new QuestionSet({
      title,
      description,
      questions,
      createdBy: createdBy || "anonymous", // ถ้าไม่มี createdBy ให้ใช้ anonymous
      timeLimit,
      difficulty
    });
    
    const savedSet = await newQuestionSet.save();
    res.status(201).json(savedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// แก้ไข Question Set
router.put("/sets/:id", async (req, res) => {
  try {
    const updatedSet = await QuestionSet.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    
    if (!updatedSet) {
      return res.status(404).json({ error: "ไม่พบชุดคำถาม" });
    }
    
    res.json(updatedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ลบ Question Set
router.delete("/sets/:id", async (req, res) => {
  try {
    const deletedSet = await QuestionSet.findByIdAndDelete(req.params.id);
    
    if (!deletedSet) {
      return res.status(404).json({ error: "ไม่พบชุดคำถาม" });
    }
    
    res.json({ message: "ลบชุดคำถามสำเร็จ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= INDIVIDUAL QUESTIONS ROUTES (เก่า) =============

// ดึงคำถามทั้งหมด
router.get("/", async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
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
