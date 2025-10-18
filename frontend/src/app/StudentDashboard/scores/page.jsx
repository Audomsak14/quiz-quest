'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { profileStorage } from '@/lib/profileStorage'

export default function ScoresPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("นักเรียน");
  const [selectedTab, setSelectedTab] = useState('recent'); // recent, history, stats

  // Mock data - ข้อมูลคะแนนตัวอย่าง
  const [scoresData] = useState({
    recent: [
      {
        id: 1,
        testName: "การทดสอบคณิตศาสตร์ ชั้น ม.3",
        score: 85,
        maxScore: 100,
        date: "2025-09-14",
        time: "14:30",
        duration: "45 นาที",
        rank: 12,
        totalPlayers: 45,
        subject: "คณิตศาสตร์",
        difficulty: "ปานกลาง"
      },
      {
        id: 2,
        testName: "แบบทดสอบภาษาอังกฤษ Unit 5",
        score: 92,
        maxScore: 100,
        date: "2025-09-13",
        time: "10:15",
        duration: "30 นาที",
        rank: 3,
        totalPlayers: 28,
        subject: "ภาษาอังกฤษ",
        difficulty: "ยาก"
      },
      {
        id: 3,
        testName: "วิทยาศาสตร์ เรื่องธาตุและสารประกอบ",
        score: 78,
        maxScore: 100,
        date: "2025-09-12",
        time: "16:45",
        duration: "60 นาที",
        rank: 18,
        totalPlayers: 35,
        subject: "วิทยาศาสตร์",
        difficulty: "ยาก"
      }
    ],
    stats: {
      totalTests: 15,
      averageScore: 84.2,
      bestScore: 98,
      worstScore: 65,
      totalTimePlayed: "12 ชั่วโมง 35 นาที",
      favoriteSubject: "ภาษาอังกฤษ",
      strongestTopic: "Grammar & Vocabulary",
      improvementNeeded: "คณิตศาสตร์ขั้นสูง"
    }
  });

  useEffect(() => {
    // โหลดชื่อผู้เล่นแบบ sessionStorage-first เพื่อไม่ให้ชื่อไหลข้ามบัญชี/แท็บ
    if (typeof window !== 'undefined') {
      const savedPlayerName = profileStorage.getName();
      if (savedPlayerName) setPlayerName(savedPlayerName);
    }
  }, []);

  const getScoreColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'text-green-400';
    if (percentage >= 80) return 'text-blue-400';
    if (percentage >= 70) return 'text-yellow-400';
    if (percentage >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreGrade = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return { grade: 'A', color: 'bg-green-500' };
    if (percentage >= 80) return { grade: 'B+', color: 'bg-blue-500' };
    if (percentage >= 70) return { grade: 'B', color: 'bg-yellow-500' };
    if (percentage >= 60) return { grade: 'C+', color: 'bg-orange-500' };
    return { grade: 'C', color: 'bg-red-500' };
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'ง่าย': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'ปานกลาง': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'ยาก': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRankColor = (rank, total) => {
    const percentage = (rank / total) * 100;
    if (percentage <= 10) return 'text-yellow-400'; // Top 10%
    if (percentage <= 25) return 'text-green-400'; // Top 25%
    if (percentage <= 50) return 'text-blue-400'; // Top 50%
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-2000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/StudentDashboard')}
            className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors duration-300 group"
          >
            <div className="p-2 rounded-full border border-white/20 group-hover:border-purple-300/50 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className="text-lg font-medium">กลับไปแดชบอร์ด</span>
          </button>
          
          <div className="text-right">
            <h1 className="text-4xl font-bold text-white mb-2">📊 ผลคะแนนของฉัน</h1>
            <p className="text-purple-300 text-lg">สวัสดี {playerName}!</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">{scoresData.stats.totalTests}</div>
            <p className="text-white/80">แบบทดสอบทั้งหมด</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">{scoresData.stats.averageScore}</div>
            <p className="text-white/80">คะแนนเฉลี่ย</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">{scoresData.stats.bestScore}</div>
            <p className="text-white/80">คะแนนสูงสุด</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">{scoresData.stats.totalTimePlayed}</div>
            <p className="text-white/80">เวลาเล่นทั้งหมด</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setSelectedTab('recent')}
            className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              selectedTab === 'recent'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📋 คะแนนล่าสุด
          </button>
          <button
            onClick={() => setSelectedTab('stats')}
            className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              selectedTab === 'stats'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📈 สถิติโดยรวม
          </button>
        </div>

        {/* Tab Content */}
        {selectedTab === 'recent' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">🏆 ผลการทดสอบล่าสุด</h2>
            {scoresData.recent.map((test, index) => {
              const gradeInfo = getScoreGrade(test.score, test.maxScore);
              return (
                <div key={test.id} className="backdrop-blur-md bg-white/10 rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl ${gradeInfo.color} flex items-center justify-center text-white font-bold text-xl shadow-xl`}>
                        {gradeInfo.grade}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{test.testName}</h3>
                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <span>📚 {test.subject}</span>
                          <span>📅 {test.date}</span>
                          <span>⏰ {test.time}</span>
                          <span>⏱️ {test.duration}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-4xl font-bold mb-2 ${getScoreColor(test.score, test.maxScore)}`}>
                        {test.score}<span className="text-white/50">/{test.maxScore}</span>
                      </div>
                      <div className="text-sm text-white/70">
                        {((test.score / test.maxScore) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold border ${getDifficultyColor(test.difficulty)}`}>
                        {test.difficulty}
                      </div>
                      <div className={`font-bold ${getRankColor(test.rank, test.totalPlayers)}`}>
                        🏅 อันดับ {test.rank}/{test.totalPlayers}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-white/70 mb-1">เปอร์เซ็นต์ไทล์</div>
                      <div className="text-lg font-bold text-purple-300">
                        {(100 - ((test.rank - 1) / test.totalPlayers * 100)).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedTab === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">📊 สถิติและผลการวิเคราะห์</h2>
            
            {/* Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="backdrop-blur-md bg-white/10 rounded-3xl p-8 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  การวิเคราะห์ผลงาน
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">วิชาที่ชอบที่สุด</span>
                    <span className="text-green-400 font-bold">{scoresData.stats.favoriteSubject}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">หัวข้อที่เก่งที่สุด</span>
                    <span className="text-blue-400 font-bold">{scoresData.stats.strongestTopic}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">ควรพัฒนา</span>
                    <span className="text-yellow-400 font-bold">{scoresData.stats.improvementNeeded}</span>
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-md bg-white/10 rounded-3xl p-8 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  ความสำเร็จ
                </h3>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-4 border border-yellow-500/30">
                    <div className="text-yellow-400 font-bold mb-1">🥇 นักเรียนดีเด่น</div>
                    <div className="text-sm text-white/80">ทำคะแนนได้ 90+ ถึง 5 ครั้ง</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl p-4 border border-blue-500/30">
                    <div className="text-blue-400 font-bold mb-1">⚡ ความสม่ำเสมอ</div>
                    <div className="text-sm text-white/80">ทำแบบทดสอบติดต่อกัน 7 วัน</div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-4 border border-purple-500/30">
                    <div className="text-purple-400 font-bold mb-1">🚀 การพัฒนา</div>
                    <div className="text-sm text-white/80">คะแนนเพิ่มขึ้น 15% ในเดือนนี้</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => router.push('/StudentDashboard/gameroom')}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center gap-3"
          >
            <span className="text-2xl">🎮</span>
            ทำแบบทดสอบใหม่
          </button>
          <button
            onClick={() => router.push('/StudentDashboard')}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center gap-3"
          >
            <span className="text-2xl">🏠</span>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}