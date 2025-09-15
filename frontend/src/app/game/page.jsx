'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gamePhase, setGamePhase] = useState('waiting'); // waiting, starting, playing, finished
  const role = searchParams.get('role'); // 'teacher' or 'student'
  const roomId = searchParams.get('roomId');
  
  const isTeacher = role === 'teacher';

  useEffect(() => {
    // Simulate game preparation
    const timer = setTimeout(() => {
      setGamePhase('starting');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const goBackToGameroom = () => {
    if (isTeacher) {
      router.push(`/teacher-room/${roomId}`);
    } else {
      router.push('/StudentDashboard/gameroom');
    }
  };

  const goBackToDashboard = () => {
    if (isTeacher) {
      router.push('/TeacherDashboard');
    } else {
      router.push('/StudentDashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-2000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBackToGameroom}
            className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors duration-300 group"
          >
            <div className="p-2 rounded-full border border-white/20 group-hover:border-purple-300/50 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className="text-lg font-medium">
              {isTeacher ? 'กลับไปจัดการห้อง' : 'กลับไปหาห้องเกม'}
            </span>
          </button>
          
          <div className="text-right">
            <h1 className="text-4xl font-bold text-white mb-2">
              🎮 Quiz Quest {isTeacher ? '(ครู)' : ''}
            </h1>
            <p className="text-purple-300 text-lg">
              {isTeacher ? 'กำลังรอผู้เล่นเข้าร่วม' : 'เตรียมพร้อมสำหรับการแข่งขัน'}
            </p>
          </div>
        </div>

        {/* Game Status */}
        <div className="max-w-4xl mx-auto">
          {gamePhase === 'waiting' && (
            <div className="backdrop-blur-md bg-white/10 rounded-3xl p-12 border border-white/20 text-center">
              <div className="mb-8">
                <div className="w-24 h-24 mx-auto bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-12 h-12 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">
                  {isTeacher ? 'กำลังรอผู้เล่น...' : 'กำลังเตรียมเกม...'}
                </h2>
                <p className="text-purple-300 text-xl">
                  {isTeacher ? 'ผู้เล่นกำลังเข้าร่วมห้อง รอสักครู่' : 'กรุณารอสักครู่ เรากำลังโหลดคำถามให้คุณ'}
                </p>
              </div>
              
              <div className="space-y-4 text-white/80">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce delay-200"></div>
                </div>
                <p className="text-lg">
                  {isTeacher ? 'ระบบกำลังรอผู้เล่นและเตรียมเกม...' : 'โหลดคำถาม และเตรียมห้องแข่งขัน...'}
                </p>
              </div>
            </div>
          )}

          {gamePhase === 'starting' && (
            <div className="backdrop-blur-md bg-white/10 rounded-3xl p-12 border border-white/20 text-center">
              <div className="mb-8">
                <div className="w-32 h-32 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">พร้อมเล่นแล้ว! 🎉</h2>
                <p className="text-green-300 text-xl mb-6">เกมจะเริ่มในอีกไม่ช้า...</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-3xl mb-2">📝</div>
                  <h3 className="text-lg font-bold text-white mb-2">คำถาม</h3>
                  <p className="text-white/70">พร้อมแล้ว</p>
                </div>
                <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-3xl mb-2">👥</div>
                  <h3 className="text-lg font-bold text-white mb-2">ผู้เล่น</h3>
                  <p className="text-white/70">เข้าร่วมแล้ว</p>
                </div>
                <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-3xl mb-2">⏱️</div>
                  <h3 className="text-lg font-bold text-white mb-2">เวลา</h3>
                  <p className="text-white/70">เริ่มเกมแล้ว</p>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-white/80 text-lg mb-4">ฟีเจอร์เกมจะมาในเร็วๆ นี้...</p>
                <button
                  onClick={isTeacher ? goBackToDashboard : goBackToGameroom}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                  {isTeacher ? 'กลับไปแดชบอร์ดครู' : 'กลับไปหาห้องเกมอื่น'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Features Preview */}
        <div className="max-w-6xl mx-auto mt-12">
          <h3 className="text-2xl font-bold text-white text-center mb-8">ฟีเจอร์ที่กำลังจะมา</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="backdrop-blur-md bg-white/5 rounded-xl p-6 border border-white/10 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <h4 className="text-lg font-bold text-white mb-2">คะแนนแบบเรียลไทม์</h4>
              <p className="text-white/60 text-sm">ติดตามคะแนนแบบสด</p>
            </div>
            <div className="backdrop-blur-md bg-white/5 rounded-xl p-6 border border-white/10 text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h4 className="text-lg font-bold text-white mb-2">ตอบรับแบบทันที</h4>
              <p className="text-white/60 text-sm">ระบบตอบคำถามเร็ว</p>
            </div>
            <div className="backdrop-blur-md bg-white/5 rounded-xl p-6 border border-white/10 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h4 className="text-lg font-bold text-white mb-2">พาวเวอร์อัพ</h4>
              <p className="text-white/60 text-sm">ไอเทมพิเศษในเกม</p>
            </div>
            <div className="backdrop-blur-md bg-white/5 rounded-xl p-6 border border-white/10 text-center">
              <div className="text-4xl mb-4">👑</div>
              <h4 className="text-lg font-bold text-white mb-2">อันดับแชมป์</h4>
              <p className="text-white/60 text-sm">ระบบจัดอันดับผู้เล่น</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">กำลังโหลดหน้าเกม...</div>}>
      <GameContent />
    </Suspense>
  );
}