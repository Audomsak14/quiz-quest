import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  options: { type: [String], required: true },
  answer: { type: String, required: true },
});

export default mongoose.model("Question", questionSchema);
