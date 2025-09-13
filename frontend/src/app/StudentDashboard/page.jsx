"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [selectedCharacterName, setSelectedCharacterName] = useState("นักเรียน");
  const [selectedCharacterEmoji, setSelectedCharacterEmoji] = useState("👨‍🎓");

  // ฟังก์ชันโหลดข้อมูลตัวละคร
  const loadCharacterData = () => {
    if (typeof window !== 'undefined') {
      const characterName = localStorage.getItem('selectedCharacterName');
      const characterId = localStorage.getItem('selectedCharacter');
      
      console.log("Loading character data:", { characterName, characterId });
      
      if (characterName) {
        setSelectedCharacterName(characterName);
      } else {
        setSelectedCharacterName("นักเรียน");
      }

      // กำหนด emoji ตามตัวละครที่เลือก
      if (characterId) {
        const characters = [
          "🗡️", "🔮", "🏹", "🧙‍♂️", "🥷", "⚔️", 
          "👊", "🔪", "🙏", "🌿", "⚡", "🎵"
        ];
        const emoji = characters[parseInt(characterId)] || "👨‍🎓";
        console.log("Setting emoji:", emoji);
        setSelectedCharacterEmoji(emoji);
      } else {
        setSelectedCharacterEmoji("👨‍🎓");
      }
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadCharacterData();

    // ตั้ง interval เพื่อเช็คการเปลี่ยนแปลงทุกๆ 1 วินาที
    const interval = setInterval(() => {
      loadCharacterData();
    }, 1000);

    // ฟัง visibility change (เมื่อ tab กลับมา active)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(loadCharacterData, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ฟัง page show event
    const handlePageShow = () => {
      setTimeout(loadCharacterData, 100);
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // เพิ่ม useEffect สำหรับโหลดข้อมูลเมื่อ component mount อีกครั้ง
  useEffect(() => {
    if (isClient) {
      const timer = setTimeout(() => {
        loadCharacterData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isClient]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('selectedCharacter');
      localStorage.removeItem('selectedCharacterName');
      alert('ออกจากระบบสำเร็จ');
      router.push('/login');
    }
  };

  const handleCharacterSelection = () => {
    router.push('/StudentDashboard/character');
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* แสดงตัวละครที่เลือก */}
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-2xl">{selectedCharacterEmoji}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">แดชบอร์ดนักเรียน</h1>
              <p className="text-gray-700 font-medium">ยินดีต้อนรับ {selectedCharacterName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
        <p className="text-sm">
          Debug: Character = {selectedCharacterName} ({selectedCharacterEmoji}) | 
          localStorage: {typeof window !== 'undefined' ? localStorage.getItem('selectedCharacterName') || 'none' : 'not available'}
        </p>
      </div>

      {/* Main Content Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* แบบทดสอบ */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">แบบทดสอบ</h2>
          <p className="text-gray-700 mb-4">เข้าร่วมแบบทดสอบออนไลน์</p>
          <button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105">
            เข้าร่วมแบบทดสอบ
          </button>
        </div>

        {/* ผลคะแนน */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ผลคะแนน</h2>
          <p className="text-gray-700 mb-4">ดูผลคะแนนการทดสอบ</p>
          <button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105">
            ดูผลคะแนน
          </button>
        </div>

        {/* เลือกตัวละคร */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">{selectedCharacterEmoji}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">เลือกตัวละคร</h2>
          <p className="text-gray-700 mb-4">จัดการตัวละครของคุณ</p>
          <button 
            onClick={handleCharacterSelection}
            className="bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            แก้ไขตัวละคร
          </button>
        </div>
      </div>

      {/* กิจกรรมล่าสุด */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">กิจกรรมล่าสุด</h2>
        
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">ยังไม่มีกิจกรรมล่าสุด</p>
          <p className="text-gray-400 mt-2">เริ่มทำแบบทดสอบเพื่อดูประวัติการทำงาน</p>
        </div>
      </div>
    </div>
  );
}