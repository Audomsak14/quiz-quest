'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { profileStorage } from '@/lib/profileStorage';

export default function GameRoom() {
  const router = useRouter();
  const authUsername = (() => {
    if (typeof window === 'undefined') return '';
    try { return sessionStorage.getItem('username') || localStorage.getItem('username') || ''; } catch { return ''; }
  })();
  const isLoggedIn = Boolean(authUsername);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('');
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [tempPlayerAvatar, setTempPlayerAvatar] = useState('');
  // ไม่ดึงรายการห้องแบบสาธารณะเพื่อความเป็นส่วนตัวของแต่ละบัญชี
  // นักเรียนเข้าร่วมด้วยรหัสเท่านั้น
  const [gameRooms, setGameRooms] = useState([]);

  useEffect(() => {
    // โหลดข้อมูลผู้เล่นจาก sessionStorage (กันชื่อไหลข้ามบัญชี/แท็บ)
    const savedName = profileStorage.getName();
    const savedAvatarEmoji = profileStorage.getCharacterId();
    const savedImage = profileStorage.getImage();

    if (savedName) setPlayerName(savedName);
    if (savedImage) setPlayerAvatar(savedImage);
    else if (savedAvatarEmoji) setPlayerAvatar(savedAvatarEmoji);

    // สร้างห้องตัวอย่างแบบแยกต่อแท็บ (ไม่ชนกับบัญชีอื่น)
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem('demoRooms') : null;
      if (cached) {
        setGameRooms(JSON.parse(cached));
      } else {
        const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
        const rooms = [
          { id: randomCode(), name: 'ห้องทดสอบ 1', code: randomCode(), status: 'waiting', players: Math.floor(Math.random()*4)+1, maxPlayers: 8 },
          { id: randomCode(), name: 'Quiz มันส์ๆ', code: randomCode(), status: 'waiting', players: Math.floor(Math.random()*4)+1, maxPlayers: 10 },
          { id: randomCode(), name: 'ทดลองเล่น', code: randomCode(), status: 'waiting', players: Math.floor(Math.random()*3)+1, maxPlayers: 6 },
        ];
        sessionStorage.setItem('demoRooms', JSON.stringify(rooms));
        setGameRooms(rooms);
      }
    } catch {}
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
    const nextName = (isLoggedIn ? authUsername : tempPlayerName).trim();
    if (nextName) {
      setPlayerName(nextName);
      profileStorage.setName(nextName);
    }
    if (tempPlayerAvatar) {
      setPlayerAvatar(tempPlayerAvatar);
      profileStorage.setImage(tempPlayerAvatar);
      profileStorage.setCharacterId(''); // Clear emoji character
    }
    setShowEditProfile(false);
    setTempPlayerName('');
    setTempPlayerAvatar('');
  };

  const openEditProfile = () => {
    setTempPlayerName(isLoggedIn ? authUsername : playerName);
    setTempPlayerAvatar(playerAvatar);
    setShowEditProfile(true);
  };

  const handleJoinRoom = async () => {
    try {
      const code = roomCode.trim().toUpperCase();
      if (!code) {
        await Swal.fire({ icon: 'warning', title: 'กรุณากรอกรหัสห้อง' });
        return;
      }
      // หา room ด้วยรหัสจาก backend
      const roomRes = await axios.get(`http://localhost:5000/api/rooms/by-code/${code}`);
      const room = roomRes.data;
      if (room.status !== 'waiting') {
        await Swal.fire({ icon: 'warning', title: 'ห้องกำลังเล่นอยู่', text: 'ไม่สามารถเข้าร่วมได้' });
        return;
      }
      const name = (authUsername || playerName || '').trim() || 'ผู้เล่น';
      // join ผู้เล่นเข้า room
      await axios.post(`http://localhost:5000/api/rooms/${room._id}/join`, { name });
      // เคลียร์ modal และไปหน้า lobby รอเริ่มเกม
      setRoomCode('');
      setShowJoinRoom(false);
      router.push(`/lobby?roomId=${room._id}&playerName=${encodeURIComponent(name)}`);
    } catch (err) {
      if (err.response?.status === 404) {
        await Swal.fire({ icon: 'warning', title: 'ไม่พบห้อง', text: 'ตรวจสอบรหัสอีกครั้ง' });
      } else if (err.response?.status === 409) {
        await Swal.fire({ icon: 'warning', title: 'เข้าร่วมไม่ได้', text: err.response?.data?.error || 'ห้องกำลังเล่นอยู่หรือชื่อซ้ำ' });
      } else {
        await Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
      }
    }
  };

  const handleJoinByRoomCode = async () => {
    if (roomCode.trim()) {
      // เช็คว่ารหัสห้องไม่เป็นค่าว่าง
      handleJoinRoom();
    } else {
      await Swal.fire({ icon: 'warning', title: 'กรุณากรอกรหัสห้อง' });
    }
  };

  const getStatusColor = (status) => {
    return status === 'waiting' ? 'text-green-500' : 'text-yellow-500';
  };

  const getStatusText = (status) => {
    return status === 'waiting' ? 'รอผู้เล่น' : 'กำลังเล่น';
  };

  return (
     <div className="min-h-screen p-8" style={{
      background: 'linear-gradient(to bottom, #030637 0%, #180161 50%, #FF204E 100%)'
    }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header Section */}
      <div className="relative z-10 mb-8">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => router.push('/StudentDashboard')}
                className="group relative p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 border border-white/20 hover:border-white/30"
              >
                <svg className="w-6 h-6 text-white group-hover:text-purple-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L12 11l.707-.707A1 1 0 0113.414 10H15M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">ห้องเกม</h1>
                  <p className="text-purple-300 text-lg font-medium">เข้าร่วมการแข่งขันสุดมันส์</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
              <button
                onClick={openEditProfile}
                className="group relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl hover:shadow-purple-500/25 transition-all duration-300"
                aria-label="แก้ไขโปรไฟล์"
              >
                {playerAvatar && playerAvatar.startsWith('data:') ? (
                  <img
                    src={playerAvatar}
                    alt="Player Avatar"
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (/^(\/|https?:)/.test(playerAvatar || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(playerAvatar || '')) ? (
                  // If avatar is a URL/path (e.g., sprite file), show a clean sticker instead of raw text
                  <span className="text-2xl sm:text-3xl">😊</span>
                ) : (
                  <span className="text-2xl sm:text-3xl">{playerAvatar || '😊'}</span>
                )}
                {/* status dot pinned inside avatar, not over the name */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full ring-2 ring-white"></div>
              </button>
              <div className="min-w-0 text-right">
                <div className="text-lg md:text-xl font-bold text-white truncate max-w-[40vw] md:max-w-[24rem]">{playerName || 'ผู้เล่น'}</div>
                <div className="text-purple-300 font-medium whitespace-nowrap">🟢 พร้อมเล่น</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="relative z-10 mb-8">
        <div className="flex justify-center">
          <button
            onClick={() => setShowJoinRoom(true)}
            className="group relative bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-6 px-12 rounded-3xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-cyan-500/25 flex items-center space-x-4"
          >
            <div className="bg-white/20 p-3 rounded-2xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 16H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <span className="text-2xl font-bold">🔑 เข้าร่วมห้อง</span>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-600/50 to-cyan-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
          </button>
        </div>
      </div>

      {/* Game Rooms Section */}
      <div className="relative z-10">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">ห้องเกมทั้งหมด</h2>
                <p className="text-purple-100 text-lg">เลือกห้องที่ต้องการเข้าร่วม</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {gameRooms.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-32 h-32 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">ยังไม่มีห้องเกมใดๆ</h3>
                <p className="text-purple-300 text-lg">รอสักครู่ ห้องเกมจะปรากฏขึ้นเร็วๆ นี้!</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {gameRooms.map((room, index) => (
                  <div
                    key={room.id}
                    className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl cursor-pointer"
                    onClick={() => {
                      if (room.status === 'waiting' && room.players < room.maxPlayers) {
                        const name = (authUsername || playerName || '').trim() || 'ผู้เล่น';
                        // โหมดตัวอย่าง: เพิ่ม demo=1 เพื่อให้ Lobby ทำงานแบบออฟไลน์ (ไม่เรียกเซิร์ฟเวอร์)
                        router.push(`/lobby?roomId=${room.code}&playerName=${encodeURIComponent(name)}&demo=1`);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-xl ${
                            room.status === 'waiting' ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                            room.status === 'waiting' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                          }`}></div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors">{room.name}</h3>
                          <div className="flex items-center space-x-4 mt-2">
                            <p className="text-purple-300 font-medium">🔒 {room.code}</p>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                              room.status === 'waiting' 
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}>
                              {getStatusText(room.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-3xl font-bold text-white mb-1">
                          {room.players}<span className="text-purple-300">/{room.maxPlayers}</span>
                        </div>
                        <p className="text-purple-300 font-medium">ผู้เล่น</p>
                        
                        {room.status === 'waiting' && room.players < room.maxPlayers && (
                          <div className="mt-3">
                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                              คลิกเพื่อเข้าร่วม
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Hover Effect Background */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md shadow-2xl border border-white/20">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 16H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">เข้าร่วมห้อง</h3>
              <p className="text-purple-200">กรอกรหัสห้องเพื่อเข้าร่วมการแข่งขัน</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-white font-bold mb-3 text-lg">รหัสห้อง</label>
                <input
                  type="text"
                  placeholder="กรอกรหัสห้อง (เช่น ABC123)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-lg font-bold text-center uppercase placeholder-purple-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinByRoomCode()}
                  autoFocus
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowJoinRoom(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 border border-white/20 hover:border-white/30"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleJoinByRoomCode}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-cyan-500/25 transform hover:scale-105"
                >
                  เข้าร่วม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md shadow-2xl border border-white/20">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-bold text-white mb-2">แก้ไขข้อมูลผู้เล่น</h3>
              <p className="text-purple-200">ปรับแต่งโปรไฟล์ของคุณ</p>
            </div>
            
            {/* Avatar Preview */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl relative overflow-hidden shadow-2xl">
                  {tempPlayerAvatar && tempPlayerAvatar.startsWith('data:') ? (
                    <img
                      src={tempPlayerAvatar}
                      alt="Temp Avatar"
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (/^(\/|https?:)/.test((tempPlayerAvatar || playerAvatar || '')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((tempPlayerAvatar || playerAvatar || ''))) ? (
                    // If the value looks like a URL/path to an image (e.g., sprite), show a clean sticker instead of text
                    <span className="text-4xl">😊</span>
                  ) : (
                    <span className="text-4xl">{tempPlayerAvatar || playerAvatar || '😊'}</span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Name Input */}
              <div>
                <label className="block text-white font-bold mb-3">ชื่อผู้เล่น</label>
                <input
                  type="text"
                  placeholder="กรอกชื่อผู้เล่น"
                  value={isLoggedIn ? authUsername : tempPlayerName}
                  onChange={(e) => setTempPlayerName(e.target.value)}
                  disabled={isLoggedIn}
                  className="w-full p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-white font-bold mb-3">รูปโปรไฟล์</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-purple-300 border-dashed border-2 hover:border-purple-400 transition-all duration-300 text-center">
                    <svg className="w-8 h-8 mx-auto mb-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <p className="font-medium">คลิกเพื่อเลือกรูปภาพ</p>
                    <p className="text-sm text-purple-400 mt-1">JPG, PNG, GIF</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 border border-white/20 hover:border-white/30"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-purple-500/25 transform hover:scale-105"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}