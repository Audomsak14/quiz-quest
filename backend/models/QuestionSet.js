import mongoose from "mongoose";
<<<<<<< HEAD

const questionSetSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    default: ""
  },
  questions: [{
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['multiple-choice', 'true-false'], 
      default: 'multiple-choice' 
    }
  }],
  createdBy: {
    type: String, // จะเปลี่ยนเป็น ObjectId ถ้ามี User model
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  timeLimit: {
    type: Number, // เป็นวินาที
    default: 30
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  }
}, {
  timestamps: true // จะสร้าง createdAt และ updatedAt อัตโนมัติ
});

export default mongoose.model("QuestionSet", questionSetSchema);
=======
import { questionSchema } from "./Question.js";

const QuestionSetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  map: { type: String },
  questions: [questionSchema],
  scorePerQuestion: { type: Number, default: 1 },
  timePerQuestion: { type: Number, default: 30 }
}, { timestamps: true }); // สร้าง createdAt / updatedAt อัตโนมัติ

const QuestionSet = mongoose.model("QuestionSet", QuestionSetSchema);
export default QuestionSet;
>>>>>>> afc79e6c7ebbef6df76f4cff30c69ff4151a32ab
