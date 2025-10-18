"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from "../lib/socket";
import SpectatorSideScroller from "./SpectatorSideScroller";

export default function TeacherGameView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params
  const [roomId] = useState(() => searchParams.get("roomId") || "");
  const [playerName] = useState("Teacher");

  // Connection and game state
  const [isConnected, setIsConnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [competitionMode, setCompetitionMode] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [students, setStudents] = useState({}); // { playerId: { name, score, x, y, role } }
  const [gameResults, setGameResults] = useState(null);
  const [spectateOpen, setSpectateOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  // Load room info + questions
  useEffect(() => {
    const load = async () => {
      if (!roomId) return;
      const fetchJson = async (url, { retries = 2, delay = 400 } = {}) => {
        let lastErr;
        for (let i = 0; i <= retries; i++) {
          try {
            const res = await fetch(url, { mode: 'cors' });
            // fetch doesn't throw on 4xx/5xx; try parsing json anyway
            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, status: res.status, data };
          } catch (err) {
            lastErr = err;
            if (i < retries) await new Promise(r => setTimeout(r, delay * (i + 1)));
          }
        }
        throw lastErr || new Error('Failed to fetch');
      };

      try {
        const r = await fetchJson(`http://localhost:5000/api/game/room/${roomId}`);
        if (r?.data?.success) setRoomInfo(r.data.room);

        const q = await fetchJson(`http://localhost:5000/api/game/questions/${roomId}`);
        if (q?.data?.success) {
          setRoomInfo((prev) => ({
            ...(prev || {}),
            questions: q.data.questions,
            questionSetTitle: q.data.questionSetTitle,
            questionSetId: q.data.questionSetId || prev?.questionSetId,
          }));
        }
      } catch (e) {
        console.error("Teacher: failed loading room/questions", e);
      }
    };
    load();
  }, [roomId]);

  // Sockets
  useEffect(() => {
    if (!roomId || !playerName) return;

    socketManager.connect();

    const onConnected = () => {
      const ok = socketManager.joinRoom(roomId, playerName, "teacher");
      setIsConnected(ok);
    };

    const onRoomState = (data) => {
      if (data?.status) setGameStarted(data.status === "active");
      if (typeof data?.competition !== 'undefined') setCompetitionMode(!!data.competition);
      if (Array.isArray(data?.players)) {
        const obj = {};
        data.players.forEach((p) => {
          if (p.role !== 'teacher') obj[p.playerId] = { ...p, lastSeen: Date.now() };
        });
        setStudents(obj);
      }
    };

    const onPlayerJoined = (p) => {
      if (p?.role === "teacher") return;
      setStudents((prev) => ({ ...prev, [p.playerId]: { ...(prev[p.playerId] || {}), ...p, lastSeen: Date.now() } }));
    };

    const onPlayerMoved = (p) => {
      setStudents((prev) => ({ ...prev, [p.playerId]: { ...(prev[p.playerId] || {}), ...p, lastSeen: Date.now() } }));
    };

    const onGameStarted = () => {
      setGameStarted(true);
    };

    const onCompetitionMode = (payload) => {
      if (payload?.roomId === roomId) {
        setCompetitionMode(!!payload.enabled);
      }
    };

    const onGameResults = (payload) => {
      setGameResults(payload);
    };

    const onPlayerLeft = (payload) => {
      const pid = payload?.playerId;
      if (!pid) return;
      setStudents((prev) => {
        if (!prev[pid]) return prev;
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
    };

    socketManager.on("connected", onConnected);
    socketManager.on("roomState", onRoomState);
    socketManager.on("playerJoined", onPlayerJoined);
    socketManager.on("playerMoved", onPlayerMoved);
    socketManager.on("gameStarted", onGameStarted);
  socketManager.on("competitionMode", onCompetitionMode);
    socketManager.on("gameResults", onGameResults);
    socketManager.on("playerLeft", onPlayerLeft);

    return () => {
      socketManager.disconnect();
      setIsConnected(false);
    };
  }, [roomId, playerName]);

  const studentIds = useMemo(() => Object.keys(students || {}), [students]);
  const cycleSelection = useCallback((dir) => {
    if (studentIds.length === 0) return;
    const idx = selectedPlayerId ? Math.max(0, studentIds.indexOf(selectedPlayerId)) : -1;
    const nextIdx = (idx + dir + studentIds.length) % studentIds.length;
    setSelectedPlayerId(studentIds[nextIdx]);
  }, [studentIds, selectedPlayerId]);

  const startGame = () => {
    if (isConnected && roomId) socketManager.socketEmit("startGame", { roomId });
  };

  const toggleCompetition = () => {
    const newVal = !competitionMode;
    setCompetitionMode(newVal);
    if (isConnected && roomId) socketManager.socketEmit('setCompetition', { roomId, enabled: newVal });
  };

  // When teacher goes back home, force-eject everyone first
  const backAndKickAll = async () => {
    try { socketManager.socketEmit('returnToLobby', { roomId }); } catch {}
    // Also call secured kick-all to force disconnects (with auth if available)
    try {
      const token = (typeof window !== 'undefined') ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      await fetch(`http://localhost:5000/api/rooms/${roomId}/kick-all`, { method: 'POST', headers });
    } catch {}
    // Fallback: mark room as waiting so students' polling will redirect
    try {
      const token = (typeof window !== 'undefined') ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      await fetch(`http://localhost:5000/api/rooms/${roomId}`, { method: 'PUT', headers, body: JSON.stringify({ status: 'waiting' }) });
    } catch {}
    // Small delay to allow events to flush
    try { await new Promise(r => setTimeout(r, 150)); } catch {}
    router.push("/TeacherDashboard");
  };

  // Note: intentionally removed open-in-new-tab and copy-link helpers per request

  // Dedupe UI list for generic names (keep most recent by lastSeen)
  const displayedStudents = useMemo(() => {
    const arr = Object.values(students || {});
    // Sort by last seen (latest first)
    arr.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    // 1) Dedupe by playerId (keep most recent)
    const byId = new Map();
    for (const s of arr) byId.set(s.playerId, s);
    // 2) Additionally, coalesce exact same display name (keep most recent) to avoid visual duplicates
    const byName = new Map();
    for (const s of byId.values()) {
      const nm = (s.name || '').trim();
      if (!byName.has(nm)) byName.set(nm, s);
    }
    return Array.from(byName.values());
  }, [students]);

  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-500 to-pink-600">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">ไม่พบห้องเรียน</h2>
          <p className="text-gray-600 mb-4">กรุณาเลือกห้องเรียนจากหน้าหลัก</p>
          <button onClick={() => router.push("/TeacherDashboard")} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-2xl font-bold">กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1d1b4b] via-[#10296b] to-[#0c1d43] p-6">
      {/* Header */}
      <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] p-6 mb-6 border border-white/20">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500/5 via-fuchsia-500/5 to-cyan-500/5" />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg border border-white/40"><span className="text-2xl text-white">👩‍🏫</span></div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">ควบคุมเกม - ฝั่งครู</h1>
              <p className="text-gray-600 leading-snug">
                ห้อง: <span className="font-semibold text-blue-600">{roomInfo?.name || roomId}</span>
                {roomInfo?.questionSetTitle && (<><br />ชุดคำถาม: <span className="font-semibold text-indigo-600">{roomInfo.questionSetTitle}</span></>)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className={`px-4 py-2 rounded-xl font-semibold shadow border border-white/40 ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isConnected ? "🟢 เชื่อมต่อแล้ว" : "🔴 ไม่เชื่อมต่อ"}
            </div>

            {!gameStarted && (
              <button onClick={startGame} disabled={!isConnected} className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg">🚀 เริ่มเกม</button>
            )}

            {/* Competition toggle removed per request */}

            <button
              onClick={() => { setSpectateOpen(true); setSelectedPlayerId(studentIds[0] || null); }}
              disabled={!isConnected || studentIds.length === 0}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg"
            >👀 โหมดผู้ชม</button>

            {roomInfo?.questionSetId && (
              <button onClick={() => window.open(`/create-new-set?edit=${roomInfo.questionSetId}`, "_blank")} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg">📝 แก้ไขคำถาม</button>
            )}

            <button
              onClick={backAndKickAll}
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg"
            >🏠 กลับหน้าหลัก</button>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        {/* Students */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-2">👥</span>นักเรียนในห้อง ({displayedStudents.length})</h3>
          <div className="space-y-3">
            {Object.keys(students).length === 0 ? (
              <p className="text-gray-500 text-center py-4">ยังไม่มีนักเรียนเข้าร่วม</p>
            ) : (
              displayedStudents.map((s) => (
                <div key={s.playerId} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 flex items-center justify-between border border-indigo-100 hover:shadow-lg transition-shadow">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow border border-white/60"><span className="text-white text-sm">👤</span></div>
                    <div>
                      <div className="font-semibold text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-600">คะแนน: <span className="font-medium text-emerald-600">{s.score || 0}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs px-3 py-1 rounded-full font-medium ${gameStarted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{gameStarted ? "🎮 กำลังเล่น" : "⏳ รอเริ่มเกม"}</div>
                    <button
                      onClick={() => socketManager.socketEmit('kickPlayer', { roomId, playerId: s.playerId })}
                      className="text-sm px-3 py-1 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200"
                    >เตะ</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-2">📊</span>สถานะเกม</h3>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <div className="text-sm text-green-600 font-semibold">สถานะปัจจุบัน</div>
              <div className="text-lg font-bold text-green-700">{gameStarted ? "🎮 เกมกำลังดำเนินการ" : "⏳ รอเริ่มเกม"}</div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-pink-100">
              <div className="text-sm text-purple-600 font-semibold">ผู้เล่นที่เข้าร่วม</div>
              <div className="text-lg font-bold text-purple-700">{Object.keys(students).length} คน</div>
            </div>
          </div>
        </div>

        {/* Questions preview */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-2">❓</span>คำถามในเกม ({roomInfo?.questions?.length || 0} ข้อ)</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {roomInfo?.questions ? (
              roomInfo.questions.map((q, idx) => (
                <div key={q.id} className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-100 shadow-sm">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 mb-2">{q.text}</div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        {q.choices.map((c, i) => (
                          <div key={i} className={`p-2 rounded-lg ${i === q.answerIndex ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-600"}`}>
                            {String.fromCharCode(65 + i)}. {c}
                            {i === q.answerIndex && " ✓"}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">คะแนน: {q.points || 100} แต้ม</span>
                        <span className="text-[10px] text-gray-500">ID: {q.id}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500"><div className="text-4xl mb-2">📝</div><p>กำลังโหลดคำถาม...</p></div>
            )}
          </div>
        </div>

        {/* Rankings */}
        {gameResults && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-2">🏆</span>อันดับคะแนน</h3>
            <div className="space-y-2">
              {gameResults.rankings && gameResults.rankings.slice(0, 5).map((r, i) => (
                <div key={`${r.playerId}-${r.timestamp ?? i}`} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 flex items-center justify-between border border-amber-100 shadow">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                    <div>
                      <div className="font-bold text-gray-800">{r.playerName}</div>
                      <div className="text-sm text-gray-600">{r.finalScore} คะแนน</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spectator overlay */}
      {spectateOpen && (
        <SpectatorSideScroller
          roomId={roomId}
          players={students}
          questions={roomInfo?.questions || []}
          selectedPlayerId={selectedPlayerId}
          onClose={() => setSpectateOpen(false)}
          onPrev={() => cycleSelection(-1)}
          onNext={() => cycleSelection(1)}
        />
      )}
    </div>
  );
}