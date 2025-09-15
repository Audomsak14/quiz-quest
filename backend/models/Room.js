// backend/models/Room.js
import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  questionSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet' },
  // Keep both fields for backward compatibility with existing index "roomCode_1"
  code: { type: String, index: true },
  roomCode: { type: String, unique: true, index: true },
  status: { type: String, enum: ['waiting', 'active', 'ended'], default: 'waiting' },
  isActive: { type: Boolean, default: true },
  players: [{
    name: String,
    joinedAt: { type: Date, default: Date.now },
    score: { type: Number, default: 0 }
  }]
}, { timestamps: true });

// Ensure code and roomCode are in sync and never null
RoomSchema.pre('validate', function(next) {
  if (!this.code && this.roomCode) {
    this.code = this.roomCode;
  }
  if (!this.roomCode && this.code) {
    this.roomCode = this.code;
  }
  next();
});

const Room = mongoose.model("Room", RoomSchema);
export default Room;
