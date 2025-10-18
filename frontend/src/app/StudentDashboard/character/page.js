"use client";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { profileStorage } from "@/lib/profileStorage";

export default function CharacterSelection() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(0);

  useEffect(() => {
    setIsClient(true);
    const saved = profileStorage.getCharacterId() || localStorage.getItem("selectedCharacter");
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

  const handleSave = async () => {
    if (isClient) {
      profileStorage.setCharacterId(selectedCharacter.toString());
      localStorage.setItem('selectedCharacterName', characters[selectedCharacter].name);
      localStorage.setItem('selectedCharacterImage', characters[selectedCharacter].image);
      await Swal.fire({ icon: 'success', title: `เลือกตัวละคร "${characters[selectedCharacter].name}" สำเร็จ!`, timer: 1200, showConfirmButton: false });
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
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button 
              type="button"
              onClick={handleBack} 
              className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition-all duration-200"
            >
              ← กลับ
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">เลือกตัวละคร</h1>
              <p className="text-gray-700">เลือกตัวละครที่คุณชื่นชอบ</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleSave} 
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            💾 บันทึก
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-[#551A8B] backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">เลือกตัวละคร</h2>
            <div className="grid grid-cols-4 gap-4">
              {characters.map((character) => (
                <div
                  key={character.id}
                  onMouseDown={() => selectCharacter(character.id)}
                  className={`relative aspect-square rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 select-none ${
                    selectedCharacter === character.id
                      ? 'ring-4 ring-purple-500 shadow-xl scale-105'
                      : 'hover:shadow-lg'
                  }`}
                  style={{ userSelect: 'none' }}
                >
                  <div className={`w-full h-full bg-gradient-to-br ${character.color} rounded-xl p-2 shadow-md`}>
                    <CharacterImage character={character} />
                  </div>
                  {selectedCharacter === character.id && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      ✓
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 rounded-b-xl text-center">
                    {character.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 text-center sticky top-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">ตัวละครที่เลือก</h3>
            
            <div className={`w-32 h-32 mx-auto bg-gradient-to-br ${currentCharacter.color} rounded-2xl p-4 mb-4 shadow-lg`}>
              <CharacterImage character={currentCharacter} size="w-full h-full" />
            </div>

            <h4 className="text-2xl font-bold text-gray-900 mb-2">{currentCharacter.name}</h4>

            <div className="space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">พลัง:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.power ? 'bg-red-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">ความเร็ว:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.speed ? 'bg-blue-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">ปัญญา:</span>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < currentCharacter.intelligence ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">&quot;{currentCharacter.description}&quot;</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-red-100 p-2 rounded-lg">
                <div className="text-lg font-bold text-red-600">{currentCharacter.power}</div>
                <div className="text-xs text-gray-600">พลัง</div>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{currentCharacter.speed}</div>
                <div className="text-xs text-gray-600">เร็ว</div>
              </div>
              <div className="bg-yellow-100 p-2 rounded-lg">
                <div className="text-lg font-bold text-yellow-600">{currentCharacter.intelligence}</div>
                <div className="text-xs text-gray-600">ฉลาด</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}