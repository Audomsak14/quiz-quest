// backend/models/Room.js
import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
}, { timestamps: true });

const Room = mongoose.model("Room", RoomSchema);
export default Room;
