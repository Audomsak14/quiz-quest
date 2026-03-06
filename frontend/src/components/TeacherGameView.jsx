"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from "../lib/socket";
import SpectatorSideScroller from "./SpectatorSideScroller";
import { getAuthSession } from "../lib/auth";

export default function TeacherGameView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authStatus, setAuthStatus] = useState("checking"); // checking | ok | blocked

  useEffect(() => {
    const { token, role } = getAuthSession();
    if (!token) {
      setAuthStatus("blocked");
      router.replace("/login");
      return;
    }
    if (role !== "teacher") {
      setAuthStatus("blocked");
      router.replace("/StudentDashboard");
      return;
    }
    setAuthStatus("ok");
  }, [router]);

  // URL params
  const [roomId] = useState(() => searchParams.get("roomId") || "");
  const [playerName] = useState("Teacher");

  // Connection and game state
  const [isConnected, setIsConnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [competitionMode, setCompetitionMode] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [students, setStudents] = useState({}); // { playerId: { name, score, x, y, role } }
  const [rosterIds, setRosterIds] = useState([]); // active room playerIds from /api/game/room
  const [gameResults, setGameResults] = useState(null);
  const [spectateOpen, setSpectateOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  const rosterIdSet = useMemo(() => {
    const set = new Set();
    (rosterIds || []).forEach((id) => { if (id != null) set.add(String(id)); });
    return set;
  }, [rosterIds]);

  // Fallback (no socket server): poll backend for room + players
  useEffect(() => {
    if (authStatus !== "ok") return;
    if (!roomId) return;
    let timer;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/game/room/${roomId}`, { mode: 'cors' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (data?.success && data?.room) {
          setRoomInfo((prev) => ({ ...(prev || {}), ...data.room }));
          if (data.room.status) setGameStarted(data.room.status === 'active');

          if (Array.isArray(data.room.players)) {
            const ids = data.room.players.map((p) => String(p?.playerId)).filter(Boolean);
            setRosterIds(ids);
            const now = Date.now();
            setStudents((prev) => {
              // Keep only players that are still in the room roster (kicked players disappear here).
              const next = {};
              ids.forEach((id) => {
                if (prev?.[id]) next[id] = prev[id];
              });
              data.room.players.forEach((p) => {
                if (!p?.playerId) return;
                // backend provides { playerId, name, role } (no x/y) => preserve x/y from prev
                next[p.playerId] = {
                  ...(next[p.playerId] || {}),
                  ...p,
                  lastSeen: now,
                };
              });
              return next;
            });
          }

          // REST is reachable => consider connected for UI
          setIsConnected(true);
        }
      } catch {
        // Keep last known state
      }
    };

    timer = setInterval(poll, 1200);
    poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authStatus, roomId]);

  // Fallback for spectator movement (no socket server): poll live state while spectator is open.
  useEffect(() => {
    if (authStatus !== "ok") return;
    if (!roomId) return;

    let timer;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/game/state/${roomId}`, { mode: 'cors' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.success || !Array.isArray(data?.players)) return;

        const now = Date.now();
        setStudents((prev) => {
          const next = { ...(prev || {}) };
          data.players.forEach((p) => {
            const pid = p?.playerId;
            if (!pid) return;
            // If we already have a roster from /api/game/room, ignore players not in roster.
            if (rosterIdSet.size > 0 && !rosterIdSet.has(String(pid))) return;
            next[pid] = {
              ...(next[pid] || {}),
              playerId: pid,
              name: p.playerName || next[pid]?.name,
              x: typeof p.x === 'number' ? p.x : next[pid]?.x,
              y: typeof p.y === 'number' ? p.y : next[pid]?.y,
              score: typeof p.score === 'number' ? p.score : (next[pid]?.score || 0),
              answered: typeof p.answered === 'number' ? p.answered : next[pid]?.answered,
              lastSeen: now,
            };
          });
          return next;
        });

        // REST is reachable => consider connected for spectator UX
        setIsConnected(true);
      } catch {
        // ignore
      }
    };

    // Always poll live state so teacher can see live scores.
    // When spectator is open, poll faster for smoother movement.
    const intervalMs = spectateOpen ? 120 : 1000;
    timer = setInterval(poll, intervalMs);
    poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authStatus, roomId, spectateOpen, rosterIdSet]);

  // Load room info + questions
  useEffect(() => {
    const load = async () => {
      if (authStatus !== "ok") return;
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
  }, [authStatus, roomId]);

  // Sockets
  useEffect(() => {
    if (authStatus !== "ok") return;
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
  }, [authStatus, roomId, playerName]);

  // Poll backend rankings so teacher can see real completion time + end time
  // even when Socket.IO server is not running.
  useEffect(() => {
    if (authStatus !== "ok") return;
    if (!roomId) return;
    if (!gameStarted) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/game/results/${roomId}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success && Array.isArray(data?.rankings)) {
          setGameResults(data);
        }
      } catch {}
    };

    const id = setInterval(poll, 2000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authStatus, roomId, gameStarted]);

  const startGame = () => {
    if (isConnected && roomId) socketManager.socketEmit("startGame", { roomId });
  };

  const toggleCompetition = () => {
    const newVal = !competitionMode;
    setCompetitionMode(newVal);
    if (isConnected && roomId) socketManager.socketEmit('setCompetition', { roomId, enabled: newVal });
  };

  const kickStudent = useCallback(async (playerId) => {
    if (!roomId || !playerId) return;

    // Try socket path (if Socket.IO server supports it)
    try { socketManager.socketEmit('kickPlayer', { roomId, playerId }); } catch {}

    // Always call REST so it works even without Socket.IO server.
    try {
      const token = (typeof window !== 'undefined') ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(`http://localhost:5000/api/rooms/${roomId}/kick/${playerId}`, { method: 'POST', headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error || 'kick failed');

      // Optimistically remove from local list; polling will also reconcile.
      setStudents((prev) => {
        if (!prev || !prev[playerId]) return prev;
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
    } catch (e) {
      console.error('Kick failed', e);
    }
  }, [roomId]);

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

  const displayedStudentIds = useMemo(
    () => (displayedStudents || []).map((s) => s.playerId).filter(Boolean),
    [displayedStudents]
  );

  const rankByPlayerId = useMemo(() => {
    const map = new Map();

    // If backend has already computed rankings (from /api/game/complete), use those.
    if (Array.isArray(gameResults?.rankings) && gameResults.rankings.length) {
      for (const r of gameResults.rankings) {
        if (!r?.playerId) continue;
        const rank = Number(r.rank);
        if (Number.isFinite(rank)) map.set(String(r.playerId), rank);
      }
      return map;
    }

    // Otherwise, compute a best-effort live ranking from current state.
    // Primary: score desc; Secondary: answered desc; Tertiary: updatedAt asc.
    const list = [...(displayedStudents || [])];
    list.sort((a, b) => {
      const scoreDiff = (Number(b?.score) || 0) - (Number(a?.score) || 0);
      if (scoreDiff !== 0) return scoreDiff;

      const answeredDiff = (Number(b?.answered) || 0) - (Number(a?.answered) || 0);
      if (answeredDiff !== 0) return answeredDiff;

      const timeDiff = (Number(a?.updatedAt) || Number(a?.lastSeen) || 0) - (Number(b?.updatedAt) || Number(b?.lastSeen) || 0);
      if (timeDiff !== 0) return timeDiff;

      return String(a?.name || '').localeCompare(String(b?.name || ''), 'th');
    });

    list.forEach((s, idx) => {
      if (!s?.playerId) return;
      map.set(String(s.playerId), idx + 1);
    });

    return map;
  }, [displayedStudents, gameResults]);

  const finalScoreByPlayerId = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(gameResults?.rankings)) return map;
    for (const r of gameResults.rankings) {
      if (!r?.playerId) continue;
      const score = Number(r.finalScore);
      if (Number.isFinite(score)) map.set(String(r.playerId), score);
    }
    return map;
  }, [gameResults]);

  const finishedIdSet = useMemo(() => {
    const set = new Set();
    // Prefer backend-computed results
    if (Array.isArray(gameResults?.rankings)) {
      for (const r of gameResults.rankings) {
        if (r?.playerId != null) set.add(String(r.playerId));
      }
      return set;
    }
    // Fallback: if we have question count + answered count
    const total = Number(roomInfo?.questions?.length);
    if (!Number.isFinite(total) || total <= 0) return set;
    for (const s of displayedStudents || []) {
      const answered = Number(s?.answered);
      if (Number.isFinite(answered) && answered >= total) {
        if (s?.playerId != null) set.add(String(s.playerId));
      }
    }
    return set;
  }, [displayedStudents, gameResults, roomInfo?.questions]);

  const leaderboardRows = useMemo(() => {
    if (Array.isArray(gameResults?.rankings) && gameResults.rankings.length) {
      return gameResults.rankings.map((r) => ({
        playerId: String(r.playerId),
        playerName: r.playerName,
        finalScore: Number(r.finalScore) || 0,
        rank: Number(r.rank) || null,
        completionTime: r.completionTime,
        timestamp: r.timestamp,
      }));
    }

    const rows = (displayedStudents || []).map((s) => ({
      playerId: String(s.playerId),
      playerName: s.name,
      finalScore: finalScoreByPlayerId.get(String(s.playerId)) ?? (Number(s.score) || 0),
      rank: rankByPlayerId.get(String(s.playerId)) || null,
      completionTime: null,
      timestamp: null,
    }));

    rows.sort((a, b) => {
      const ra = Number(a.rank) || 9999;
      const rb = Number(b.rank) || 9999;
      if (ra !== rb) return ra - rb;
      return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'th');
    });

    return rows;
  }, [displayedStudents, finalScoreByPlayerId, gameResults, rankByPlayerId]);

  const studentIds = useMemo(() => Object.keys(students || {}), [students]);
  const cycleSelection = useCallback((dir) => {
    const activeIds = displayedStudentIds.length ? displayedStudentIds : studentIds;
    if (activeIds.length === 0) return;
    const idx = selectedPlayerId ? Math.max(0, activeIds.indexOf(selectedPlayerId)) : -1;
    const nextIdx = (idx + dir + activeIds.length) % activeIds.length;
    setSelectedPlayerId(activeIds[nextIdx]);
  }, [displayedStudentIds, studentIds, selectedPlayerId]);

  if (authStatus !== "ok") return null;

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
                ห้อง: <span className="font-semibold text-blue-600">{(roomInfo?.name && roomInfo.name !== 'ห้องสำหรับชุดคำถาม') ? roomInfo.name : roomId}</span>
                {roomInfo?.questionSetTitle && (<><br />ชุดคำถาม: <span className="font-semibold text-indigo-600">{roomInfo.questionSetTitle}</span></>)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isConnected && (
              <div className="px-4 py-2 rounded-xl font-semibold shadow border border-white/40 bg-green-100 text-green-700">
                🟢 เชื่อมต่อแล้ว
              </div>
            )}

            {!gameStarted && (
              <button onClick={startGame} disabled={!isConnected} className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg">🚀 เริ่มเกม</button>
            )}

            {/* Competition toggle removed per request */}

            <button
              onClick={() => { setSpectateOpen(true); setSelectedPlayerId((displayedStudentIds[0] || studentIds[0]) || null); }}
              disabled={!isConnected || (displayedStudentIds.length === 0 && studentIds.length === 0)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg"
            >👀 โหมดผู้ชม</button>

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
            {displayedStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">ยังไม่มีนักเรียนเข้าร่วม</p>
            ) : (
              displayedStudents.map((s) => (
                <div key={s.playerId} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 flex items-center justify-between border border-indigo-100 hover:shadow-lg transition-shadow">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow border border-white/60">
                      <span className="text-white text-sm">👤</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{s.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs px-3 py-1 rounded-full font-medium ${finishedIdSet.has(String(s.playerId)) ? "bg-sky-100 text-sky-700" : (gameStarted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}`}
                    >{finishedIdSet.has(String(s.playerId)) ? "✅ เล่นเสร็จแล้ว" : (gameStarted ? "🎮 กำลังเล่น" : "⏳ รอเริ่มเกม")}</div>
                    <button
                      onClick={() => kickStudent(String(s.playerId))}
                      className="text-sm px-3 py-1 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200"
                    >เตะ</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-2">🏆</span>อันดับคะแนน</h3>
          {leaderboardRows.length === 0 ? (
            <p className="text-gray-500 text-center py-4">ยังไม่มีข้อมูลคะแนน</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {leaderboardRows.map((r, i) => {
                const rk = Number(r.rank) || (i + 1);
                const secs = (r?.completionTime != null && Number.isFinite(Number(r?.completionTime)))
                  ? (Number(r.completionTime) / 1000).toFixed(1)
                  : '—';
                return (
                  <div key={`${r.playerId}-${i}`} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 flex items-center justify-between border border-amber-100 shadow">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-yellow-400 text-white font-bold flex items-center justify-center shadow">
                        {rk <= 3 ? ['🥇', '🥈', '🥉'][rk - 1] : rk}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{r.playerName}</div>
                        <div className="text-xs text-gray-600">ใช้เวลา: {secs} วินาที</div>
                      </div>
                    </div>
                    <div className="text-lg font-extrabold text-emerald-700">{Number(r.finalScore) || 0} คะแนน</div>
                  </div>
                );
              })}
            </div>
          )}
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
              <div className="text-lg font-bold text-purple-700">{displayedStudents.length} คน</div>
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