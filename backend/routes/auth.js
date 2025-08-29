import express from "express";
const router = express.Router();

// ตัวอย่าง route สำหรับ auth
router.post("/login", (req, res) => {
  res.json({ message: "Login success" });
});

router.post("/register", (req, res) => {
  res.json({ message: "Register success" });
});

export default router;   // ✅ export router ออกไป
