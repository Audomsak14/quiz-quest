'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { profileStorage } from '@/lib/profileStorage'

export default function ScoresPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("นักเรียน");
  const [playerId, setPlayerId] = useState("");
  const [selectedTab, setSelectedTab] = useState('recent'); // recent, stats
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMap, setSelectedMap] = useState({}); // key `${roomId}:${timestamp}` -> true
  const [history, setHistory] = useState({
    summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
    attempts: [],
    perRoom: []
  });

  useEffect(() => {
    // โหลดชื่อผู้เล่นแบบ sessionStorage-first เพื่อไม่ให้ชื่อไหลข้ามบัญชี/แท็บ
    if (typeof window !== 'undefined') {
      const savedPlayerName = profileStorage.getName();
      if (savedPlayerName) setPlayerName(savedPlayerName);
      const id = profileStorage.ensureId(savedPlayerName || '');
      setPlayerId(id);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError('');
      try {
        const id = profileStorage.getId();
        const name = profileStorage.getName() || '';
        if (!id && !name) { setLoading(false); return; }
        const qs = id ? `playerId=${encodeURIComponent(id)}` : `name=${encodeURIComponent(name)}`;
        const r = await fetch(`http://localhost:5000/api/game/history?${qs}`);
        const data = await r.json();
        if (!data?.success) throw new Error(data?.error || 'failed');
        setHistory({
          summary: data.summary || { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
          attempts: Array.isArray(data.attempts) ? data.attempts : [],
          perRoom: Array.isArray(data.perRoom) ? data.perRoom : []
        });
      } catch (e) {
        setError('ไม่สามารถโหลดประวัติการทำแบบทดสอบได้');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const getScoreColor = (score, maxScore = 100) => {
    const percentage = (maxScore ? (score / maxScore) * 100 : 0);
    if (percentage >= 90) return 'text-green-400';
    if (percentage >= 80) return 'text-blue-400';
    if (percentage >= 70) return 'text-yellow-400';
    if (percentage >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreGrade = (score, maxScore = 100) => {
    const percentage = (maxScore ? (score / maxScore) * 100 : 0);
    if (percentage >= 90) return { grade: 'A', color: 'bg-green-500' };
    if (percentage >= 80) return { grade: 'B+', color: 'bg-blue-500' };
    if (percentage >= 70) return { grade: 'B', color: 'bg-yellow-500' };
    if (percentage >= 60) return { grade: 'C+', color: 'bg-orange-500' };
    return { grade: 'C', color: 'bg-red-500' };
  };

  // Derive correct count robustly: prefer backend value, but if answers show more correct than recorded, use that
  const getCorrectCount = (att) => {
    const byAnswers = Array.isArray(att?.answers) ? att.answers.filter(a => a && a.correct).length : undefined;
    const totalQ = Number.isFinite(att?.totalQuestions) ? att.totalQuestions : (Number.isFinite(att?.questionsTotal) ? att.questionsTotal : undefined);
    const byScore = (Number.isFinite(att?.finalScore) && Number.isFinite(totalQ) && att.finalScore >= 0 && att.finalScore <= totalQ)
      ? att.finalScore
      : undefined;

    // Choose the best available signal
    const values = [
      Number.isFinite(att?.correctCount) ? att.correctCount : undefined,
      typeof byAnswers === 'number' ? byAnswers : undefined,
      typeof byScore === 'number' ? byScore : undefined,
    ].filter(v => typeof v === 'number');

    if (values.length) return Math.max(...values);
    return 0;
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

  // --- Derived summary over attempts (normalized to percentage) ---
  const getTotalQuestions = (att) => (
    Number.isFinite(att?.totalQuestions) ? att.totalQuestions : (Number.isFinite(att?.questionsTotal) ? att.questionsTotal : undefined)
  );
  const getMaxPoints = (att) => {
    const totalQ = getTotalQuestions(att);
    let maxP = (Number.isFinite(att?.maxPoints) && att.maxPoints > 0) ? att.maxPoints : (Number.isFinite(totalQ) && totalQ > 0 ? totalQ : 100);
    if (Number.isFinite(totalQ) && totalQ > 0 && Number.isFinite(att?.finalScore) && att.finalScore <= totalQ) maxP = totalQ; // 1 pt/question normalization
    return maxP;
  };
  const attempts = Array.isArray(history?.attempts) ? history.attempts : [];
  const percentList = attempts.map(a => {
    const maxP = getMaxPoints(a);
    return (maxP > 0) ? Math.max(0, Math.min(100, (Number(a.finalScore) || 0) / maxP * 100)) : 0;
  });
  const avgPercent = percentList.length ? (percentList.reduce((s,v)=>s+v,0) / percentList.length) : 0;
  const bestPercent = percentList.length ? Math.max(...percentList) : 0;

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
            <div className="text-3xl font-bold text-green-400 mb-2">{history.summary.totalTests}</div>
            <p className="text-white/80">แบบทดสอบทั้งหมด</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">{avgPercent.toFixed(0)}%</div>
            <p className="text-white/80">คะแนนเฉลี่ย (เปอร์เซ็นต์)</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">{bestPercent.toFixed(0)}%</div>
            <p className="text-white/80">คะแนนสูงสุด (เปอร์เซ็นต์)</p>
          </div>
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">{history.summary.totalAttempts}</div>
            <p className="text-white/80">จำนวนครั้งที่ทำ</p>
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

        {/* Controls */}
        <div className="flex justify-end items-center gap-3 mb-4">
          <button
            onClick={() => {
              setSelectMode(v => !v);
              setSelectedMap({});
            }}
            className={`px-4 py-2 rounded-xl text-sm ${selectMode ? 'bg-yellow-600/80 hover:bg-yellow-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white/90'}`}
          >{selectMode ? 'ยกเลิกการเลือก' : 'เลือกเพื่อลบ'}</button>

          {selectMode && (
            <button
              disabled={!Object.keys(selectedMap).length}
              onClick={async () => {
                if (!playerId) return;
                const count = Object.keys(selectedMap).length;
                const yes = confirm(`ลบรายการที่เลือกทั้งหมด ${count} รายการหรือไม่?`);
                if (!yes) return;
                try {
                  const tasks = Object.keys(selectedMap).map(async (key) => {
                    const [roomId, ts] = key.split(':');
                    await fetch(`http://localhost:5000/api/game/history?playerId=${encodeURIComponent(playerId)}&roomId=${encodeURIComponent(roomId)}&ts=${encodeURIComponent(ts)}`, { method: 'DELETE' });
                  });
                  await Promise.allSettled(tasks);
                  // Reload history
                  const r = await fetch(`http://localhost:5000/api/game/history?playerId=${encodeURIComponent(playerId)}`);
                  const data = await r.json();
                  if (data?.success) {
                    setHistory({
                      summary: data.summary || { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
                      attempts: Array.isArray(data.attempts) ? data.attempts : [],
                      perRoom: Array.isArray(data.perRoom) ? data.perRoom : []
                    });
                  }
                } catch {}
                setSelectedMap({});
                setSelectMode(false);
              }}
              className={`px-4 py-2 rounded-xl text-sm ${Object.keys(selectedMap).length ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-red-600/40 text-white/60 cursor-not-allowed'}`}
            >ลบที่เลือก ({Object.keys(selectedMap).length || 0})</button>
          )}

          <button
            onClick={async () => {
              if (!playerId) return;
              const yes = confirm('ต้องการลบประวัติทั้งหมดของคุณหรือไม่?');
              if (!yes) return;
              try {
                await fetch(`http://localhost:5000/api/game/history?playerId=${encodeURIComponent(playerId)}`, { method: 'DELETE' });
                // reload list
                const r = await fetch(`http://localhost:5000/api/game/history?playerId=${encodeURIComponent(playerId)}`);
                const data = await r.json();
                if (data?.success) {
                  setHistory({
                    summary: data.summary || { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
                    attempts: Array.isArray(data.attempts) ? data.attempts : [],
                    perRoom: Array.isArray(data.perRoom) ? data.perRoom : []
                  });
                }
              } catch {}
            }}
            className="px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm"
          >ลบประวัติทั้งหมด</button>
        </div>

        {/* Tab Content */}
        {selectedTab === 'recent' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">🏆 ผลการทดสอบล่าสุด</h2>
            {loading && <div className="text-white/80">กำลังโหลดประวัติ…</div>}
            {error && <div className="text-red-300">{error}</div>}
            {!loading && !error && history.attempts.length === 0 && (
              <div className="text-white/70">ยังไม่มีประวัติการทำแบบทดสอบ ลองเริ่มทำแบบทดสอบใหม่ดูนะ</div>
            )}
            {history.attempts.map((att, index) => {
              // Use true max points when available; else fall back to total questions (common case: 1 point per question)
              const totalQ = Number.isFinite(att?.totalQuestions) ? att.totalQuestions : (Number.isFinite(att?.questionsTotal) ? att.questionsTotal : undefined);
              // Start from server-provided max or fall back to number of questions (1 point per question)
              let maxPoints = (Number.isFinite(att?.maxPoints) && att.maxPoints > 0)
                ? att.maxPoints
                : (Number.isFinite(totalQ) && totalQ > 0 ? totalQ : 100);
              // If it looks like a 1-point-per-question set (score never exceeds totalQ), normalize to totalQ
              if (Number.isFinite(totalQ) && totalQ > 0 && Number.isFinite(att?.finalScore) && att.finalScore <= totalQ) {
                maxPoints = totalQ;
              }
              const gradeInfo = getScoreGrade(att.finalScore, maxPoints);
              const dt = att.timestamp ? new Date(att.timestamp) : null;
              const dateStr = dt ? dt.toLocaleDateString('th-TH') : '-';
              const timeStr = dt ? dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={`${att.roomId}-${att.timestamp || index}`} className="relative backdrop-blur-md bg-white/10 rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
                  {selectMode && (
                    <label className="absolute top-4 left-4 inline-flex items-center gap-2 text-white/80">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-red-500"
                        checked={!!selectedMap[`${att.roomId}:${att.timestamp}`]}
                        onChange={(e) => {
                          const key = `${att.roomId}:${att.timestamp}`;
                          setSelectedMap(prev => {
                            const next = { ...prev };
                            if (e.target.checked) next[key] = true; else delete next[key];
                            return next;
                          });
                        }}
                      />
                      <span className="text-xs">เลือก</span>
                    </label>
                  )}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl ${gradeInfo.color} flex items-center justify-center text-white font-bold text-xl shadow-xl`}>
                        {gradeInfo.grade}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{att.roomName}</h3>
                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <span>📚 {att.questionSetTitle}</span>
                          <span>📅 {dateStr}</span>
                          <span>⏰ {timeStr}</span>
                          {Number.isFinite(att.rank) && Number.isFinite(att.totalPlayers) && (
                            <span>🏅 อันดับ: <span className="text-yellow-300 font-semibold">{att.rank}</span> / {att.totalPlayers}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-4xl font-bold mb-2 ${getScoreColor(att.finalScore, maxPoints)}`}>
                        {att.finalScore}<span className="text-white/50">/{maxPoints}</span>
                      </div>
                      <div className="text-sm text-white/70">
                        {maxPoints ? (((att.finalScore / maxPoints) * 100).toFixed(1)) : '-'}%
                      </div>
                      <div className="mt-2">
                        <button
                          className="text-xs text-red-300 hover:text-red-200 underline"
                          onClick={async () => {
                            if (!playerId || !att.timestamp || !att.roomId) return;
                            const yes = confirm('ลบรายการนี้หรือไม่?');
                            if (!yes) return;
                            try {
                              await fetch(`http://localhost:5000/api/game/history?playerId=${encodeURIComponent(playerId)}&roomId=${encodeURIComponent(att.roomId)}&ts=${encodeURIComponent(att.timestamp)}`, { method: 'DELETE' });
                              // remove locally
                              setHistory(prev => ({
                                ...prev,
                                attempts: prev.attempts.filter(a => !(a.roomId === att.roomId && a.timestamp === att.timestamp))
                              }));
                            } catch {}
                          }}
                        >ลบรายการนี้</button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-white/70">
                      <div>🧪 โค้ดห้อง: <span className="text-white font-semibold">{att.roomCode || '-'}</span></div>
                      {Number.isFinite(att.completionTime) && (
                        <div>⏱️ เวลา: <span className="text-white font-semibold">{Math.round(att.completionTime/1000)} วินาที</span></div>
                      )}
                      {(Number.isFinite(att.correctCount) || (Array.isArray(att.answers) && att.answers.length > 0) || Number.isFinite(totalQ)) && (
                        <div>✅ ตอบถูก: <span className="text-white font-semibold">{getCorrectCount(att)}</span>/{(Number.isFinite(totalQ) ? totalQ : '-')}</div>
                      )}
                    </div>
                    <div className="text-right text-white/70">
                      <div>ครั้งที่ทำทั้งหมดในห้องนี้: <span className="text-white font-semibold">{history.perRoom.find(p=>p.roomId===att.roomId)?.attempts || 1}</span></div>
                    </div>
                  </div>

                  {Array.isArray(att.answers) && att.answers.length > 0 && (
                    <div className="mt-6 bg-white/5 rounded-2xl p-4 border border-white/10">
                      <div className="text-white/80 font-semibold mb-2">รายละเอียดคำตอบ</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {att.answers.map((ans, idx) => (
                          <div key={`${ans.questionId||idx}-${idx}`} className={`rounded-xl p-3 border ${ans.correct ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
                            <div className="flex items-center justify-between">
                              <div>ข้อ {idx + 1} {ans.correct ? '✅ ถูก' : '❌ ผิด'}</div>
                              {typeof ans.selectedIndex === 'number' && (<div className="text-xs opacity-80">เลือก: {ans.selectedIndex + 1}</div>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <div className="text-white/70">สรุปจากประวัติการทำจริงของคุณในระบบ</div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-sm text-white/70">แบบทดสอบทั้งหมด</div>
                      <div className="text-2xl font-extrabold text-green-400">{history.summary.totalTests}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-sm text-white/70">จำนวนครั้งที่ทำ</div>
                      <div className="text-2xl font-extrabold text-purple-300">{history.summary.totalAttempts}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-sm text-white/70">คะแนนเฉลี่ย</div>
                      <div className="text-2xl font-extrabold text-blue-400">{history.summary.averageScore}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-sm text-white/70">คะแนนสูงสุด</div>
                      <div className="text-2xl font-extrabold text-yellow-400">{history.summary.bestScore}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-md bg-white/10 rounded-3xl p-8 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  สรุปตามห้องที่เคยทำ
                </h3>
                <div className="space-y-3">
                  {history.perRoom.map((r) => (
                    <div key={r.roomId} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">{r.roomName}</div>
                        <div className="text-xs text-white/60">{r.questionSetTitle}</div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-white/70">ครั้งที่ทำ: <span className="text-white font-semibold">{r.attempts}</span></div>
                        <div className="text-white/70">คะแนนสูงสุด: <span className="text-yellow-300 font-semibold">{r.bestScore}</span></div>
                      </div>
                    </div>
                  ))}
                  {history.perRoom.length === 0 && <div className="text-white/70">ยังไม่มีข้อมูลห้องที่เคยทำ</div>}
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