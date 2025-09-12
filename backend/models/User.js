import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ตอนนี้ใช้ plain text password ก่อน (ไม่ปลอดภัย แต่เพื่อการทดสอบ)
userSchema.pre('save', async function(next) {
  // ไม่ hash password ในขณะนี้
  next();
});

// Method สำหรับตรวจสอบรหัสผ่าน (เปรียบเทียบแบบธรรมดา)
userSchema.methods.comparePassword = async function(candidatePassword) {
  return candidatePassword === this.password;
};

export default mongoose.model("User", userSchema);