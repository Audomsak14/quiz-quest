'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import socketManager from '../lib/socket';
import { profileStorage } from '@/lib/profileStorage';

export default function GameLobby() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const roomId = searchParams.get('roomId');
  const isDemo = searchParams.get('demo') === '1';
  const playerName = searchParams.get('playerName') || profileStorage.getName() || 'Player';
  const providedPlayerId = searchParams.get('playerId') || profileStorage.ensureId(playerName) || null;
  
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  useEffect(() => {
    if (isDemo) {
      // โหมดตัวอย่าง: ไม่ต่อ socket (แสดงหน้ารอเริ่มเกมอย่างเดียว)
      setIsConnected(true);
      setConnectionStatus('connected');
      setRoomData({ status: 'waiting', players: [{ name: playerName }] });
      return;
    }
    if (!roomId) {
      router.push('/StudentDashboard/gameroom');
      return;
    }
    
    // Connect to socket
    socketManager.connect();
    
    socketManager.on('connected', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
      const success = socketManager.joinRoom(roomId, playerName, 'student', providedPlayerId);
      setIsConnected(success);
    });
    
    socketManager.on('roomState', (data) => {
      console.log('Room state:', data);
      setRoomData(data);
      
      if (data.status === 'active') {
        setGameStarted(true);
        // Redirect to actual game
        router.push(`/game?roomId=${roomId}&role=student&playerName=${playerName}`);
      }
      
      if (data.players) {
        setPlayers(data.players.filter(p => p.role !== 'teacher'));
      }
    });
    
    socketManager.on('playerJoined', (data) => {
      if (data.role !== 'teacher') {
        setPlayers(prev => {
          const existing = prev.find(p => p.playerId === data.playerId);
          if (existing) return prev;
          return [...prev, data];
        });
      }
    });
    
    socketManager.on('gameStarted', () => {
      console.log('🎮 Game started event received! Redirecting to game...');
      setGameStarted(true);
      // Redirect to game with smooth animation
      setTimeout(() => {
        console.log('🔄 Navigating to game page...');
        router.push(`/game?roomId=${roomId}&role=student&playerName=${playerName}`);
      }, 1000);
    });
    
    return () => {
      socketManager.disconnect();
    };
  }, [roomId, playerName, router, isDemo, providedPlayerId]);
  
  // Fallback: poll backend room status every 2s in case socket event is missed
  useEffect(() => {
    if (isDemo) return; // ไม่ต้อง poll ในโหมดตัวอย่าง
    if (!roomId || gameStarted) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/game/room/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.room?.status || data?.status;
        if (!cancelled && status === 'active') {
          console.log('✅ Room became active via polling, redirecting...');
          setGameStarted(true);
          router.push(`/game?roomId=${roomId}&role=student&playerName=${playerName}`);
        }
      } catch (e) {
        // ignore network errors for polling
      }
    };
    const id = setInterval(checkStatus, 2000);
    checkStatus();
    return () => { cancelled = true; clearInterval(id); };
  }, [roomId, playerName, gameStarted, router, isDemo]);

  if (!roomId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-indigo-500/20 rounded-full blur-xl animate-pulse delay-2000"></div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/30 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        {!gameStarted ? (
          // Waiting for game to start
          <div className="text-center max-w-2xl mx-auto">
            {/* Main Title */}
            <div className="mb-8">
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-4 animate-pulse">
                QUIZ QUEST
              </h1>
              <div className="w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto rounded-full"></div>
            </div>

            {/* Status Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border border-white/20 shadow-2xl">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-cyan-400/30 rounded-full animate-spin">
                    <div className="w-4 h-4 bg-cyan-400 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">⚡</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-2">กำลังรอเริ่มเกม</h2>
              <p className="text-cyan-300 text-lg mb-6">รอให้ครูกดปุ่มเริ่มเกม เกมจะเริ่มในไม่ช้า</p>
              
              <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white">ห้อง: {roomId}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-white">ผู้เล่น: {playerName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-white">{isConnected ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ'}</span>
                </div>
              </div>
            </div>

            {/* Players List */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center">
                <span className="mr-2">👥</span>
                ผู้เล่นที่เข้าร่วม ({players.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {players.map((player, index) => (
                  <div key={player.playerId || index} className="bg-white/20 rounded-lg p-3 text-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {(player.name || player.playerName || 'P')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-white text-sm font-medium truncate">
                      {player.name || player.playerName || 'Player'}
                      {player.playerId === socketManager.getPlayerId() && (
                        <span className="block text-cyan-300 text-xs">(คุณ)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Instructions */}
            <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl p-6 border border-purple-300/30">
              <h4 className="text-lg font-bold text-white mb-3 flex items-center justify-center">
                <span className="mr-2">🎮</span>
                วิธีเล่น
              </h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-cyan-100">
                <div className="text-center">
                  <div className="text-2xl mb-2">🗺️</div>
                  <p>เดินในแมพเพื่อหาจุดคำถาม</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">❓</div>
                  <p>เข้าใกล้เครื่องหมาย ? เพื่อตอบ</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">🏆</div>
                  <p>ตอบถูกได้ 100 แต้ม</p>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => router.push('/StudentDashboard/gameroom')}
              className="mt-6 px-6 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
            >
              ← กลับไปห้องเกม
            </button>
          </div>
        ) : (
          // Game is starting
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 border-4 border-green-400 rounded-full mx-auto mb-4 animate-spin">
                <div className="w-6 h-6 bg-green-400 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2"></div>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-green-400 mb-4 animate-bounce">🎮 เกมเริ่มแล้ว!</h2>
            <p className="text-white text-lg">กำลังเข้าสู่เกม...</p>
          </div>
        )}
      </div>
    </div>
  );
}