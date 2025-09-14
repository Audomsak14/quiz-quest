"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CharacterSelection() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(0);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("selectedCharacter");
    if (saved) {
      setSelectedCharacter(parseInt(saved));
    }
  }, []);

  const characters = [
    { id: 0, name: "นักรบ", emoji: "🗡️", image: "/images/characters/warrior.png", color: "from-red-400 to-red-600", power: 5, speed: 3, intelligence: 3, description: "นักสู้ที่แข็งแกร่งและกล้าหาญ" },
    { id: 1, name: "นักเวทย์", emoji: "🔮", image: "/images/characters/mage.png", color: "from-blue-400 to-blue-600", power: 2, speed: 3, intelligence: 5, description: "ใช้เวทมนตร์และความรู้ในการต่อสู้" },
    { id: 2, name: "นักธนู", emoji: "🏹", image: "/images/characters/archer.png", color: "from-green-400 to-green-600", power: 3, speed: 5, intelligence: 3, description: "เก่งในการยิงและมีความแม่นยำสูง" },
    { id: 3, name: "พ่อมด", emoji: "🧙‍♂️", image: "/images/characters/wizard.png", color: "from-purple-400 to-purple-600", power: 3, speed: 2, intelligence: 5, description: "นักปราชญ์ผู้เชี่ยวชาญด้านเวทมนตร์" },
    { id: 4, name: "นินจา", emoji: "🥷", image: "/images/characters/ninja.png", color: "from-gray-400 to-gray-600", power: 4, speed: 5, intelligence: 4, description: "เร็วแรงและแอบซ่อนได้เก่ง" },
    { id: 5, name: "อัศวินดำ", emoji: "⚔️", image: "/images/characters/knight.png", color: "from-yellow-400 to-yellow-600", power: 4, speed: 2, intelligence: 4, description: "ผู้พิทักษ์ความยุติธรรม" },
    { id: 6, name: "นักสู้", emoji: "👊", image: "/images/characters/fighter.png", color: "from-orange-400 to-orange-600", power: 5, speed: 4, intelligence: 2, description: "ใช้กำลังและทักษะการต่อสู้" },
    { id: 7, name: "โจร", emoji: "🔪", image: "/images/characters/rogue.png", color: "from-indigo-400 to-indigo-600", power: 3, speed: 5, intelligence: 3, description: "คล่องแคล่วและแอบซ่อน" },
    { id: 8, name: "นักบวช", emoji: "🙏", image: "/images/characters/priest.png", color: "from-cyan-400 to-cyan-600", power: 2, speed: 3, intelligence: 5, description: "ผู้ศักดิ์สิทธิ์และเต็มไปด้วยปัญญา" },
    { id: 9, name: "ดรูอิด", emoji: "🌿", image: "/images/characters/druid.png", color: "from-emerald-400 to-emerald-600", power: 3, speed: 3, intelligence: 4, description: "ผู้พิทักษ์ธรรมชาติ" },
    { id: 10, name: "บาร์เบเรียน", emoji: "⚡", image: "/images/characters/barbarian.png", color: "from-rose-400 to-rose-600", power: 5, speed: 3, intelligence: 2, description: "นักรบผู้ดุร้ายและแข็งแกร่ง" },
    { id: 11, name: "บาร์ด", emoji: "🎵", image: "/images/characters/bard.png", color: "from-pink-400 to-pink-600", power: 2, speed: 4, intelligence: 4, description: "นักดนตรีผู้มีเสน่ห์" }
  ];

  const CharacterImage = ({ character, size = "w-full h-full" }) => {
    return (
      <div className={`${size} flex items-center justify-center`}>
        <span className="text-4xl">{character.emoji}</span>
      </div>
    );
  };

  // ใช้การ set state แบบง่าย ไม่ผ่าน event
  const selectCharacter = (characterId) => {
    setSelectedCharacter(characterId);
  };

  const handleSave = () => {
    if (isClient) {
      localStorage.setItem('selectedCharacter', selectedCharacter.toString());
      localStorage.setItem('selectedCharacterName', characters[selectedCharacter].name);
      localStorage.setItem('selectedCharacterImage', characters[selectedCharacter].image);
      alert(`เลือกตัวละคร "${characters[selectedCharacter].name}" สำเร็จ!`);
      router.back();
    }
  };

  const handleBack = () => router.back();

  if (!isClient) return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
      <div className="text-white text-xl">กำลังโหลด...</div>
    </div>
  );

  const currentCharacter = characters[selectedCharacter];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 mb-6 border border-white/20">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button 
              type="button"
              onClick={handleBack} 
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white p-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-white/20"
            >
              ← กลับ
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">เลือกตัวละคร</h1>
              <p className="text-pink-200">เลือกตัวละครที่คุณชื่นชอบ</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleSave} 
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-white/20"
          >
            💾 บันทึก
          </button>
        </div>
      </div>

      <div className="relative grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">เลือกตัวละคร</h2>
            <div className="grid grid-cols-4 gap-4">
              {characters.map((character) => (
                <div
                  key={character.id}
                  onMouseDown={() => selectCharacter(character.id)}
                  className={`relative aspect-square rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 select-none border border-white/20 ${
                    selectedCharacter === character.id
                      ? 'ring-4 ring-pink-500 shadow-xl scale-105'
                      : 'hover:shadow-lg'
                  }`}
                  style={{ userSelect: 'none' }}
                >
                  <div className={`w-full h-full bg-gradient-to-br ${character.color} rounded-xl p-2 shadow-md backdrop-blur-sm`}>
                    <CharacterImage character={character} />
                  </div>
                  {selectedCharacter === character.id && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
                      ✓
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 rounded-b-xl text-center backdrop-blur-sm">
                    {character.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 text-center sticky top-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4 drop-shadow-lg">ตัวละครที่เลือก</h3>
            
            <div className={`w-32 h-32 mx-auto bg-gradient-to-br ${currentCharacter.color} rounded-2xl p-4 mb-4 shadow-lg border border-white/20`}>
              <CharacterImage character={currentCharacter} size="w-full h-full" />
            </div>

            <h4 className="text-2xl font-bold text-white mb-2 drop-shadow">{currentCharacter.name}</h4>

            <div className="space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-blue-200">พลัง:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.power ? 'bg-red-400' : 'bg-gray-500/30'} shadow-sm`} />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-pink-200">ความเร็ว:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.speed ? 'bg-blue-400' : 'bg-gray-500/30'} shadow-sm`} />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-purple-200">ปัญญา:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.intelligence ? 'bg-yellow-400' : 'bg-gray-500/30'} shadow-sm`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-black/20 rounded-xl backdrop-blur-sm border border-white/10">
              <p className="text-sm text-pink-200">"{currentCharacter.description}"</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-red-500/20 p-3 rounded-xl backdrop-blur-sm border border-red-400/30">
                <div className="text-lg font-bold text-red-300">{currentCharacter.power}</div>
                <div className="text-xs text-red-200">พลัง</div>
              </div>
              <div className="bg-blue-500/20 p-3 rounded-xl backdrop-blur-sm border border-blue-400/30">
                <div className="text-lg font-bold text-blue-300">{currentCharacter.speed}</div>
                <div className="text-xs text-blue-200">เร็ว</div>
              </div>
              <div className="bg-yellow-500/20 p-3 rounded-xl backdrop-blur-sm border border-yellow-400/30">
                <div className="text-lg font-bold text-yellow-300">{currentCharacter.intelligence}</div>
                <div className="text-xs text-yellow-200">ฉลาด</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}