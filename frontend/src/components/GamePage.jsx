import React, { useEffect, useMemo, useState, useRef } from "react";

// GamePage.jsx
// - Plain React component using TailwindCSS classes
// - Optional socket support: pass `socketUrl` prop to enable socket.io (client will be dynamically imported)
// - If you use Next.js, import and use this component inside a page (e.g. /app/game/page.jsx)

export default function GamePage({
  questions = null, // optional override; otherwise uses exampleQuestions
  // socket client intentionally not auto-imported; pass one via props in future if needed
  playerId = null // optional id used for socket messages
}) {
  // example questions if none provided
  const exampleQuestions = useMemo(() => [
    {
      id: "q1",
      text: "What is the capital of Japan?",
      choices: ["Seoul", "Tokyo", "Beijing", "Bangkok"],
      answerIndex: 1,
      timeLimit: 10
    },
    {
      id: "q2",
      text: "Which planet is known as the Red Planet?",
      choices: ["Earth", "Mars", "Jupiter", "Venus"],
      answerIndex: 1,
      timeLimit: 10
    },
    {
      id: "q3",
      text: "Which language runs in a web browser?",
      choices: ["Python", "C#", "JavaScript", "Rust"],
      answerIndex: 2,
      timeLimit: 12
    }
  ], []);

  const qList = questions || exampleQuestions;

  // try to get roomId from URL (for refresh-resume requirement)
  const [roomId, setRoomId] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        return p.get("roomId") || null;
      }
    } catch (e) {}
    return null;
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    // resume from sessionStorage if roomId present
    try {
      if (roomId) {
        const saved = sessionStorage.getItem(`quiz_${roomId}_index`);
        return saved ? Number(saved) : 0;
      }
    } catch (e) {}
    return 0;
  });
  const [score, setScore] = useState(() => {
    try {
      if (roomId) {
        const s = sessionStorage.getItem(`quiz_${roomId}_score`);
        return s ? Number(s) : 0;
      }
    } catch (e) {}
    return 0;
  });
  const [answers, setAnswers] = useState(() => {
    try {
      if (roomId) {
        const a = sessionStorage.getItem(`quiz_${roomId}_answers`);
        return a ? JSON.parse(a) : [];
      }
    } catch (e) {}
    return [];
  });

  const currentQuestion = qList[currentIndex];

  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const socketRef = useRef(null);

  // persist minimal state so refresh resumes
  useEffect(() => {
    if (!roomId) return;
    sessionStorage.setItem(`quiz_${roomId}_index`, String(currentIndex));
    sessionStorage.setItem(`quiz_${roomId}_score`, String(score));
    sessionStorage.setItem(`quiz_${roomId}_answers`, JSON.stringify(answers));
  }, [currentIndex, score, answers, roomId]);

  // Honor global kick-all: if flagged or room not active, force-student back to lobby
  useEffect(() => {
    if (!roomId) return;
    try {
      if (typeof window !== 'undefined') {
        const flagged = window.sessionStorage.getItem(`qq:kicked:${roomId}`) === '1';
        if (flagged) {
          try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
          return;
        }
      }
    } catch {}
    let timer;
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`http://localhost:5000/api/game/room/${roomId}`);
        const data = await r.json();
        const status = data?.room?.status || data?.status;
        if (!cancelled && status && status !== 'active') {
          try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, '1'); } catch {}
          try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
        }
      } catch {}
    };
    timer = setInterval(check, 1500);
    check();
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomId]);

  // reset when moving to a new question
  useEffect(() => {
    setIsAnswered(false);
    setSelectedIndex(null);
    // Timer removed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Time-based scoring removed; use fixed per-question points (100)

  // Time-up behavior removed (no countdown)

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelectedIndex(idx);
    setIsAnswered(true);
    const correct = idx === currentQuestion.answerIndex;
    const earned = correct ? 100 : 0;
    if (correct) setScore((s) => s + earned);
    const record = {
      questionId: currentQuestion.id,
      selectedIndex: idx,
      correct,
      earned
    };
    setAnswers((a) => [...a, record]);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("sendAnswer", {
        roomId,
        playerId,
        questionId: currentQuestion.id,
        selectedIndex: idx,
        correct,
        earned
      });
    }

    // auto next after 2s
    setTimeout(() => goNext(), 1200);
  };

  const goNext = () => {
    if (currentIndex + 1 >= qList.length) {
      setIsFinished(true);
      // optionally emit finalization
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("playerFinished", { roomId, playerId, score });
      }
      return;
    }
    const next = currentIndex + 1;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("nextQuestion", { roomId, nextIndex: next });
    }
    setCurrentIndex(next);
  };

  const restart = () => {
    setCurrentIndex(0);
    setScore(0);
    setAnswers([]);
    setIsFinished(false);
    // clear session storage
    try {
      if (roomId) {
        sessionStorage.removeItem(`quiz_${roomId}_index`);
        sessionStorage.removeItem(`quiz_${roomId}_score`);
        sessionStorage.removeItem(`quiz_${roomId}_answers`);
      }
    } catch (e) {}
  };

  // UI helpers
  // Progress/time UI removed

  if (!currentQuestion) return <div className="p-8 text-white">No questions provided.</div>;

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-[#030637] to-[#180161] text-white">
        <div className="max-w-2xl w-full bg-white/5 rounded-3xl p-8 border border-white/10 shadow-xl">
          <h2 className="text-3xl font-bold mb-4">สรุปคะแนน</h2>
          <div className="text-6xl font-extrabold text-green-400 mb-6">{score}</div>
          <div className="space-y-3 mb-6">
            {answers.map((a, i) => {
              const q = qList.find((qq) => qq.id === a.questionId) || {};
              return (
                <div key={i} className="flex items-center justify-between bg-white/3 p-3 rounded-lg">
                  <div>
                    <div className="font-semibold">{q.text}</div>
                    <div className="text-sm text-white/70">คำตอบที่เลือก: {a.selectedIndex === null ? 'ไม่ตอบ' : q.choices[a.selectedIndex]}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${a.correct ? 'text-green-300' : 'text-red-300'}`}>{a.correct ? `+${a.earned}` : `+0`}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button onClick={restart} className="bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 rounded-2xl font-bold">เล่นใหม่</button>
            <div className="text-right">
              <div className="text-sm text-white/70">รวมคำถาม: {qList.length}</div>
              <div className="text-sm text-white/70">คำตอบที่ถูก: {answers.filter(a=>a.correct).length}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-[#030637] to-[#180161] text-white flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* Top bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="text-sm text-white/70">คำถาม {currentIndex + 1} / {qList.length}</div>
              <div className="text-sm text-white/70">คะแนน: <span className="font-bold text-green-300">{score}</span></div>
            </div>
            <div className="text-sm text-white/70">รหัสห้อง: {roomId || '-'}</div>
          </div>

          {/* Timer/progress removed */}
        </div>

        {/* Question Card */}
        <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 transition-all duration-300">
          <h3 className="text-xl text-white/90 font-bold mb-4">{currentQuestion.text}</h3>

          <div className="grid gap-3">
            {currentQuestion.choices.map((c, idx) => {
              const isCorrect = idx === currentQuestion.answerIndex;
              const isSelected = selectedIndex === idx;
              const showCorrect = isAnswered && isCorrect;
              const showWrong = isAnswered && isSelected && !isCorrect;

              let baseClass = "p-4 rounded-lg text-left font-semibold transition-all cursor-pointer";
              if (!isAnswered) baseClass += " bg-white/6 hover:bg-white/12";
              if (showCorrect) baseClass += " bg-green-500 text-white";
              if (showWrong) baseClass += " bg-red-500 text-white line-through";
              if (isAnswered && !showCorrect && !showWrong) baseClass += " bg-white/3 text-white/80 cursor-not-allowed";

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={baseClass}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold">{String.fromCharCode(65 + idx)}</div>
                      <div>{c}</div>
                    </div>
                    {isAnswered && isCorrect && <div className="text-sm font-bold text-white/90">ถูก</div>}
                    {isAnswered && isSelected && !isCorrect && <div className="text-sm font-bold text-white/90">ผิด</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-white/80">คำถามนี้ให้ <span className="font-bold">100</span> แต้ม + โบนัสเวลาที่เหลือ</div>
            <div>
              {!isAnswered ? (
                <div className="text-sm text-white/60">ตอบได้จนกว่าเวลาจะหมด</div>
              ) : (
                <button onClick={goNext} className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-lg font-bold">ข้อถัดไป</button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
