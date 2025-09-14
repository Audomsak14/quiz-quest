"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [selectedCharacterName, setSelectedCharacterName] = useState("นักเรียน");
  const [selectedCharacterEmoji, setSelectedCharacterEmoji] = useState("👨‍🎓");
  const [playerName, setPlayerName] = useState("นักเรียน");
  const [characterImage, setCharacterImage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState("");
  const [tempPlayerImage, setTempPlayerImage] = useState(null);

  // ฟังก์ชันโหลดข้อมูลตัวละคร
  const loadCharacterData = () => {
    if (typeof window !== 'undefined') {
      const characterName = localStorage.getItem('selectedCharacterName');
      const characterId = localStorage.getItem('selectedCharacter');
      const savedPlayerName = localStorage.getItem('playerName');
      const savedCharacterImage = localStorage.getItem('selectedCharacterImage');
      const savedPlayerImage = localStorage.getItem('playerImage');
      
      console.log("Loading character data:", { characterName, characterId, savedPlayerName, savedCharacterImage, savedPlayerImage });
      
      // โหลดชื่อผู้เล่น
      if (savedPlayerName) {
        setPlayerName(savedPlayerName);
      } else {
        setPlayerName("นักเรียน");
      }

      // โหลดชื่อตัวละคร
      if (characterName) {
        setSelectedCharacterName(characterName);
      } else {
        setSelectedCharacterName("นักเรียน");
      }

      // โหลดรูปภาพตัวละคร - รองรับทั้งรูปตัวละครและรูปที่ผู้เล่นอัปโหลด
      if (savedPlayerImage) {
        // ถ้ามีรูปที่ผู้เล่นอัปโหลด ใช้รูปนั้น
        setCharacterImage(savedPlayerImage);
      } else if (savedCharacterImage) {
        // ถ้าไม่มีรูปที่อัปโหลด แต่มีรูปตัวละคร
        setCharacterImage(savedCharacterImage);
      } else if (characterId) {
        // ถ้าไม่มีรูปใดๆ แต่มี characterId ให้สร้างรูปตัวละคร
        const characters = [
          { id: 0, name: "นักรบ", emoji: "🗡️", image: "/images/characters/warrior.png" },
          { id: 1, name: "นักเวทย์", emoji: "🔮", image: "/images/characters/mage.png" },
          { id: 2, name: "นักธนู", emoji: "🏹", image: "/images/characters/archer.png" },
          { id: 3, name: "พ่อมด", emoji: "🧙‍♂️", image: "/images/characters/wizard.png" },
          { id: 4, name: "นินจา", emoji: "🥷", image: "/images/characters/ninja.png" },
          { id: 5, name: "อัศวินดำ", emoji: "⚔️", image: "/images/characters/knight.png" },
          { id: 6, name: "นักสู้", emoji: "👊", image: "/images/characters/fighter.png" },
          { id: 7, name: "โจร", emoji: "🔪", image: "/images/characters/rogue.png" },
          { id: 8, name: "นักบวช", emoji: "🙏", image: "/images/characters/priest.png" },
          { id: 9, name: "ดรูอิด", emoji: "🌿", image: "/images/characters/druid.png" },
          { id: 10, name: "บาร์เบเรียน", emoji: "⚡", image: "/images/characters/barbarian.png" },
          { id: 11, name: "บาร์ด", emoji: "🎵", image: "/images/characters/bard.png" }
        ];
        const character = characters[parseInt(characterId)];
        if (character) {
          setCharacterImage(character.image);
        } else {
          setCharacterImage(null);
        }
      } else {
        setCharacterImage(null);
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
      localStorage.removeItem('playerName');
      localStorage.removeItem('selectedCharacterImage');
      localStorage.removeItem('customCharacterImages');
      alert('ออกจากระบบสำเร็จ');
      router.push('/login');
    }
  };

  const handleCharacterSelection = () => {
    router.push('/StudentDashboard/character');
  };

  // ฟังก์ชันเปิด modal แก้ไขข้อมูล
  const openEditProfile = () => {
    setTempPlayerName(playerName);
    setTempPlayerImage(characterImage);
    setShowEditProfile(true);
  };

  // ฟังก์ชันจัดการอัปโหลดรูปภาพ
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempPlayerImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ฟังก์ชันบันทึกข้อมูล
  const handleSaveProfile = () => {
    if (tempPlayerName.trim()) {
      setPlayerName(tempPlayerName);
      localStorage.setItem('playerName', tempPlayerName);
    }
    if (tempPlayerImage && tempPlayerImage !== characterImage) {
      setCharacterImage(tempPlayerImage);
      localStorage.setItem('playerImage', tempPlayerImage);
      localStorage.setItem('selectedCharacterImage', tempPlayerImage);
    }
    setShowEditProfile(false);
    setTempPlayerName("");
    setTempPlayerImage(null);
  };

  // ฟังก์ชันไปหน้าห้องเกม
  const handleGameRoom = () => {
    router.push('/StudentDashboard/gameroom');
  };

  // Component สำหรับแสดงรูปตัวละคร - แก้ไขให้รองรับการแสดงรูปภาพ
  const CharacterAvatar = ({ size = "w-16 h-16" }) => {
    const [imageError, setImageError] = useState(false);

    return (
      <div className={`${size} bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg overflow-hidden`}>
        {characterImage && !imageError ? (
          <img
            src={characterImage}
            alt={selectedCharacterName}
            className="w-full h-full object-cover"
            onError={() => {
              console.log("Image failed to load:", characterImage);
              setImageError(true);
            }}
            onLoad={() => {
              console.log("Image loaded successfully:", characterImage);
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-2xl" style={{ fontSize: size.includes('w-20') ? '2rem' : '1.5rem' }}>
              {selectedCharacterEmoji}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6 relative">
      {/* Header - เปลี่ยนเป็นสีม่วง */}
      <div className="bg-gradient-to-br from-purple-100 to-purple-200 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-purple-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <CharacterAvatar />
            <div>
              <h1 className="text-3xl font-bold text-purple-900 mb-1">แดชบอร์ดนักเรียน</h1>
              <p className="text-purple-700 font-medium">ยินดีต้อนรับ {playerName}</p>
              <p className="text-purple-600 text-sm">ตัวละคร: {selectedCharacterName}</p>
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

      {/* Debug Info - เปลี่ยนเป็นสีม่วง */}
      <div className="bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-4">
        <p className="text-sm">
          Debug: Player = {playerName} | Character = {selectedCharacterName} ({selectedCharacterEmoji}) | 
          Image: {characterImage ? 'Custom' : 'Default'} | 
          localStorage: {typeof window !== 'undefined' ? localStorage.getItem('playerName') || 'none' : 'not available'}
        </p>
      </div>

      {/* Main Content Cards - เปลี่ยนเป็นสีม่วง */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* แบบทดสอบ */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300 border border-purple-200">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-purple-900 mb-2">แบบทดสอบ</h2>
          <p className="text-purple-700 mb-4">เข้าร่วมแบบทดสอบออนไลน์</p>
          <button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105">
            เข้าร่วมแบบทดสอบ
          </button>
        </div>

        {/* ผลคะแนน */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300 border border-purple-200">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-purple-900 mb-2">ผลคะแนน</h2>
          <p className="text-purple-700 mb-4">ดูผลคะแนนการทดสอบ</p>
          <button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105">
            ดูผลคะแนน
          </button>
        </div>

        {/* เลือกตัวละคร */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center hover:scale-105 transition-all duration-300 border border-purple-200">
          <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
            <CharacterAvatar size="w-full h-full" />
          </div>
          <h2 className="text-2xl font-bold text-purple-900 mb-2">เลือกตัวละคร</h2>
          <p className="text-purple-700 mb-2">จัดการตัวละครของคุณ</p>
          <p className="text-purple-600 text-sm mb-4">ปัจจุบัน: {selectedCharacterName}</p>
          <button 
            onClick={handleCharacterSelection}
            className="bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            แก้ไขตัวละคร
          </button>
        </div>
      </div>

      {/* ข้อมูลผู้เล่นและตัวละคร - เปลี่ยนเป็นสีม่วง */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* ข้อมูลผู้เล่น */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-purple-200">
          <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center justify-between">
            <span className="flex items-center">
              <span className="mr-2">👤</span>
              ข้อมูลผู้เล่น
            </span>
            <button
              onClick={openEditProfile}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium hover:underline"
            >
              แก้ไข
            </button>
          </h3>
          <div className="flex items-center space-x-4">
            <button onClick={openEditProfile} className="hover:opacity-80 transition-opacity">
              <CharacterAvatar size="w-20 h-20" />
            </button>
            <div>
              <p className="text-lg font-semibold text-purple-900">{playerName}</p>
              <p className="text-purple-700">ตัวละคร: {selectedCharacterName}</p>
              <p className="text-purple-600 text-sm">
                รูปภาพ: {characterImage ? 'รูปที่อัปโหลด' : 'Emoji เริ่มต้น'}
              </p>
              <button
                onClick={openEditProfile}
                className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium hover:underline"
              >
                คลิกเพื่อแก้ไขข้อมูล
              </button>
            </div>
          </div>
        </div>

        {/* สถิติการเล่น */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-purple-200">
          <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            สถิติการเล่น
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-purple-200 rounded-lg border border-purple-300">
              <div className="text-2xl font-bold text-purple-800">0</div>
              <div className="text-sm text-purple-700">แบบทดสอบที่ทำ</div>
            </div>
            <div className="text-center p-4 bg-green-100 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">0</div>
              <div className="text-sm text-green-600">คะแนนเฉลี่ย</div>
            </div>
            <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">0</div>
              <div className="text-sm text-blue-600">เวลาเล่นรวม</div>
            </div>
            <div className="text-center p-4 bg-yellow-100 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">-</div>
              <div className="text-sm text-yellow-600">อันดับ</div>
            </div>
          </div>
        </div>
      </div>

      {/* กิจกรรมล่าสุด - เปลี่ยนเป็นสีม่วง */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-purple-200 mb-20">
        <h2 className="text-2xl font-bold text-purple-900 mb-4">กิจกรรมล่าสุด</h2>
        
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-purple-600 text-lg font-medium">ยังไม่มีกิจกรรมล่าสุด</p>
          <p className="text-purple-500 mt-2">เริ่มทำแบบทดสอบเพื่อดูประวัติการทำงาน</p>
        </div>
      </div>

      {/* ปุ่มห้องเกม - ล่างขวา */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleGameRoom}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 flex items-center space-x-3 group"
        >
          <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-all duration-300">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L12 11l.707-.707A1 1 0 0113.414 10H15M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold">🎮 ห้องเกม</span>
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            NEW
          </div>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">แก้ไขข้อมูลผู้เล่น</h3>
            
            {/* Avatar Preview */}
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-4xl relative overflow-hidden shadow-lg">
                {tempPlayerImage && tempPlayerImage.startsWith('data:') ? (
                  <img 
                    src={tempPlayerImage} 
                    alt="Temp Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{selectedCharacterEmoji}</span>
                )}
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                ชื่อผู้เล่น
              </label>
              <input
                type="text"
                placeholder="กรอกชื่อผู้เล่น"
                value={tempPlayerName}
                onChange={(e) => setTempPlayerName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                รูปโปรไฟล์
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-gray-500 text-xs mt-1">อัปโหลดรูปภาพ (JPG, PNG, GIF)</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowEditProfile(false);
                  setTempPlayerName("");
                  setTempPlayerImage(null);
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}