import mongoose from "mongoose";
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
