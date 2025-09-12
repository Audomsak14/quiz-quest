import express from "express";
import User from "../models/User.js";

const router = express.Router();

// สมัครสมาชิก
router.post("/register", async (req, res) => {
  try {
    console.log("📝 Register request:", req.body);
    
    const { username, password } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!username || !password) {
      console.log("❌ Missing username or password");
      return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }

    // ตรวจสอบความยาวรหัสผ่าน
    if (password.length < 6) {
      console.log("❌ Password too short");
      return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    }

    // ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log("❌ Username already exists:", username);
      return res.status(400).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
    }

    console.log("✅ Creating new user:", username);
    
    // สร้างผู้ใช้ใหม่
    const newUser = new User({
      username,
      password
    });

    const savedUser = await newUser.save();
    console.log("✅ User saved successfully:", savedUser._id);

    res.status(201).json({ 
      message: "สมัครสมาชิกสำเร็จ",
      user: {
        id: savedUser._id,
        username: savedUser.username
      }
    });

  } catch (error) {
    console.error("💥 Register error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
    }
    
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการสมัครสมาชิก: " + error.message });
  }
});

// เข้าสู่ระบบ
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    console.log("🔍 Login attempt:", { username, role, hasPassword: !!password });

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!username || !password || !role) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วนและเลือกประเภทผู้ใช้" });
    }

    // ค้นหาผู้ใช้
    const user = await User.findOne({ username });
    if (!user) {
      console.log("❌ User not found:", username);
      return res.status(400).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    
    console.log("✅ User found:", { id: user._id, username: user.username });

    // ตรวจสอบรหัสผ่าน
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password for user:", username);
      return res.status(400).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    
    console.log("✅ Password valid for user:", username);
    console.log("🎭 Selected role:", role);

    // สร้าง simple token (ไม่ใช้ JWT ก่อน)
    const token = `simple_token_${user._id}_${role}_${Date.now()}`;
    
    console.log("🎫 Token created for:", { username, role });

    const responseData = {
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: role // ส่ง role ที่เลือกกลับไป
      }
    };
    
    console.log("📤 Sending response:", responseData);
    res.json(responseData);

  } catch (error) {
    console.error("💥 Login error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ: " + error.message });
  }
});

export default router;
