"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";

export default function TeacherRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;
  
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
      // Set up polling for real-time updates
      const interval = setInterval(fetchRoomData, 2000);
      return () => clearInterval(interval);
    }
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const [roomResponse, playersResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/rooms/${roomId}`),
        axios.get(`http://localhost:5000/api/rooms/${roomId}/players`)
      ]);
      
      setRoom(roomResponse.data);
      setPlayers(playersResponse.data || []);
    } catch (err) {
      console.error("Error fetching room data:", err);
      if (err.response?.status === 404) {
        await Swal.fire({
          icon: 'error',
          title: 'ไม่พบห้อง',
          text: 'ห้องนี้อาจถูกลบหรือไม่มีอยู่',
        });
        router.push('/TeacherDashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    try {
      // อัพเดทสถานะห้องเป็น "active"
      await axios.put(`http://localhost:5000/api/rooms/${roomId}`, {
        status: 'active'
      });
      
      await Swal.fire({
        icon: 'success',
        title: 'เริ่มเกมแล้ว!',
        text: 'ผู้เล่นสามารถเริ่มทำข้อสอบได้',
        timer: 2000,
        showConfirmButton: false
      });
      
      // ไปหน้ารอผู้เล่น (หน้าเดียวกับนักเรียนแต่มุมมองครู)
      router.push(`/game?roomId=${roomId}&role=teacher`);
      
    } catch (err) {
      console.error("Error starting game:", err);
      await Swal.fire({
        icon: 'error',
        title: 'เริ่มเกมไม่สำเร็จ',
        text: err.response?.data?.error || err.message
      });
    }
  };

  const handleBackToDashboard = () => {
    router.push('/TeacherDashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">ไม่พบข้อมูลห้อง</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #030637 0%, #180161 50%, #FF204E 100%)'
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 mb-8">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent mb-2">
                  ห้องของครู
                </h1>
                <p className="text-green-200 text-lg">จัดการห้องและเริ่มเกม</p>
              </div>
            </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToDashboard}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>กลับ</span>
                </button>
              </div>
          </div>
        </div>
      </div>

      {/* Room Info Cards */}
      <div className="relative z-10 grid lg:grid-cols-3 gap-6 mb-8">
        {/* Room Code */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl p-8 border border-white/10 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a1.013 1.013 0 01-1.414 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">รหัสห้อง</h3>
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono text-3xl font-bold py-4 px-6 rounded-xl shadow-lg">
              {room.code}
            </div>
            <p className="text-blue-200 mt-2">แจ้งรหัสนี้ให้นักเรียน</p>
          </div>
        </div>

        {/* Player Count */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl p-8 border border-white/10 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">จำนวนผู้เล่น</h3>
            <div className="text-5xl font-bold text-green-400 mb-2">
              {players.length}
            </div>
            <p className="text-green-200">คนที่เข้าห้อง</p>
          </div>
        </div>

        {/* Room Status */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl p-8 border border-white/10 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">สถานะ</h3>
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
              room.status === 'waiting' ? 'bg-yellow-500 text-yellow-900' :
              room.status === 'active' ? 'bg-green-500 text-green-900' :
              'bg-gray-500 text-gray-900'
            }`}>
              {room.status === 'waiting' ? 'รอผู้เล่น' : 
               room.status === 'active' ? 'กำลังเล่น' : 'สิ้นสุด'}
            </div>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="relative z-10 mb-8">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>รายชื่อผู้เล่น ({players.length} คน)</span>
            </h2>
          </div>
          
          <div className="p-6">
            {players.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">ยังไม่มีผู้เล่น</h3>
                <p className="text-gray-300">รอให้นักเรียนใส่รหัสห้องเข้ามา</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {players.map((player, index) => (
                  <div key={player._id || index} className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-white">{player.name || `ผู้เล่น ${index + 1}`}</h4>
                      <p className="text-blue-200 text-sm">เข้าร่วมเมื่อ: {new Date(player.joinedAt || Date.now()).toLocaleTimeString('th-TH')}</p>
                    </div>
                    <div className="flex items-center space-x-2 text-green-400">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">ออนไลน์</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start Game Button */}
      <div className="relative z-10 text-center">
        <button
          onClick={handleStartGame}
          disabled={players.length === 0 || room.status !== 'waiting'}
          className={`group relative text-white font-bold py-6 px-12 rounded-3xl transition-all duration-300 shadow-2xl transform flex items-center space-x-6 mx-auto ${
            players.length === 0 || room.status !== 'waiting'
              ? 'bg-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 hover:scale-110 hover:shadow-green-500/25'
          }`}
        >
          <div className="bg-white/20 p-4 rounded-2xl group-hover:bg-white/30 group-hover:rotate-12 transition-all duration-500">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold">
              {room.status === 'waiting' ? 'เริ่มเกม' : 'เกมเริ่มแล้ว'}
            </div>
            <div className="text-green-100">
              {players.length === 0 ? 'รอผู้เล่นเข้าห้อง' : `พร้อมเริ่ม (${players.length} คน)`}
            </div>
          </div>
          {room.status === 'waiting' && players.length > 0 && (
            <div className="absolute -top-3 -right-3 bg-green-500 text-white text-sm font-bold rounded-full w-12 h-12 flex items-center justify-center animate-bounce shadow-xl">
              GO!
            </div>
          )}
        </button>
      </div>
    </div>
  );
}