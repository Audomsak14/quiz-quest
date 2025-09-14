'use client';

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Register() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  // ป้องกัน hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleRegister = async () => {
    // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
      await Swal.fire({ icon: 'warning', title: 'รหัสผ่านไม่ตรงกัน', text: 'กรุณาตรวจสอบอีกครั้ง' });
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน
    if (password.length < 6) {
      await Swal.fire({ icon: 'warning', title: 'รหัสผ่านสั้นเกินไป', text: 'ต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/auth/register", { username, password });
      
      // เก็บข้อมูลไว้ใน localStorage เพื่อจำไว้
      localStorage.setItem("rememberedUsername", username);
      localStorage.setItem("rememberedPassword", password);
      
      await Swal.fire({ icon: 'success', title: 'สมัครสำเร็จ!', timer: 1200, showConfirmButton: false });
      router.push("/login");
      
    } catch (err) {
  await Swal.fire({ icon: 'error', title: 'สมัครไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">สมัครสมาชิก</h1>
          <p className="text-gray-700 font-medium">เข้าร่วมกับ Quiz Quest</p>
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

            {/* Confirm Password Input */}
            <div className="relative">
              <input 
                type="password" 
                placeholder="ยืนยันรหัสผ่าน" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white text-gray-900 placeholder-gray-500 font-medium"
                suppressHydrationWarning
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="text-sm">
                <div className={`${password.length >= 6 ? 'text-green-600' : 'text-red-500'} flex items-center`}>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    {password.length >= 6 ? (
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    )}
                  </svg>
                  {password.length >= 6 ? 'รหัสผ่านแข็งแรงพอ' : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'}
                </div>
                {confirmPassword && (
                  <div className={`${password === confirmPassword ? 'text-green-600' : 'text-red-500'} flex items-center mt-1`}>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      {password === confirmPassword ? (
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      )}
                    </svg>
                    {password === confirmPassword ? 'รหัสผ่านตรงกัน' : 'รหัสผ่านไม่ตรงกัน'}
                  </div>
                )}
              </div>
            )}

            {/* Register Button */}
            <button 
              onClick={handleRegister}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              suppressHydrationWarning
            >
              สมัครสมาชิก
            </button>
          </div>
        )}

        {/* Loading state ถ้ายังไม่ได้ render ฝั่ง client */}
        {!isClient && (
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
              <div className="h-12 bg-purple-200 rounded-lg"></div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-gray-800">
            มีบัญชีอยู่แล้ว? 
            <a href="/login" className="text-purple-600 hover:text-purple-800 font-semibold ml-1 transition-colors duration-300">
              เข้าสู่ระบบ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}