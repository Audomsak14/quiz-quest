"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ตรวจสอบว่าล็อกอินแล้วหรือยัง
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const storedUsername = localStorage.getItem("username");
    
    if (!token || role !== "student") {
      router.push("/login");
      return;
    }
    
    setUsername(storedUsername || "");
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E]">
        <div className="animate-pulse text-white text-lg font-bold bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          กำลังโหลด...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E]">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center space-y-2 md:space-y-0 bg-white/90 backdrop-blur-sm px-8 py-5 rounded-2xl drop-shadow-[0_4px_16px_rgba(97,12,159,0.10)]">
        <div>
          <h1 className="text-4xl font-bold text-[#610C9F] drop-shadow-[0_4px_8px_rgba(97,12,159,0.5)]">
            แดชบอร์ดนักเรียน
          </h1>
          <p className="text-xl text-[#940B92] font-semibold drop-shadow-[0_4px_8px_rgba(148,11,146,0.5)]">
            ยินดีต้อนรับ {username}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg"
        >
          ออกจากระบบ
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quiz Available Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] p-8 transform hover:scale-[1.02] transition-all duration-300">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-[#610C9F] to-[#940B92] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[#610C9F] mb-2">แบบทดสอบ</h3>
            <p className="text-[#940B92] mb-4">เข้าร่วมแบบทดสอบออนไลน์</p>
            <button className="bg-gradient-to-r from-[#610C9F] to-[#940B92] text-white px-6 py-3 rounded-lg hover:from-[#940B92] hover:to-[#DA0C81] transition-all duration-300 font-semibold">
              เข้าร่วมแบบทดสอบ
            </button>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] p-8 transform hover:scale-[1.02] transition-all duration-300">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-[#940B92] to-[#DA0C81] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[#610C9F] mb-2">ผลคะแนน</h3>
            <p className="text-[#940B92] mb-4">ดูผลคะแนนการทดสอบ</p>
            <button className="bg-gradient-to-r from-[#940B92] to-[#DA0C81] text-white px-6 py-3 rounded-lg hover:from-[#DA0C81] hover:to-[#E95793] transition-all duration-300 font-semibold">
              ดูผลคะแนน
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] p-8 transform hover:scale-[1.02] transition-all duration-300">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-[#DA0C81] to-[#E95793] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[#610C9F] mb-2">โปรไฟล์</h3>
            <p className="text-[#940B92] mb-4">จัดการข้อมูลส่วนตัว</p>
            <button className="bg-gradient-to-r from-[#DA0C81] to-[#E95793] text-white px-6 py-3 rounded-lg hover:from-[#E95793] hover:to-[#F06292] transition-all duration-300 font-semibold">
              แก้ไขโปรไฟล์
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] p-8">
        <h2 className="text-2xl font-bold text-[#610C9F] mb-6">กิจกรรมล่าสุด</h2>
        <div className="text-center py-8">
          <p className="text-[#940B92] text-lg">ยังไม่มีกิจกรรมล่าสุด</p>
          <p className="text-[#DA0C81] mt-2">เริ่มทำแบบทดสอบเพื่อดูประวัติการทำงาน</p>
        </div>
      </div>
    </div>
  );
}