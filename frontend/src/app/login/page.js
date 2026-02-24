'use client';

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Login() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [role, setRole] = useState("student");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  // ป้องกัน hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // โหลดข้อมูลที่จำไว้จากการสมัครสมาชิก
  useEffect(() => {
    if (isClient) {
      const rememberedUsername = localStorage.getItem("rememberedUsername");
      const rememberedPassword = localStorage.getItem("rememberedPassword");
      
      if (rememberedUsername) {
        setUser(rememberedUsername);
        localStorage.removeItem("rememberedUsername");
      }
      
      if (rememberedPassword) {
        setPass(rememberedPassword);
        localStorage.removeItem("rememberedPassword");
      }
    }
  }, [isClient]);

  const handleLogin = async () => {
    try {
      console.log("🔍 Attempting login with:", { username, role });
      
      const res = await axios.post("http://localhost:5000/api/auth/login", { username, password, role });
      
      console.log("✅ Login response:", res.data);
      
      // ล้าง storage เก่าก่อน (ระวังอย่าลบ character/player UI ที่ไม่เกี่ยวกับบัญชี)
      try { sessionStorage.clear(); } catch {}
      try {
        const preserveKeys = [
          'selectedCharacter','selectedCharacterName','selectedCharacterImage','playerName','playerImage','customCharacterImages'
        ];
        const preserved = {};
        for (const k of preserveKeys) preserved[k] = localStorage.getItem(k);
        localStorage.clear();
        for (const [k,v] of Object.entries(preserved)) if (v !== null) localStorage.setItem(k, v);
      } catch {}

      // เก็บ token และข้อมูลผู้ใช้ (sessionStorage เป็นหลัก เพื่อแยกแต่ละแท็บ/บัญชี)
      try {
        sessionStorage.setItem("token", res.data.token);
        sessionStorage.setItem("role", res.data.user.role);
        sessionStorage.setItem("userId", res.data.user.id);
        sessionStorage.setItem("username", res.data.user.username);
      } catch {}
      // ซ้ำใน localStorage เพื่อความเข้ากันได้ย้อนหลัง (frontend ส่วนอื่นอ่านจาก localStorage)
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);
      localStorage.setItem("userId", res.data.user.id);
      localStorage.setItem("username", res.data.user.username);
      
      console.log("💾 Stored in localStorage:", {
        role: res.data.user.role,
        username: res.data.user.username
      });
      
  await Swal.fire({ icon: 'success', title: 'ล็อกอินสำเร็จ!', timer: 1200, showConfirmButton: false });
      
      // นำทางไปแดชบอร์ดตาม role
      if (role === "teacher") {
        console.log("🧑‍🏫 Redirecting to TeacherDashboard");
        router.push("/TeacherDashboard");
      } else {
        console.log("👨‍🎓 Redirecting to StudentDashboard");
        router.push("/StudentDashboard");
      }
      
    } catch (err) {
  console.error("❌ Login error:", err);
  console.error("📋 Error response:", err.response?.data);

  const isNetwork = !err.response;
  const message = isNetwork
    ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ตรวจว่า backend รันที่ http://localhost:5000 และเปิด MongoDB แล้ว)'
    : (err.response?.data?.error || err.message);

  await Swal.fire({ icon: 'error', title: 'ล็อกอินไม่สำเร็จ', text: message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-700 font-medium">ยินดีต้อนรับสู่ Quiz Quest</p>
        </div>

        {/* แสดงฟอร์มเฉพาะเมื่อ client render เสร็จแล้ว */}
        {isClient && (
          <div className="space-y-6">
            {/* Username Input */}
            <div className="relative">
              <input 
                type="text"
                placeholder="ชื่อผู้ใช้" 
                value={username}
                onChange={e => setUser(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white text-gray-900 placeholder-gray-500 font-medium"
                suppressHydrationWarning
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Password Input */}
            <div className="relative">
              <input 
                type="password" 
                placeholder="รหัสผ่าน" 
                value={password}
                onChange={e => setPass(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white text-gray-900 placeholder-gray-500 font-medium"
                suppressHydrationWarning
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            {/* Role Selection */}
            <div className="space-y-3">
              <p className="text-gray-700 font-medium text-center">เลือกประเภทผู้ใช้</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                    role === "student"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105"
                      : "bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                  suppressHydrationWarning
                >
                  👨‍🎓 นักเรียน
                </button>
                <button
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                    role === "teacher"
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transform scale-105"
                      : "bg-white border-2 border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50"
                  }`}
                  suppressHydrationWarning
                >
                  👩‍🏫 ครู
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button 
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              suppressHydrationWarning
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}

        {/* Loading state ถ้ายังไม่ได้ render ฝั่ง client */}
        {!isClient && (
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="h-12 bg-gray-200 rounded-lg"></div>
                <div className="h-12 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="h-12 bg-purple-200 rounded-lg"></div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-gray-800">
            ยังไม่มีบัญชี? 
            <a href="/register" className="text-purple-600 hover:text-purple-800 font-semibold ml-1 transition-colors duration-300">
              สมัครสมาชิก
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}