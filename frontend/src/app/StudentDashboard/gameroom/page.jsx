'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GameRoom() {
  const router = useRouter();
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('');
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [tempPlayerAvatar, setTempPlayerAvatar] = useState('');
  const [gameRooms, setGameRooms] = useState([
    {
      id: 1,
      name: 'ห้องทดสอบ 1',
      code: 'ABC123',
      players: 3,
      maxPlayers: 8,
      status: 'waiting'
    },
    {
      id: 2,
      name: 'Quiz มันส์ๆ',
      code: 'XYZ789',
      players: 5,
      maxPlayers: 10,
      status: 'playing'
    },
    {
      id: 3,
      name: 'ห้องเพื่อนๆ',
      code: 'DEF456',
      players: 2,
      maxPlayers: 6,
      status: 'waiting'
    }
  ]);

  useEffect(() => {
    // โหลดข้อมูลผู้เล่นจาก localStorage
    const savedName = localStorage.getItem('playerName');
    const savedAvatar = localStorage.getItem('selectedCharacter');
    const savedImage = localStorage.getItem('playerImage');
    
    if (savedName) setPlayerName(savedName);
    if (savedAvatar) setPlayerAvatar(savedAvatar);
    if (savedImage) setPlayerAvatar(savedImage);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempPlayerAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    if (tempPlayerName.trim()) {
      setPlayerName(tempPlayerName);
      localStorage.setItem('playerName', tempPlayerName);
    }
    if (tempPlayerAvatar) {
      setPlayerAvatar(tempPlayerAvatar);
      localStorage.setItem('playerImage', tempPlayerAvatar);
      localStorage.setItem('selectedCharacter', ''); // Clear emoji character
    }
    setShowEditProfile(false);
    setTempPlayerName('');
    setTempPlayerAvatar('');
  };

  const openEditProfile = () => {
    setTempPlayerName(playerName);
    setTempPlayerAvatar(playerAvatar);
    setShowEditProfile(true);
  };

  const handleJoinRoom = () => {
    const room = gameRooms.find(r => r.code === roomCode.toUpperCase());
    if (room) {
      if (room.status === 'playing') {
        alert('ห้องนี้กำลังเล่นอยู่ ไม่สามารถเข้าร่วมได้');
        return;
      }
      if (room.players >= room.maxPlayers) {
        alert('ห้องเต็มแล้ว ไม่สามารถเข้าร่วมได้');
        return;
      }
      // เข้าห้องสำเร็จ
      alert(`เข้าร่วมห้อง "${room.name}" สำเร็จ!`);
      setRoomCode('');
      setShowJoinRoom(false);
    } else {
      alert('ไม่พบห้องที่มีรหัสนี้');
    }
  };

  const getStatusColor = (status) => {
    return status === 'waiting' ? 'text-green-500' : 'text-yellow-500';
  };

  const getStatusText = (status) => {
    return status === 'waiting' ? 'รอผู้เล่น' : 'กำลังเล่น';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/StudentDashboard')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-white">ห้องเกม</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-white text-right">
            <div className="font-semibold">{playerName || 'ผู้เล่น'}</div>
            <div className="text-purple-200 text-sm">พร้อมเล่น</div>
          </div>
          <button
            onClick={openEditProfile}
            className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-2xl hover:bg-purple-400 transition-colors"
          >
            {playerAvatar && playerAvatar.startsWith('data:') ? (
              <img 
                src={playerAvatar} 
                alt="Player Avatar" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>{playerAvatar || '😊'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setShowJoinRoom(true)}
          className="bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <div className="text-lg">🔑 เข้าร่วมห้อง</div>
        </button>
      </div>

      {/* Game Rooms List */}
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">ห้องเกมทั้งหมด</h2>
        <div className="space-y-4">
          {gameRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white/10 rounded-lg p-4 hover:bg-white/20 transition-all duration-200 cursor-pointer"
              onClick={() => {
                if (room.status === 'waiting' && room.players < room.maxPlayers) {
                  alert(`เข้าร่วมห้อง "${room.name}" สำเร็จ!`);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">{room.name}</h3>
                  <p className="text-purple-200">รหัสห้อง: {room.code}</p>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    {room.players}/{room.maxPlayers} คน
                  </div>
                  <div className={`${getStatusColor(room.status)} font-medium`}>
                    {getStatusText(room.status)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">เข้าร่วมห้อง</h3>
            <input
              type="text"
              placeholder="รหัสห้อง"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-gray-800 uppercase"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setShowJoinRoom(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleJoinRoom}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                เข้าร่วม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">แก้ไขข้อมูลผู้เล่น</h3>
            
            {/* Avatar Preview */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-purple-500 flex items-center justify-center text-3xl relative overflow-hidden">
                {tempPlayerAvatar && tempPlayerAvatar.startsWith('data:') ? (
                  <img 
                    src={tempPlayerAvatar} 
                    alt="Temp Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{tempPlayerAvatar || playerAvatar || '😊'}</span>
                )}
              </div>
            </div>

            {/* Name Input */}
            <input
              type="text"
              placeholder="ชื่อผู้เล่น"
              value={tempPlayerName}
              onChange={(e) => setTempPlayerName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-gray-800"
            />

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                รูปโปรไฟล์
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-800"
              />
              <p className="text-gray-500 text-xs mt-1">อัปโหลดรูปภาพ (JPG, PNG)</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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