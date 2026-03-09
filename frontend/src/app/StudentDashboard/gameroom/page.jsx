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
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    // Use login username if available; otherwise use the local profile name.
    // (Page UI is intentionally minimal per requirement.)
    const savedName = profileStorage.getName();
    if (authUsername) setPlayerName(authUsername);
    else if (savedName) setPlayerName(savedName);
    else setPlayerName('ผู้เล่น');
  }, []);

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
      await handleJoinRoom();
    } else {
      await Swal.fire({ icon: 'warning', title: 'กรุณากรอกรหัสห้อง' });
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #030637 0%, #180161 50%, #FF204E 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
        <button
          onClick={() => setShowJoinRoom(true)}
          className="w-full group relative bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-6 px-8 rounded-3xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-cyan-500/25 flex items-center justify-center space-x-4"
        >
          <div className="bg-white/20 p-3 rounded-2xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 16H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <span className="text-2xl font-bold">🔑 เข้าร่วมเกม</span>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-600/50 to-cyan-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
        </button>

        <button
          onClick={() => router.push('/StudentDashboard')}
          className="text-white/90 hover:text-white font-semibold underline underline-offset-4"
        >
          กลับไปหน้าแดชบอร์ด
        </button>
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
                <label className="block text-white font-bold mb-3">รหัสห้อง</label>
                <input
                  type="text"
                  placeholder="เช่น ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleJoinByRoomCode();
                  }}
                  className="w-full p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-purple-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 uppercase"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowJoinRoom(false);
                    setRoomCode('');
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 border border-white/20 hover:border-white/30"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => void handleJoinByRoomCode()}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-cyan-500/25 transform hover:scale-105"
                >
                  เข้าร่วม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}