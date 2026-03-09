"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from "../lib/socket";
import { profileStorage } from "@/lib/profileStorage";

// Helpers
function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}
function buildSymmetricOffsets(count, gap) {
  if (count <= 0) return [];
  const arr = [0];
  let step = 1;
  while (arr.length < count) {
    arr.push(step * gap);
    if (arr.length >= count) break;
    arr.push(-step * gap);
    step++;
  }
  return arr;
}

// A simple side-scrolling quiz game
export default function SideScrollerQuiz() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showTouchControls, setShowTouchControls] = useState(false);

  const deriveMapVariant = (mapValue) => {
    const raw = String(mapValue || '').trim().toLowerCase();
    if (!raw) return 'sea';
    if (raw.includes('map3') || raw.includes('city')) return 'city';
    return 'sea';
  };

  // Prevent page scroll while in game view
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const [roomId] = useState(() => searchParams.get("roomId") || "");
  const [playerName] = useState(() => {
    const authUsername = (() => {
      if (typeof window === 'undefined') return '';
      try { return sessionStorage.getItem('username') || localStorage.getItem('username') || ''; } catch { return ''; }
    })();
    if (authUsername) {
      try { profileStorage.setName(authUsername); } catch {}
      return authUsername;
    }

    const fromUrl = searchParams.get('playerName');
    if (fromUrl) {
      try { profileStorage.setName(fromUrl); } catch {}
      return fromUrl;
    }

    const stored = (() => {
      try { return profileStorage.getName(); } catch { return ''; }
    })();
    if (stored) return stored;

    const generated = `Player_${Math.floor(Math.random() * 1000)}`;
    try { profileStorage.setName(generated); } catch {}
    return generated;
  });
  const [providedPlayerId] = useState(() => searchParams.get("playerId") || profileStorage.ensureId(playerName) || null);
  const role = "student";
  const [mapVariant, setMapVariant] = useState('sea');
  const mapVariantRef = useRef('sea');

  useEffect(() => {
    mapVariantRef.current = mapVariant;
  }, [mapVariant]);
  const [roomPlayerId, setRoomPlayerId] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return window.sessionStorage.getItem(`qq:roomPlayerId:${roomId}:${playerName}`) || null; } catch { return null; }
  });

  // Ensure the student appears in the teacher view even when Socket.IO isn't running.
  useEffect(() => {
    if (!roomId || !playerName) return;
    let cancelled = false;
    const join = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName }),
        });
        if (cancelled) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        // On success: store the DB roomPlayer id.
        if (res.ok && data?.success && data?.player?.id) {
          const pid = String(data.player.id);
          setRoomPlayerId(pid);
          try { window.sessionStorage.setItem(`qq:roomPlayerId:${roomId}:${playerName}`, pid); } catch {}
          return;
        }

        // On duplicate-name (409): resolve playerId by reading the current room roster.
        if (res.status === 409) {
          try {
            const rr = await fetch(`http://localhost:5000/api/game/room/${roomId}`);
            const rd = await rr.json().catch(() => null);
            try { setMapVariant(deriveMapVariant(rd?.room?.questionSetMap || rd?.room?.questionSet?.map)); } catch {}
            const list = Array.isArray(rd?.room?.players) ? rd.room.players : [];
            const target = list.find((p) => (String(p?.name || '').trim().toLowerCase() === String(playerName).trim().toLowerCase()));
            if (target?.playerId) {
              const pid = String(target.playerId);
              setRoomPlayerId(pid);
              try { window.sessionStorage.setItem(`qq:roomPlayerId:${roomId}:${playerName}`, pid); } catch {}
            }
          } catch {}
          return;
        }
      } catch {}
    };
    join();
    return () => { cancelled = true; };
  }, [roomId, playerName]);

  // Canvas/world
  const VIEW_W = 1400; // enlarged from 1200 for a wider play area
  const VIEW_H = 700;  // enlarged from 560 for a taller play area
  const [worldW, setWorldW] = useState(3600);
  const GROUND_H = 120;
  const GROUND_Y = VIEW_H - GROUND_H;

  // Physics
  const SPEED = 10; // was 6; increased for noticeably faster horizontal movement
  const JUMP_V = -16;
  const GRAV = 0.9;
  const MAX_FALL = 20;
  const AIR_CONTROL = 1; // allow full horizontal control while airborne
  const SHOW_OTHERS_IN_CANVAS = false;
  const VISUAL_PLATFORM_GAP = 0; // draw as if touching the platform visually
  const EPS = 1.0; // tolerance in pixels for crossing checks

  const canvasRef = useRef(null);
  const cameraXRef = useRef(0);
  const posRef = useRef({ x: 3600 / 2, y: GROUND_Y - 40 });
  const velRef = useRef({ x: 0, y: 0 });
  const onGroundRef = useRef(false);
  const supportTypeRef = useRef('air'); // 'ground' | 'platform' | 'air'
  const supportYRef = useRef(null); // top Y of current support (GROUND_Y or platform.y)
  const lastPhysicsAtRef = useRef(0);
  const jumpStartAtRef = useRef(0);

  // Input state
  const inputsRef = useRef({ left: false, right: false, jumpHeld: false, jumpPressed: false, jumpPressedAt: 0 });
  const lastLandingAtRef = useRef(0);
  const prevJumpHeldRef = useRef(false);

  // Detect touch/mobile so we can show on-screen controls.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTouchCapable = () => {
      try {
        return (
          'ontouchstart' in window ||
          (navigator && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0)
        );
      } catch {
        return false;
      }
    };

    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;

    const compute = () => {
      const coarse = mql ? !!mql.matches : isTouchCapable();
      setShowTouchControls(coarse);
    };

    compute();
    window.addEventListener('resize', compute);
    if (mql?.addEventListener) mql.addEventListener('change', compute);
    // Safari < 14
    // eslint-disable-next-line deprecation/deprecation
    else if (mql?.addListener) mql.addListener(compute);

    return () => {
      window.removeEventListener('resize', compute);
      if (mql?.removeEventListener) mql.removeEventListener('change', compute);
      // eslint-disable-next-line deprecation/deprecation
      else if (mql?.removeListener) mql.removeListener(compute);
    };
  }, []);

  const touchDown = (e) => {
    try { e.preventDefault(); } catch {}
  };

  const setLeftPressed = useCallback((pressed) => {
    inputsRef.current.left = pressed;
  }, []);

  const setRightPressed = useCallback((pressed) => {
    inputsRef.current.right = pressed;
  }, []);

  const setJumpPressed = useCallback((pressed) => {
    const inp = inputsRef.current;
    if (pressed) {
      if (!inp.jumpHeld) {
        inp.jumpPressed = true;
        inp.jumpPressedAt = performance.now();
      }
      inp.jumpHeld = true;
    } else {
      inp.jumpHeld = false;
    }
  }, []);

  // Other players
  const [otherPlayers, setOtherPlayers] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [roomStatus, setRoomStatus] = useState("waiting");

  // Quiz state
  const [questionSpots, setQuestionSpots] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [playerProgress, setPlayerProgress] = useState({ answered: [], score: 0 });

  // Per-question timer (seconds) from question set
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeUp, setTimeUp] = useState(false);
  const timeUpHandledRef = useRef(false);
  const timeUpTimeoutRef = useRef(null);

  // REST fallback for spectator mode: periodically publish our live position.
  useEffect(() => {
    if (!roomId || !playerName) return;
    if (!roomPlayerId) return;

    let cancelled = false;
    let lastSentAt = 0;

    const tick = async () => {
      const now = Date.now();
      if (now - lastSentAt < 90) return;
      lastSentAt = now;
      try {
        const pos = posRef.current;
        const payload = {
          roomId,
          playerId: roomPlayerId,
          playerName,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          score: playerProgress?.score ?? 0,
          answered: playerProgress?.answered?.length ?? 0,
          mode: 'side',
          ts: now,
        };
        await fetch('http://localhost:5000/api/game/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}
    };

    const timer = setInterval(() => {
      if (!cancelled) tick();
    }, 120);
    tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId, playerName, roomPlayerId, playerProgress?.score, playerProgress?.answered?.length]);
  // Track per-question answer status: { [questionId]: 'correct' | 'wrong' }
  const [answeredStatus, setAnsweredStatus] = useState({});
  const [answeredByPlayer, setAnsweredByPlayer] = useState({});
  const [blocks, setBlocks] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [gameResults, setGameResults] = useState(null);
  const [showRankings, setShowRankings] = useState(false);
  const completedOnceRef = useRef(false);
  const [uiTick, setUiTick] = useState(0);
  const lastQuestionOpenAtRef = useRef(0);
  const avatarRef = useRef(null);
  const [avatarReady, setAvatarReady] = useState(false);
  // Animation timekeeper for smooth walk cycles
  const animRef = useRef({ lastTime: 0, walkT: 0 });
  // Smooth blend 0..1 for starting/stopping walk
  const walkBlendRef = useRef(0);
  // Debug overlay toggle (F3) or via query ?debug=1
  const [showDebug, setShowDebug] = useState(() => searchParams.get("debug") === "1");
  // Exact mode: draw frames without extra lean/bob/tilt for pixel-perfect matching of provided art
  const exactMode = (searchParams.get("exact") === "1");
  // Option to hide avatar completely (visual only)
  const hideAvatar = (searchParams.get("nochar") === "1" || searchParams.get("hide") === "1" || searchParams.get("avatar") === "0");
  // Optional tuning via query: ?scale=0.9 to shrink, ?y=6 to sink feet 6px into ground (below dashed line)
  const scaleParam = (() => { const v = parseFloat(searchParams.get("scale") || ""); return Number.isFinite(v) && v > 0 ? v : null; })();
  const yParam = (() => { const v = parseInt(searchParams.get("y") || "", 10); return Number.isFinite(v) ? v : null; })();
  // Walk-tuning params: cadence (FPS), swing (amplitude scale 0..2), dwell (heel-strike linger 0..2)
  const cadenceParam = (() => { const v = parseFloat(searchParams.get("cadence") || ""); return Number.isFinite(v) && v > 0 ? v : null; })();
  const swingParam = (() => { const v = parseFloat(searchParams.get("swing") || ""); return Number.isFinite(v) && v >= 0 ? v : null; })();
  const dwellParam = (() => { const v = parseFloat(searchParams.get("dwell") || ""); return Number.isFinite(v) && v >= 0 ? v : null; })();
  // Allow choosing the default bundled character when forceDefault=1
  const defaultCharParam = (searchParams.get("default") || searchParams.get("char") || searchParams.get("gender") || "").toLowerCase();
  // Facing direction: 1 = right, -1 = left. Persist last non-zero motion.
  const facingRef = useRef(1);
  // Sprite sheet grid detection (for multi-pose assets). If not present, fall back to simple image/2-row logic.
  const spriteColsRef = useRef(0); // e.g., 6
  const spriteRowsRef = useRef(0); // e.g., 2
  const useSpriteGridRef = useRef(false);
  const chosenRowIndexRef = useRef(0); // 0=top (male), 1=bottom (female)
  // Grid type hint: '8x2', '8x1', '6x2', '6x1', '2x2gender', 'strip1'(N x 1), 'none'
  const gridTypeRef = useRef('none');

  // Ensure no buffered jump from overlays
  useEffect(() => {
    const inp = inputsRef.current;
    inp.jumpPressed = false;
    inp.jumpHeld = false;
  }, [showQuestion, showRankings]);

  // Redirect helper
  const redirectToLobby = useCallback(() => {
    try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, "1"); } catch {}
    try { window.location.replace("/StudentDashboard/gameroom"); } catch { window.location.href = "/StudentDashboard/gameroom"; }
  }, [roomId]);

  // Load questions and build world/platforms symmetrically
  useEffect(() => {
    const load = async () => {
      if (!roomId) return;
      try {
        const r = await fetch(`http://localhost:5000/api/game/questions/${roomId}`);
        const data = await r.json();

        const tl = Number(data?.timeLimit);
        if (Number.isFinite(tl) && tl > 0) setTimePerQuestion(Math.max(1, Math.floor(tl)));

        const qArr = Array.isArray(data?.questions) ? data.questions : (Array.isArray(data) ? data : []);
        const count = qArr.length || 4;
        const GAP = 320; const LEFT_PAD = 800; const RIGHT_PAD = 800;
        const minWorld = 3600;
        const needed = count > 1 ? (count - 1) * GAP : 0;
        const newWorldW = Math.max(minWorld, LEFT_PAD + RIGHT_PAD + needed + VIEW_W);
        setWorldW(newWorldW);

        const offsets = buildSymmetricOffsets(count, GAP);
        const center = newWorldW / 2;

        const localPlatforms = [];
        const platLevels = [
          { dy: 120, w: 260 },
          // Lower the higher platform slightly to make it reachable
          { dy: 150, w: 220 },
        ];

        const qs = (qArr.length ? qArr : Array.from({ length: count }).map((_, i) => ({ id: `q${i+1}`, text: `Q${i+1}`, choices: ["A","B","C","D"], answerIndex: i % 4, points: 100 })))
          .map((q, i) => {
            const off = offsets[i] || 0;
            const level = i % 3; // 0 ground, 1/2 platforms
            let y = GROUND_Y - 40;
            if (level === 1 || level === 2) {
              const lvl = platLevels[level - 1];
              const w = lvl.w; const px = center + off - w / 2; const py = GROUND_Y - lvl.dy;
              localPlatforms.push({ x: px, y: py, w, h: 18 });
              y = py - 40;
            }
            return {
              id: q.id,
              x: center + off,
              y,
              question: { id: q.id, text: q.text, choices: q.choices, answerIndex: q.answerIndex, points: q.points || 100 }
            };
          });

        setPlatforms(localPlatforms);
        setQuestionSpots(qs);
      } catch (e) {
        const count = 4; const GAP = 320; const LEFT_PAD = 800; const RIGHT_PAD = 800;
        const newWorldW = Math.max(3600, LEFT_PAD + RIGHT_PAD + (count - 1) * GAP + VIEW_W);
        setWorldW(newWorldW);
        const center = newWorldW / 2;
        const offsets = buildSymmetricOffsets(count, GAP);
        const localPlatforms = [];
        setQuestionSpots(offsets.map((off, i) => {
          const usePlat = i % 3 !== 0;
          let y = GROUND_Y - 40;
          if (usePlat) {
            // Mirror lowered platform height in fallback as well (170 -> 150)
            const dy = i % 2 ? 120 : 150; const w = i % 2 ? 260 : 220; const px = center + off - w / 2; const py = GROUND_Y - dy;
            localPlatforms.push({ x: px, y: py, w, h: 18 }); y = py - 40;
          }
          return ({ id: `q${i+1}`, x: center + off, y, question: { id: `q${i+1}`, text: `คำถามตัวอย่าง ${i+1}`, choices: ["A","B","C","D"], answerIndex: i % 4, points: 100 } });
        }));
        setPlatforms(localPlatforms);
      }
    };
    load();
  }, [roomId]);

  // Question countdown timer: starts when the question modal opens.
  useEffect(() => {
    if (!showQuestion || !currentQuestion) {
      setTimeLeft(null);
      setTimeUp(false);
      timeUpHandledRef.current = false;
      if (timeUpTimeoutRef.current) {
        clearTimeout(timeUpTimeoutRef.current);
        timeUpTimeoutRef.current = null;
      }
      return;
    }

    const durationSec = Math.max(1, Math.floor(Number(timePerQuestion) || 30));
    const deadline = Date.now() + durationSec * 1000;
    setTimeUp(false);
    timeUpHandledRef.current = false;
    setTimeLeft(durationSec);

    const iv = setInterval(() => {
      const remainMs = deadline - Date.now();
      const secs = Math.max(0, Math.ceil(remainMs / 1000));
      setTimeLeft(secs);

      if (secs <= 0 && !timeUpHandledRef.current) {
        timeUpHandledRef.current = true;
        setTimeUp(true);
        // Small delay so user sees the red state.
        timeUpTimeoutRef.current = setTimeout(() => {
          try { answerQuestion(-1, { timedOut: true }); } catch {}
        }, 900);
      }
    }, 200);

    return () => {
      clearInterval(iv);
      if (timeUpTimeoutRef.current) {
        clearTimeout(timeUpTimeoutRef.current);
        timeUpTimeoutRef.current = null;
      }
    };
  }, [showQuestion, currentQuestion, timePerQuestion]);

  // Rebuild visual blocks
  useEffect(() => {
    const b = (questionSpots || []).map(s => ({ id: s.id, x: s.x, y: s.y, bounceY: 0, bounceV: 0, prevOverlap: false }));
    setBlocks(b);
  }, [questionSpots]);

  // Load avatar image saved from the character designer
  useEffect(() => {
    if (hideAvatar) { avatarRef.current = null; setAvatarReady(false); return; }
    try {
  const forceDefault = searchParams.get("forceDefault") === "1";
      const dataUrl = forceDefault ? null : profileStorage.getImage();
      const charId = profileStorage.getCharacterId?.();
      chosenRowIndexRef.current = charId === 'female' ? 1 : 0;
      if (dataUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          avatarRef.current = img; setAvatarReady(true);
          // Prefer naturalWidth/Height for SVG or images without explicit width/height attributes
          const nW = (img.naturalWidth || img.width || 0);
          const nH = (img.naturalHeight || img.height || 0);
          // Detect sprite grid using aspect ratio to disambiguate Nx1 vs Nx2 sheets.
          // Square frames imply these exact ratios:
          // 8x1 -> nW/nH = 8  |  8x2 -> nW/nH = 4
          // 6x1 -> nW/nH = 6  |  6x2 -> nW/nH = 3
          const ratio = nH > 0 ? (nW / nH) : 0;
          const near = (a, b) => Math.abs(a - b) < 0.02; // small tolerance for rounding
          const looks8x1 = (nW % 8 === 0) && near(ratio, 8);
          const looks8x2 = (nW % 8 === 0) && (nH % 2 === 0) && near(ratio, 4);
          const looks6x1 = (nW % 6 === 0) && near(ratio, 6);
          const looks6x2 = (nW % 6 === 0) && (nH % 2 === 0) && near(ratio, 3);
          // Generic single-row strip with square frames (e.g., 9x1)
          const looksStrip1 = nH > 0 && (nW % nH === 0) && (ratio >= 3 && ratio <= 16);
          if (looks8x1) {
            spriteColsRef.current = 8; spriteRowsRef.current = 1; useSpriteGridRef.current = true; gridTypeRef.current = '8x1';
          } else if (looks8x2) {
            spriteColsRef.current = 8; spriteRowsRef.current = 2; useSpriteGridRef.current = true; gridTypeRef.current = '8x2';
          } else if (looks6x2) {
            spriteColsRef.current = 6; spriteRowsRef.current = 2; useSpriteGridRef.current = true; gridTypeRef.current = '6x2';
          } else if (looks6x1) {
            spriteColsRef.current = 6; spriteRowsRef.current = 1; useSpriteGridRef.current = true; gridTypeRef.current = '6x1';
          } else if (looksStrip1) {
            spriteColsRef.current = Math.round(nW / nH); spriteRowsRef.current = 1; useSpriteGridRef.current = true; gridTypeRef.current = 'strip1';
          } else if (nW % 2 === 0 && nH % 2 === 0 && nW > 0 && nH > 0) {
            // Generic 2x2 sheet (left column male, right column female; top=ground, bottom=jump)
            spriteColsRef.current = 2; spriteRowsRef.current = 2; useSpriteGridRef.current = true; gridTypeRef.current = '2x2gender';
          } else {
            spriteColsRef.current = 0; spriteRowsRef.current = 0; useSpriteGridRef.current = false; gridTypeRef.current = 'none';
          }
        };
        img.onerror = () => { avatarRef.current = null; setAvatarReady(false); };
        img.src = dataUrl;
        return;
      }
    } catch {}
    // No custom image and no bundled fallback: keep avatar null (use simple placeholder drawing)
    avatarRef.current = null; setAvatarReady(false);
  }, []);

  // Lightweight UI heartbeat
  useEffect(() => {
    const t = setInterval(() => setUiTick(v => v + 1), 150);
    return () => clearInterval(t);
  }, []);

  // Sockets
  useEffect(() => {
    let gotRoomState = false;
    if (!roomId || !playerName) return;

    // Prefer the DB-backed roomPlayerId (used by /api/game/room) as the socket playerId,
    // so teacher/spectator views and socket state refer to the same player consistently.
    const socketPlayerId = roomPlayerId || providedPlayerId;

    socketManager.connect();

    socketManager.on("connected", () => {
      const ok = socketManager.joinRoom(roomId, playerName, role, socketPlayerId);
      setIsConnected(ok);
      try {
        const pos = posRef.current;
        setTimeout(() => { socketManager.movePlayer(pos.x, pos.y); }, 100);
      } catch {}
    });

    socketManager.on("roomState", (data) => {
      gotRoomState = true;
      if (data?.status) { setRoomStatus(data.status); setGameStarted(data.status === "active"); }
      if (data?.startedAt && !gameStartTime) setGameStartTime(data.startedAt);
      if (Array.isArray(data?.players)) {
        const me = socketManager.getPlayerId();
        let selfPresent = false; const others = {};
        data.players.forEach(p => {
          if (p.playerId === me) {
            selfPresent = true;
            if (typeof p.x === "number" && typeof p.y === "number") { posRef.current.x = p.x; posRef.current.y = p.y; }
          } else if (p.role !== "teacher") { others[p.playerId] = p; }
        });
        setOtherPlayers(others);
        if (isConnected && !selfPresent) redirectToLobby();
      }
    });

    socketManager.on("playerJoined", (p) => {
      if (p?.role === "teacher") return;
      if (p?.playerId !== socketManager.getPlayerId()) setOtherPlayers(prev => ({ ...prev, [p.playerId]: p }));
    });

    socketManager.on("playerMoved", ({ playerId, x, y }) => {
      if (playerId === socketManager.getPlayerId()) return;
      setOtherPlayers(prev => prev[playerId] ? ({ ...prev, [playerId]: { ...prev[playerId], x, y } }) : prev);
    });

    socketManager.on("questionAnswered", ({ playerId, correct } = {}) => {
      if (!playerId) return;
      setAnsweredByPlayer(prev => ({ ...prev, [playerId]: (prev[playerId] || 0) + 1 }));
      if (playerId !== socketManager.getPlayerId()) setOtherPlayers(prev => prev[playerId] ? ({ ...prev, [playerId]: { ...prev[playerId], score: (prev[playerId].score || 0) + (correct ? 100 : 0) } }) : prev);
    });

    socketManager.on("playerLeft", ({ playerId }) => {
      if (!playerId) return;
      if (playerId === socketManager.getPlayerId()) { redirectToLobby(); return; }
      setOtherPlayers(prev => { const c = { ...prev }; delete c[playerId]; return c; });
    });

    socketManager.on("gameStarted", ({ startedAt }) => { setGameStarted(true); setRoomStatus("active"); setGameStartTime(startedAt || Date.now()); });
    socketManager.on("kicked", () => {
      try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, "1"); } catch {}
      // Force immediate navigation even if component state is mid-render
      try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
    });
    socketManager.on("disconnected", (info) => {
      const reason = info?.reason || "";
      // Only redirect when explicitly kicked; transient disconnects should auto-reconnect
      if (info?.wasKicked) redirectToLobby();
    });

    socketManager.on("gameResults", (payload) => { try { setGameResults(payload); setShowRankings(true); } catch {} });

    const failSafe = setTimeout(() => {
      try {
        const kicked = window.sessionStorage.getItem(`qq:kicked:${roomId}`) === "1";
        // Only redirect on explicit kicked flag; allow reconnects for connection drops
        if (kicked) redirectToLobby();
      } catch {}
    }, 2000);

    return () => { clearTimeout(failSafe); socketManager.disconnect(); setIsConnected(false); };
  }, [roomId, playerName, role, providedPlayerId, roomPlayerId]);

  // Failsafe: Poll room status; if not active, force back to lobby
  useEffect(() => {
    let timer;
    let cancelled = false;
    const confirmedInRosterRef = { current: false };
    const check = async () => {
      try {
        if (!roomId) return;
        const r = await fetch(`http://localhost:5000/api/game/room/${roomId}`);
        const data = await r.json();
        try {
          if (!cancelled) {
            setMapVariant(deriveMapVariant(data?.room?.questionSetMap || data?.room?.questionSet?.map));
          }
        } catch {}
        const status = data?.room?.status || data?.status;
        // If we are no longer present in the room roster, treat as kicked.
        const roster = Array.isArray(data?.room?.players) ? data.room.players : [];
        const stillHere = roomPlayerId ? roster.some((p) => String(p?.playerId) === String(roomPlayerId)) : true;

        // Only treat as kicked after we've seen ourselves in roster at least once.
        if (roomPlayerId && stillHere) {
          confirmedInRosterRef.current = true;
        }

        if (!cancelled && roomPlayerId && confirmedInRosterRef.current && !stillHere) {
          try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, '1'); } catch {}
          try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
          return;
        }

        if (!cancelled && status && status !== 'active') {
          try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, '1'); } catch {}
          try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
        }
      } catch {}
    };
    timer = setInterval(check, 1500);
    check();
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomId, roomPlayerId]);

  // Input handlers
  useEffect(() => {
    const down = (e) => {
      const c = e.code;
      if (c === "ArrowLeft" || c === "KeyA") inputsRef.current.left = true;
      if (c === "ArrowRight" || c === "KeyD") inputsRef.current.right = true;
      if (c === "Space" || c === "KeyW" || c === "ArrowUp") {
        const inp = inputsRef.current;
        if (!inp.jumpHeld) { inp.jumpPressed = true; inp.jumpPressedAt = performance.now(); }
        inp.jumpHeld = true;
      }
      // Toggle debug overlay
      if (c === "F3") {
        setShowDebug((v) => !v);
      }
    };
    const up = (e) => {
      const c = e.code;
      if (c === "ArrowLeft" || c === "KeyA") inputsRef.current.left = false;
      if (c === "ArrowRight" || c === "KeyD") inputsRef.current.right = false;
      if (c === "Space" || c === "KeyW" || c === "ArrowUp") { inputsRef.current.jumpHeld = false; }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const clearInputs = () => { const inp = inputsRef.current; inp.left = false; inp.right = false; inp.jumpHeld = false; inp.jumpPressed = false; };
    window.addEventListener("blur", clearInputs);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearInputs(); });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Movement + camera + collisions
  useEffect(() => {
    let raf; let lastEmit = 0;
    const prevPos = { x: posRef.current.x, y: posRef.current.y };
    const autoStart = setTimeout(() => { if (!gameStarted && roomStatus !== "active") { setGameStarted(true); if (!gameStartTime) setGameStartTime(Date.now()); } }, 1000);

    const step = () => {
      const now = performance.now();
      // dt in "frames" (1.0 ~= 60fps). Keeps motion stable on slower/faster refresh rates.
      if (!lastPhysicsAtRef.current) lastPhysicsAtRef.current = now;
      const dtFrames = Math.min(3, Math.max(0.5, (now - lastPhysicsAtRef.current) / 16.6667));
      lastPhysicsAtRef.current = now;
      // initialize animation time base
      if (!animRef.current.lastTime) animRef.current.lastTime = now;
      if (gameStarted && !showQuestion) {
        const pos = posRef.current; const vel = velRef.current; const inp = inputsRef.current;
        const wasGrounded = onGroundRef.current;
        let footOnSurface = false;

        // horizontal: accelerate/decelerate for more natural motion
        {
          const dir = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
          const maxV = SPEED * (onGroundRef.current ? 1 : AIR_CONTROL);
          const targetVx = dir * maxV;
          // Per-frame accel in px/frame; scaled by dtFrames
          const accel = onGroundRef.current ? 1.65 : 0.95;
          const decel = onGroundRef.current ? 2.35 : 1.15;
          const rate = dir !== 0 ? accel : decel;
          const maxDelta = rate * dtFrames;
          const delta = Math.max(-maxDelta, Math.min(maxDelta, targetVx - vel.x));
          vel.x += delta;
          // Snap tiny drift
          if (Math.abs(targetVx) < 0.001 && Math.abs(vel.x) < 0.06) vel.x = 0;
          // Clamp
          if (vel.x > maxV) vel.x = maxV;
          if (vel.x < -maxV) vel.x = -maxV;
        }

        // gravity only when airborne
        if (!onGroundRef.current) vel.y = Math.min(MAX_FALL, vel.y + GRAV * dtFrames); else vel.y = 0;

        // jump: true edge press after landing with tiny cooldown
        const edgeDown = !prevJumpHeldRef.current && inp.jumpHeld;
        const pressedAfterLanding = (inp.jumpPressedAt || 0) > (lastLandingAtRef.current || 0);
        const okLanding = (now - (lastLandingAtRef.current || 0) > 60);
        if (edgeDown && inp.jumpPressed && pressedAfterLanding && okLanding && onGroundRef.current) {
          vel.y = JUMP_V; onGroundRef.current = false;
          jumpStartAtRef.current = now;
        }
        if (inp.jumpPressed) inp.jumpPressed = false;

        // Variable jump height: hold for a slightly higher jump; release early to cut jump.
        // (Does not change controls; just makes motion feel more responsive/realistic.)
        const JUMP_HOLD_MS = 140;
        if (!onGroundRef.current && vel.y < 0) {
          const held = !!inp.jumpHeld && (now - (jumpStartAtRef.current || 0) < JUMP_HOLD_MS);
          if (held) {
            // reduce effective gravity while holding
            vel.y -= (GRAV * 0.55) * dtFrames;
          } else if (!inp.jumpHeld) {
            // apply extra gravity when released to cut the jump
            vel.y += (GRAV * 0.85) * dtFrames;
          }
        }

        // store previous position for collision direction
        prevPos.x = pos.x; prevPos.y = pos.y;
        pos.x += vel.x * dtFrames; pos.y += vel.y * dtFrames;

        // world bounds
        if (pos.x < 40) pos.x = 40; if (pos.x > worldW - 40) pos.x = worldW - 40;

  // update facing based on actual movement (not key only) so gamepads or inertia work
  if (vel.x > 0.25) facingRef.current = 1; else if (vel.x < -0.25) facingRef.current = -1;

        // ground collide
  if (pos.y + 40 >= GROUND_Y && vel.y >= 0) { pos.y = GROUND_Y - 40; vel.y = 0; if (!wasGrounded) lastLandingAtRef.current = now; footOnSurface = true; supportTypeRef.current = 'ground'; supportYRef.current = GROUND_Y; }

        // platforms collide (solid both ways) with inclusive top-touch detection and resting support to prevent micro-bounce
        for (const pf of platforms) {
          // Horizontal overlap between player (width 40) and platform
          const playerLeft = pos.x - 20, playerRight = pos.x + 20;
          const platLeft = pf.x, platRight = pf.x + pf.w;
          const horizOverlap = playerRight > platLeft && playerLeft < platRight;

          // Bottom/top crossing detection for landing
          const bottom = pos.y + 40;           // player's bottom
          const prevBottom = prevPos.y + 40;   // previous bottom
          const top = pf.y;               // platform top
          const bottomTouchesTop = (prevBottom <= top + EPS) && (bottom >= top - EPS);

          if (vel.y >= 0 && horizOverlap && (bottomTouchesTop || Math.abs(bottom - top) <= EPS)) {
            // Land on top: snap exactly to top and mark support
            pos.y = pf.y - 40; vel.y = 0; if (!wasGrounded) lastLandingAtRef.current = now; footOnSurface = true; supportTypeRef.current = 'platform'; supportYRef.current = pf.y;
            continue;
          }

          // Head-hit (from below): top of player crossing platform bottom
          const head = pos.y - 40;            // current top of player
          const prevHead = prevPos.y - 40;    // previous top
          const platBottom = pf.y + pf.h;
          const headHitsBottom = (prevHead >= platBottom - EPS) && (head <= platBottom + EPS);
          if (vel.y < 0 && horizOverlap && headHitsBottom) {
            pos.y = pf.y + pf.h + 40; vel.y = 0;
            continue;
          }
        }

        // finalize ground state
  onGroundRef.current = footOnSurface;
  if (!footOnSurface) { supportTypeRef.current = 'air'; supportYRef.current = null; }
        if (!footOnSurface && wasGrounded && vel.y === 0) vel.y = 1.5; // start falling if stepped off

  // camera follow
        cameraXRef.current = Math.max(0, Math.min(worldW - VIEW_W, pos.x - VIEW_W / 2));

        // emit movement (throttle)
        if (isConnected && now - lastEmit > 60) { socketManager.movePlayer(pos.x, pos.y); lastEmit = now; }

        // question block interaction:
        // - trigger on head-hit crossing OR new body overlap (edge-triggered)
        // - add small cooldown to avoid immediate re-open while still touching
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]; if (!b) continue;
          const bx = b.x, by = b.y + (b.bounceY || 0);
          const playerTop = pos.y - 40; const prevTop = prevPos.y - 40;
          const blockBottom = by + 24; // exact bottom
          const horizontalOverlap = Math.abs(pos.x - bx) <= (20 + 24);
          const headCrossesUp = (prevTop >= blockBottom - EPS) && (playerTop <= blockBottom + EPS);
          const headHitFromBelow = (vel.y < 0) && horizontalOverlap && headCrossesUp;
          const bodyOverlap = rectIntersect(pos.x - 20, pos.y - 40, 40, 40, bx - 24, by - 24, 48, 48);
          const newOverlap = bodyOverlap && !b.prevOverlap;
          const shouldTrigger = headHitFromBelow || newOverlap;
          // update overlap state for edge detection
          b.prevOverlap = bodyOverlap;
          if (shouldTrigger) {
            // if already answered, do not open again
            if (answeredStatus[b.id]) {
              // optionally, no bounce when locked
              continue;
            }
            const since = now - (lastQuestionOpenAtRef.current || 0);
            if (since > 300) {
              b.bounceV = -4;
              if (headHitFromBelow && vel.y < 0) vel.y = 0;
              const spot = questionSpots.find(s => s.id === b.id);
              if (spot) { setCurrentQuestion(spot.question); setShowQuestion(true); lastQuestionOpenAtRef.current = now; }
              break;
            }
          }
        }

        // animate block bounce
        blocks.forEach(b => {
          if (!b) return;
          if (Math.abs(b.bounceY) < 0.05 && Math.abs(b.bounceV) < 0.05) { b.bounceY = 0; b.bounceV = 0; return; }
          b.bounceV += 0.45; b.bounceY += b.bounceV; if (b.bounceY > 0) { b.bounceY = 0; b.bounceV = 0; }
        });
      }

      // advance animation timer (speed-aware for walk cycles)
      {
        const vx = Math.abs(velRef.current.x || 0);
        const running = onGroundRef.current && vx >= 0.25;
        const baseFps = cadenceParam ?? 9.0; // tunable cadence (frames per second)
        const speedFactor = running ? Math.min(2.0, Math.max(0.5, vx / SPEED)) : 0;
        // Smoothly blend in/out when starting or stopping
        const dt = Math.max(0, (now - animRef.current.lastTime) / 1000);
        const blend = walkBlendRef.current;
        const targetBlend = running ? 1 : 0;
        const rate = running ? 9 : 12; // ramp in/out faster
        walkBlendRef.current = Math.max(0, Math.min(1, blend + (targetBlend - blend) * Math.min(1, dt * rate)));
        // Keep a stronger floor so steps don't look frozen at start/stop
        const blendFloor = 0.5;
        const effBlend = Math.max(blendFloor, walkBlendRef.current);
        const fps = baseFps * (0.85 + 0.65 * speedFactor) * (0.5 + 0.5 * effBlend);
        if (running || walkBlendRef.current > 0.01) animRef.current.walkT += dt * fps; // t in frames, not seconds
        animRef.current.lastTime = now;
      }

      draw();
      prevJumpHeldRef.current = !!inputsRef.current.jumpHeld;
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const cam = cameraXRef.current; const pos = posRef.current;

      const isCity = mapVariantRef.current === 'city';

      if (!isCity) {
        // SEA MAP (existing look)

        // sky (soft gradient + horizon haze)
        {
          const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
          g.addColorStop(0, "#9cd3ff");
          g.addColorStop(0.55, "#9cd3ff");
          // warm beach horizon tint (reuse existing palette via rgba)
          g.addColorStop(0.78, "rgba(245,158,11,0.18)");
          g.addColorStop(0.92, "rgba(239,68,68,0.08)");
          g.addColorStop(1, "rgba(255,255,255,0.18)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
          // haze band near horizon
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(0, GROUND_Y - 220, VIEW_W, 180);
        }

        // sun (parallax)
        {
          const sunX = (VIEW_W * 0.18) - (cam * 0.06);
          const sunY = VIEW_H * 0.18;
          ctx.save();
          const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 75);
          glow.addColorStop(0, "rgba(245,158,11,0.55)");
          glow.addColorStop(1, "rgba(245,158,11,0)");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sunX, sunY, 75, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // clouds (simple, static; parallax)
        {
          const drawCloud = (cx, cy, s) => {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.ellipse(cx - 18 * s, cy + 2 * s, 16 * s, 10 * s, 0, 0, Math.PI * 2);
            ctx.ellipse(cx, cy, 22 * s, 14 * s, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + 20 * s, cy + 3 * s, 14 * s, 9 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };

          const cloudPar = 0.18;
          const base = -((cam * cloudPar) % 900);
          for (let i = -1; i < 6; i++) {
            const x = base + (i * 900) + 180;
            drawCloud(x, 90, 1.15);
            drawCloud(x + 260, 140, 0.95);
          }
        }

        // distant islands near horizon (parallax)
        {
          const par = 0.08;
          const start = -((cam * par) % 800) - 800;
          const y = GROUND_Y - 170;
          ctx.save();
          ctx.fillStyle = "rgba(17,24,39,0.10)"; // based on #111827
          for (let i = 0; i < 7; i++) {
            const x = start + i * 800;
            ctx.beginPath();
            ctx.ellipse(x + 260, y + 60, 240, 55, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 520, y + 70, 200, 45, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // ocean (gradient + waves)
        {
          const oceanTop = GROUND_Y - 160;
          const oceanBottom = GROUND_Y - 10;
          const sea = ctx.createLinearGradient(0, oceanTop, 0, oceanBottom);
          sea.addColorStop(0, "rgba(156,211,255,0.92)");
          sea.addColorStop(0.55, "rgba(156,211,255,0.80)");
          sea.addColorStop(1, "rgba(52,211,153,0.30)"); // based on #34d399
          ctx.fillStyle = sea;
          ctx.fillRect(0, oceanTop, VIEW_W, oceanBottom - oceanTop);

          // wave lines (parallax)
          const wavePar = 0.20;
          const base = -((cam * wavePar) % 260);
          for (let r = 0; r < 5; r++) {
            const y = oceanTop + 28 + r * 26;
            ctx.strokeStyle = "rgba(255,255,255,0.30)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = -1; i < 8; i++) {
              const x = base + i * 260;
              ctx.moveTo(x, y);
              ctx.quadraticCurveTo(x + 65, y - 6, x + 130, y);
              ctx.quadraticCurveTo(x + 195, y + 6, x + 260, y);
            }
            ctx.stroke();
          }
        }

        // shoreline foam
        {
          const foamY = GROUND_Y - 14;
          const par = 0.25;
          const base = -((cam * par) % 220);
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = -1; i < 10; i++) {
            const x = base + i * 220;
            ctx.moveTo(x, foamY);
            ctx.quadraticCurveTo(x + 55, foamY - 8, x + 110, foamY);
            ctx.quadraticCurveTo(x + 165, foamY + 8, x + 220, foamY);
          }
          ctx.stroke();
        }
      } else {
        // CITY MAP (simple skyline + road)
        {
          const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
          g.addColorStop(0, "#c7d2fe");
          g.addColorStop(0.55, "#93c5fd");
          g.addColorStop(1, "rgba(255,255,255,0.18)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }

        // sun (cooler)
        {
          const sunX = (VIEW_W * 0.78) - (cam * 0.05);
          const sunY = VIEW_H * 0.20;
          ctx.save();
          const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 70);
          glow.addColorStop(0, "rgba(99,102,241,0.22)");
          glow.addColorStop(1, "rgba(99,102,241,0)");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sunX, sunY, 70, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.beginPath(); ctx.arc(sunX, sunY, 18, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // skyline (parallax)
        {
          const par = 0.12;
          const base = -((cam * par) % 520) - 520;
          const horizonY = GROUND_Y - 220;
          ctx.save();
          ctx.fillStyle = "rgba(17,24,39,0.18)";
          for (let i = 0; i < 10; i++) {
            const x = base + i * 520;
            const w1 = 110;
            const w2 = 80;
            const h1 = 160;
            const h2 = 120;
            ctx.fillRect(x + 40, horizonY + 60, w1, h1);
            ctx.fillRect(x + 180, horizonY + 90, w2, h2);
            ctx.fillRect(x + 290, horizonY + 70, 95, 150);
          }
          // haze
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.fillRect(0, horizonY + 120, VIEW_W, 120);
          ctx.restore();
        }

        // road/ground
        {
          ctx.fillStyle = "rgba(31,41,55,0.80)"; // based on #1f2937
          ctx.fillRect(0, GROUND_Y - 2, VIEW_W, VIEW_H - (GROUND_Y - 2));
          // lane markings (parallax)
          const par = 0.35;
          const base = -((cam * par) % 220);
          ctx.strokeStyle = "rgba(255,255,255,0.60)";
          ctx.lineWidth = 4;
          ctx.setLineDash([26, 18]);
          ctx.beginPath();
          ctx.moveTo(base, GROUND_Y + 55);
          ctx.lineTo(VIEW_W + 220, GROUND_Y + 55);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ground
      {
        if (mapVariantRef.current === 'city') {
          // asphalt
          ctx.fillStyle = "rgba(31,41,55,0.85)"; // based on #1f2937
          ctx.fillRect(0 - cam, GROUND_Y, worldW, GROUND_H);

          // subtle road texture (parallax)
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          for (let gx = Math.floor(cam / 120) * 120 - 240; gx < cam + VIEW_W + 240; gx += 120) {
            ctx.fillRect(gx - cam, GROUND_Y + 22, 60, 2);
            ctx.fillRect(gx - cam + 18, GROUND_Y + 44, 80, 2);
          }

          // lane markings (world-relative)
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.lineWidth = 4;
          ctx.setLineDash([26, 18]);
          ctx.beginPath();
          ctx.moveTo(0 - cam, GROUND_Y + 58);
          ctx.lineTo(worldW - cam, GROUND_Y + 58);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const sand = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
          sand.addColorStop(0, "rgba(245,158,11,0.32)");
          sand.addColorStop(1, "rgba(245,158,11,0.55)");
          ctx.fillStyle = sand;
          ctx.fillRect(0 - cam, GROUND_Y, worldW, GROUND_H);

          // sand ripples (parallax)
          ctx.fillStyle = "rgba(17,24,39,0.06)";
          for (let gx = Math.floor(cam / 90) * 90 - 240; gx < cam + VIEW_W + 240; gx += 90) {
            ctx.fillRect(gx - cam, GROUND_Y + 18, 50, 3);
            ctx.fillRect(gx - cam + 24, GROUND_Y + 38, 70, 3);
          }
          // tiny sparkles/shell dots
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          for (let i = 0; i < 28; i++) {
            const x = ((i * 97) % (VIEW_W + 120)) - 60 - ((cam * 0.35) % 97);
            const y = GROUND_Y + 24 + ((i * 31) % Math.max(40, GROUND_H - 28));
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }

      // platforms
      ctx.fillStyle = "#8b5cf6"; platforms.forEach(p => { ctx.fillRect(p.x - cam, p.y, p.w, p.h); });

      // question blocks (always visible). Color reflects answer status per block.
      blocks.forEach(b => {
        const x = b.x - cam; const y = b.y + (b.bounceY || 0);
        const status = answeredStatus[b.id];
        // default orange; green if correct; red if wrong
        ctx.fillStyle = status === 'correct' ? '#22c55e' : status === 'wrong' ? '#ef4444' : '#f59e0b';
        ctx.fillRect(x - 24, y - 24, 48, 48);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(x - 24, y - 24, 48, 48);
        ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", x, y + 8);
      });

      // other players (optional)
      if (SHOW_OTHERS_IN_CANVAS) {
        Object.values(otherPlayers).forEach(p => {
          if (!p) return; const x = (p.x || worldW / 2) - cam; const y = (p.y || GROUND_Y - 40);
          const answered = (answeredByPlayer[p.playerId] || 0);
          ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
          const label = `${p.name || "Player"} · ${answered}`;
          ctx.fillStyle = "#111827"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, x, y - 28);
        });
      }

      if (!hideAvatar) {
      // me (animated: facing, walk bob, jump tilt)
  const meX = pos.x - cam; const meY = pos.y;
  const onSupport = onGroundRef.current && (supportTypeRef.current === 'platform' || supportTypeRef.current === 'ground') && (typeof supportYRef.current === 'number');
  // Translate to the exact top surface (ground/platform). Local y=0 is the feet baseline.
  const drawYBase = onSupport ? (supportYRef.current - VISUAL_PLATFORM_GAP) : meY;
  const running = Math.abs(velRef.current.x) > 0.1 && onGroundRef.current;
  const airborne = !onGroundRef.current;
  let dir = facingRef.current || 1;
  const t = animRef.current.walkT; // frame-based; used for bob/swing rhythms

  // motion styling
  const usingGrid = !!useSpriteGridRef.current; const gridType = gridTypeRef.current;
  const disableStylize = exactMode || gridType === '2x2gender';
  const vxAbs = Math.abs(velRef.current.x || 0);
  const speedFactor = running ? Math.min(1.5, Math.max(0.0, vxAbs / SPEED)) : 0;
  const ampScale = swingParam ?? 1.0; // user-tunable swing amplitude
  const bobAmp = 4.2 * (0.5 + 0.5 * speedFactor) * ampScale;
  const bobBlend = walkBlendRef.current || 0;
  const bob = disableStylize ? 0 : (running ? Math.sin(t * 1.0) * bobAmp * bobBlend : 0);
  let angle = 0; // rotate around feet for natural lean
  let yPose = 0; // extra vertical offset for poses
  if (!disableStylize) {
    if (airborne) {
      if (velRef.current.y < -2) { angle = -0.18 * dir; yPose = -6; }
      else if (velRef.current.y > 2) { angle = 0.15 * dir; yPose = 2; }
    } else if (running) {
      angle = (0.16 * ampScale) * dir * (walkBlendRef.current || 0);
    }
  }

  // Keep feet pinned to ground/platform when onGround by not adding bob/yPose to drawY
  const drawY = onGroundRef.current ? drawYBase : (drawYBase + bob + yPose);
  const avatar = avatarRef.current;
  // Base destination size target; width may adapt to keep frame aspect ratio
  const baseH = 88;

  // Estimate avatar height + baseline offset for placing the name tag above the head.
  // Must mirror the same sizing/offset logic used in drawImage below.
  const scaleBoost = gridType === '8x1' ? 1.20 : (gridType === '2x2gender' ? 1.12 : 1.0);
  const sizeTune = scaleParam ?? (exactMode ? 1.0 : 0.92);
  const destHForLabel = Math.round(baseH * scaleBoost * sizeTune);
  const defaultYByGrid = (() => {
    if (gridType === '8x2') return 4;
    if (gridType === '8x1') return 4;
    if (gridType === '6x2' || gridType === '6x1') return 4;
    if (gridType === '2x2gender') return 4;
    return 4;
  })();
  const userYOffsetForLabel = (yParam ?? defaultYByGrid);
  const extraPadForLabel = (gridType === '2x2gender' && !exactMode) ? 2 : 0;
  const nameTagY = avatar
    ? (drawY - destHForLabel + userYOffsetForLabel + extraPadForLabel - 10)
    : (drawY - 70);

  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // translate to feet position, add subtle horizontal sway, then rotate and flip by facing
  // Snap to integer pixels to avoid subpixel gaps between feet and surfaces
  ctx.translate(Math.round(meX), Math.round(drawY));

  // foot shadow (helps grounding and depth)
  {
    const shadowW = 18 + 8 * speedFactor;
    const shadowH = airborne ? 3.2 : 5.2;
    ctx.save();
    ctx.globalAlpha = airborne ? 0.10 : 0.16;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(0, 6, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const sway = disableStylize ? 0 : (running ? Math.sin(t * 1.0) * (1.5 * ampScale) * (walkBlendRef.current || 0) : 0);
  if (sway) ctx.translate(sway, 0);
  // If using a grid that already contains left/right frames (6x*, 8x*), don't flip.
  if (!(usingGrid && (gridType === '6x1' || gridType === '6x2' || gridType === '8x1' || gridType === '8x2'))) ctx.scale(dir, 1);
  ctx.rotate(angle);

  // squash/stretch for more lifelike motion (disabled in exact mode)
  if (!disableStylize) {
    const phase = Math.sin(t * 1.0);
    let sx = 1.0;
    let sy = 1.0;
    if (running) {
      const k = 0.035 * (walkBlendRef.current || 0);
      sx += k * phase;
      sy -= k * phase;
    }
    if (airborne) { sx += 0.020; sy -= 0.020; }
    // landing squash (quick pulse)
    const now2 = performance.now();
    const landingAge = now2 - (lastLandingAtRef.current || 0);
    if (landingAge >= 0 && landingAge < 140) {
      const p = 1 - (landingAge / 140);
      sx += 0.045 * p;
      sy -= 0.060 * p;
    }
    ctx.scale(sx, sy);
  }

  if (avatar) {
    // draw centered at feet with bottom alignment
    // Use natural size to ensure correct slicing for SVG/PNG
    const aW = avatar.naturalWidth || avatar.width;
    const aH = avatar.naturalHeight || avatar.height;
    let sX = 0, sY = 0, sW = aW, sH = aH;
    if (usingGrid) {
      const cols = spriteColsRef.current || 6; const rows = spriteRowsRef.current || 2;
      sW = Math.floor(aW / cols); sH = Math.floor(aH / rows);
      if (gridType === '2x2gender') {
        // Columns select gender, rows select ground/jump
        const col = (chosenRowIndexRef.current || 0) === 1 ? 1 : 0; // 0=male(left), 1=female(right)
        const row = airborne ? 1 : 0; // 0=ground(top), 1=jump(bottom)
        sX = col * sW; sY = row * sH;
      } else if (gridType === '8x1' || gridType === '8x2') {
        // Column mapping for 8 cols (square frames expected):
        // 0 Idle, 1 WalkL_A, 2 WalkL_B, 3 WalkR_A, 4 WalkR_B, 5 JumpUp, 6 JumpL, 7 JumpR
        let col = 0; const vx = velRef.current.x; const ax = Math.abs(vx);
        const walking = !airborne && ax >= 0.25;
        if (airborne) {
          if (ax < 0.25) col = 5; else if (vx < 0) col = 6; else col = 7;
        } else if (walking) {
          // Use animRef.walkT to alternate A/B with slight dwell on contact frame
          const spd = Math.min(1.5, Math.max(0.0, ax / SPEED));
          const heelScale = dwellParam ?? 1.0;
          const weights = [ (1.15 + 0.4 * spd) * heelScale, 0.85 ]; // heel strike linger scales with speed and user dwell
          const total = weights[0] + weights[1];
          let t = animRef.current.walkT % total;
          const idx = (t < weights[0]) ? 0 : 1; // 0=A, 1=B
          if (vx < 0) col = idx === 0 ? 1 : 2; else col = idx === 0 ? 3 : 4;
        } else {
          col = 0;
        }
        const row = Math.max(0, Math.min(rows - 1, chosenRowIndexRef.current || 0));
        sX = col * sW; sY = row * sH;
  } else if (gridType === 'strip1') {
        // Generic N x 1 strip (square frames). Heuristics:
        // - col 0: idle
        // - walk: cycle frames 1..(N-2) at speed-aware rate
        // - jump: last frame (N-1)
        // Flipping is enabled earlier for non 6x/8x grids, so left/right is handled by ctx.scale(dir,1)
        let col = 0;
        const cols = Math.max(3, spriteColsRef.current || 3);
        const vx = Math.abs(velRef.current.x);
        const walking = !airborne && vx >= 0.25;
        if (airborne) {
          col = cols - 1; // use last frame for jump
        } else if (walking) {
          // Use animRef.walkT (already speed-adjusted) to drive a continuous cycle
          // with dwell weights to mimic human heel-strike/toe-off
          const cycleLen = Math.max(2, cols - 2);
          if (cycleLen <= 2) {
            const tWalk = Math.floor(animRef.current.walkT) % cycleLen; // fallback
            col = 1 + tWalk;
          } else {
            // build symmetric dwell weights [contact, pass, pass, contact, pass, ...]
            const weights = Array.from({ length: cycleLen }, (_, i) => 1);
            weights[0] += 0.6; // heel strike dwell
            weights[cycleLen - 1] += 0.6; // opposite heel strike
            weights[Math.floor(cycleLen / 2)] += 0.4; // toe-off subtle dwell
            const total = weights.reduce((a, b) => a + b, 0);
            let tWalk = animRef.current.walkT % total;
            let idx = 0;
            for (let i = 0; i < cycleLen; i++) {
              if (tWalk < weights[i]) { idx = i; break; }
              tWalk -= weights[i];
            }
            col = 1 + idx;
          }
        } else {
          col = 0; // idle
        }
        const row = 0;
        sX = col * sW; sY = row * sH;
      } else {
        // 6x1 or 6x2: decide column by state and add simple two-step walk cycle (idle<->walk)
        let col = 0;
        const vx = velRef.current.x;
        const isWalk = !airborne && Math.abs(vx) >= 0.25;
        // Tie the two-frame walk toggle to the same walk timer so cadenceParam affects 6x sheets as well
        const phase = (Math.floor(animRef.current.walkT) % 2);
        if (airborne) {
          if (Math.abs(vx) < 0.25) col = 3; // Jump up
          else if (vx < 0) col = 4; // Jump left
          else col = 5; // Jump right
        } else if (isWalk) {
          if (vx < 0) col = (phase ? 0 : 1); // alternate Idle <-> WalkL
          else col = (phase ? 0 : 2);       // alternate Idle <-> WalkR
        } else {
          col = 0; // Idle
        }
        const row = Math.max(0, Math.min(rows - 1, chosenRowIndexRef.current || 0));
        sX = col * sW; sY = row * sH;
      }
    } else {
      // If the avatar looks like a stacked 2-frame sprite (top=ground, bottom=jump),
      // slice and pick the appropriate half. Otherwise draw full image.
      const rows = 2; // assume 2 rows (ground/jump). Safe fallback for non-sprites
      const useJumpFrame = airborne; // bottom half when airborne
      sH = Math.floor(aH / rows) || aH;
      sY = useJumpFrame ? sH : 0;
      sX = 0; sW = aW;
    }
    // Preserve frame aspect ratio; target a clear, readable size
  const scaleBoost = gridType === '8x1' ? 1.20 : (gridType === '2x2gender' ? 1.12 : 1.0);
  // In exact mode, keep native scale; otherwise shrink slightly for readability
  const sizeTune = scaleParam ?? (exactMode ? 1.0 : 0.92);
  const destH = Math.round(baseH * scaleBoost * sizeTune);
    const aspect = sW > 0 && sH > 0 ? (sW / sH) : 1;
    const destW = Math.max(48, Math.min(112, Math.round(destH * aspect)));
  // Calibrate feet: bottom of sprite sits at local y=(0 + userYOffset) which is the feet baseline
  // Defaults set to 0 so feet align exactly on ground/platform; override via ?y= if needed.
  const defaultYByGrid = (() => {
    // Positive moves the sprite DOWN into the ground; negative lifts it up
    // Slight +4px sink to visually "stick" feet to surfaces and hide tiny frame/bob discrepancies.
    if (gridType === '8x2') return 4;
    if (gridType === '8x1') return 4;
    if (gridType === '6x2' || gridType === '6x1') return 4;
    if (gridType === '2x2gender') return 4;
    return 4;
  })();
  const userYOffset = (yParam ?? defaultYByGrid);
  const extraPad = (gridType === '2x2gender' && !exactMode) ? 2 : 0;
  // Place sprite so that its bottom (feet) touch the ground line, with head fully visible above
  const x = -destW/2, y = -destH + userYOffset + extraPad;
    // Always draw without canvas clipping to avoid accidental head cropping
    // Add a subtle shadow for depth (doesn't affect hitboxes)
    ctx.save();
    ctx.shadowColor = "rgba(17,24,39,0.22)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(avatar, sX, sY, sW, sH, x, y, destW, destH);
    ctx.restore();
    // Optional canvas debug guides (frame box and foot line)
    if (showDebug) {
      ctx.save();
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, destW, destH);
      // Foot line at local y=0 (after translate, before destH offset)
      ctx.strokeStyle = "green";
      ctx.beginPath();
      ctx.moveTo(-destW / 2, 0);
      ctx.lineTo(destW / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // fallback character (cute chibi) when no avatar image is available
    // Feet baseline is local y=0.
    ctx.save();
    // body
    const bodyGrad = ctx.createLinearGradient(-18, -58, 18, -10);
    bodyGrad.addColorStop(0, "#2563eb");
    bodyGrad.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-16, -46, 32, 34, 12);
    ctx.fill();
    ctx.stroke();

    // head
    ctx.fillStyle = "rgba(245,158,11,0.28)";
    ctx.strokeStyle = "rgba(255,255,255,0.60)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -62, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // hair + beach headband
    ctx.fillStyle = "rgba(17,24,39,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, -68, 17, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(239,68,68,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -70, 14, Math.PI, Math.PI * 2);
    ctx.stroke();

    // face
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(-5, -64, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -64, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(239,68,68,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -58);
    ctx.quadraticCurveTo(0, -55, 4, -58);
    ctx.stroke();

    // arms
    ctx.strokeStyle = "rgba(255,255,255,0.70)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, -32); ctx.lineTo(-26, -24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -32); ctx.lineTo(26, -24); ctx.stroke();

    // legs + shoes
    ctx.strokeStyle = "rgba(17,24,39,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-8, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-14, 0, 10, 4);
    ctx.fillRect(4, 0, 10, 4);

    ctx.restore();
  }

  // Limbs overlay: draw only for fallback shape. If avatar image exists,
  // don't add extra lines because the sprite already has its own arms/legs.
  if (!avatar) {
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3;
    const swing = running ? Math.sin(t) * 7 : 0;
    const armSwing = running ? Math.cos(t) * 6 : 0;
    if (airborne) {
      // tuck legs slightly backward, arms up for jump
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-12, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(12, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, -48); ctx.lineTo(-6, -60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -48); ctx.lineTo(6, -60); ctx.stroke();
    } else {
      // walking: legs swing and arm counter-swing
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6 - swing, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(6 + swing, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, -42); ctx.lineTo(-12 + armSwing, -34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -42); ctx.lineTo(12 - armSwing, -34); ctx.stroke();
    }
  }
  ctx.restore();

  // name tag (above head)
  ctx.fillStyle = "#ffffff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${playerName} (คุณ) · ${playerProgress.answered.length}`, meX, nameTagY);
      } // end if !hideAvatar
    };

    raf = requestAnimationFrame(step);
    return () => { clearTimeout(autoStart); cancelAnimationFrame(raf); };
  }, [VIEW_W, VIEW_H, worldW, GROUND_Y, GROUND_H, platforms, isConnected, questionSpots, playerProgress.answered, showQuestion, gameStarted, playerName]);

  // Answer selection
  const submitCompletion = useCallback(async ({ finalScore, elapsedMs, answeredCount }) => {
    const playerId = roomPlayerId || socketManager.getPlayerId() || providedPlayerId || null;
    const fallback = {
      roomId,
      rankings: [
        {
          rank: 1,
          playerId,
          playerName,
          finalScore,
          completionTime: elapsedMs,
          timestamp: Date.now(),
        },
      ],
    };

    try {
      const res = await fetch('http://localhost:5000/api/game/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId,
          playerName,
          finalScore,
          completionTime: elapsedMs,
          questionsAnswered: answeredCount,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.rankings) {
        setGameResults(data);
        setShowRankings(true);
        return;
      }
    } catch {}

    // Fallback (single-player result) when backend isn't available
    setGameResults(fallback);
    setShowRankings(true);
  }, [roomId, playerName, providedPlayerId]);

  const answerQuestion = useCallback((idx, opts = {}) => {
    if (!currentQuestion) return;
    if (timeUp && !opts?.timedOut) return;
    const qid = currentQuestion.id;
    // guard: if already answered, ignore
    if (answeredStatus[qid]) { setShowQuestion(false); setCurrentQuestion(null); return; }
    const timedOut = Boolean(opts?.timedOut) || !Number.isFinite(idx) || idx < 0;
    const correct = (!timedOut) && (idx === currentQuestion.answerIndex);
    const earned = correct ? (currentQuestion.points ?? 100) : 0;
    setAnsweredStatus(prev => ({ ...prev, [qid]: correct ? 'correct' : 'wrong' }));
    setPlayerProgress(prev => ({ answered: [...prev.answered, qid], score: prev.score + earned }));
    setShowQuestion(false); setCurrentQuestion(null);
    const total = questionSpots.length; const answeredCount = playerProgress.answered.length + 1;
    if (answeredCount >= total && !completedOnceRef.current) {
      completedOnceRef.current = true;
      const elapsedMs = gameStartTime ? Math.max(0, Date.now() - gameStartTime) : 0;
      const finalScore = (playerProgress.score + earned);

      // Try socket path (if there is a socket.io server). If not, fall back to REST.
      const sent = socketManager.completeGame(finalScore, elapsedMs, answeredCount);

      // Always also persist via REST so teacher can reliably read score + completion time
      // even when Socket.IO is running and the student later leaves the room.
      void submitCompletion({ finalScore, elapsedMs, answeredCount });

      // (Keep socket path for realtime teacher updates)
      void sent;
    }
  }, [currentQuestion, answeredStatus, playerProgress, questionSpots.length, gameStartTime, submitCompletion, timeUp]);

  // HUD + Canvas + Modals
  const touchControlsEnabled = showTouchControls && gameStarted && !showQuestion && !showRankings;
  return (
    <div className="h-[100dvh] overflow-hidden bg-gradient-to-br from-emerald-200 to-teal-200 flex flex-col items-center p-3">
      <div className="w-full max-w-6xl shrink-0 rounded-3xl shadow-xl bg-white/70 backdrop-blur-sm p-3 mb-2 flex items-center justify-between">
        <div className="text-sm text-gray-700 font-semibold">{playerName} • Room: {roomId}</div>
        <div className="text-sm">Score: <span className="font-bold text-emerald-700">{playerProgress.score}</span> • Answered: {playerProgress.answered.length}/{questionSpots.length}</div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 hidden sm:block">ปุ่ม: A/D หรือ ←/→ เดิน, W/↑/Space กระโดด</div>
          {/* Removed on-screen debug/y-offset controls per request; F3 and URL params still work */}
          {/* Removed reset button per request */}
        </div>
      </div>

      <div className="w-full max-w-6xl shrink-0 mb-2">
        <div className="relative h-14">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-white border border-gray-200 shadow-inner">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-50 via-cyan-50 to-indigo-50" />
            {[...Array(11)].map((_, i) => (<div key={i} className="absolute top-0 bottom-0 w-px bg-gray-200/90" style={{ left: `${(i/10)*100}%` }} />))}
          </div>
          {(() => {
            const me = { id: socketManager.getPlayerId(), name: playerName, x: posRef.current.x || worldW/2, me: true, answered: playerProgress.answered.length };
            const others = Object.values(otherPlayers || {}).map((p) => ({ id: p.playerId, name: p.name, x: Math.max(0, Math.min(worldW, p.x ?? worldW/2)), answered: answeredByPlayer[p.playerId] || 0 }));
            const all = [me, ...others];
            return all.map((p, i) => {
              const pct = Math.max(0, Math.min(100, (p.x / worldW) * 100));
              const bump = (i % 2) * 10;
              return (
                <div key={p.id} className="absolute -translate-x-1/2" style={{ left: `${pct}%`, top: `calc(50% - 14px - ${bump}px)` }}>
                  <div className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap text-center ${p.me ? 'bg-blue-600 text-white border-blue-700 shadow' : 'bg-white text-gray-800 border-gray-300 shadow-sm'}`} title={`ตอบแล้ว ${p.answered} ข้อ`}>
                    {p.me ? `${p.name} (คุณ)` : p.name} · {p.answered}
                  </div>
                  <div className="mx-auto w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-gray-300" />
                  <div className={`mx-auto mt-[2px] w-2.5 h-2.5 rounded-full ${p.me ? 'bg-blue-600' : 'bg-rose-500'} ring-2 ${p.me ? 'ring-blue-200' : 'ring-rose-200'}`} />
                </div>
              );
            });
          })()}
          <div className="absolute -bottom-5 left-0 text-[11px] text-gray-700">ซ้ายสุด</div>
          <div className="absolute -bottom-5 right-0 text-[11px] text-gray-700">ขวาสุด</div>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-[11px] text-gray-700">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> คุณ</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> เพื่อน</span>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 flex items-center justify-center">
        <div className="h-full w-auto max-w-7xl max-h-full aspect-[2/1] rounded-3xl overflow-hidden shadow-2xl border border-white/40 bg-[#9bd1ff] relative">
          <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="w-full h-full block" />
        {showDebug && (
          <div className="absolute m-2 p-2 top-0 left-1/2 -translate-x-1/2 bg-white/90 text-[11px] text-gray-800 rounded shadow border border-gray-200">
            <div className="font-semibold">Debug</div>
            <div>avatarReady: {String(avatarReady)}</div>
            <div>grid: {gridTypeRef.current} ({spriteColsRef.current}x{spriteRowsRef.current})</div>
            <div>facing: {facingRef.current}</div>
            <div>onGround: {String(onGroundRef.current)}</div>
            <div>vx, vy: {velRef.current.x.toFixed(2)}, {velRef.current.y.toFixed(2)}</div>
            <div>support: {supportTypeRef.current}{typeof supportYRef.current === 'number' ? `@${supportYRef.current}` : ''}</div>
            <div>exactMode: {String(exactMode)}</div>
            <div>destH/yOff: {(() => { try { const a = avatarRef.current; if (!a) return '—'; const cols = spriteColsRef.current||1; const rows = spriteRowsRef.current||1; const sW = Math.floor((a.naturalWidth||a.width||0)/cols)||0; const sH = Math.floor((a.naturalHeight||a.height||0)/rows)||0; const baseH=88; const scaleBoost = (gridTypeRef.current==='8x1'?1.20:(gridTypeRef.current==='2x2gender'?1.12:1.0)); const sizeTune = (typeof scaleParam==='number'? scaleParam : (exactMode?1.0:0.92)); const dH = Math.round(baseH*scaleBoost*sizeTune); const gt=gridTypeRef.current; const yDef = (typeof yParam==='number'? yParam : 0); return `${dH}/${yDef}`; } catch { return '—'; } })()}</div>
            <div className="text-gray-500">F3 เพื่อซ่อน/แสดง</div>
          </div>
        )}
        </div>
      </div>

      {!gameStarted && (<div className="mt-4 text-center text-amber-700 bg-amber-100 border border-amber-300 px-4 py-2 rounded-xl">รอครูเริ่มเกมอยู่...</div>)}

      {showQuestion && currentQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-[90%] border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-xl font-extrabold text-gray-900 leading-snug">{currentQuestion.text}</div>
              <div className={`shrink-0 px-3 py-1 rounded-xl text-sm font-extrabold border ${timeUp ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                ⏱️ {typeof timeLeft === 'number' ? timeLeft : Math.max(1, Math.floor(Number(timePerQuestion) || 30))}s
              </div>
            </div>

            {timeUp && (
              <div className="mb-3 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                หมดเวลา! ข้อนี้นับว่าตอบผิด
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => answerQuestion(i)}
                  disabled={timeUp}
                  className={`p-4 rounded-2xl border-2 text-left font-semibold shadow-sm focus:outline-none focus:ring-2 ${
                    timeUp
                      ? 'border-rose-300 bg-rose-50 text-rose-900 focus:ring-rose-200 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-900 hover:bg-indigo-50 hover:border-indigo-200 focus:ring-indigo-300'
                  }`}
                >
                  <span className="inline-block w-6 h-6 mr-2 rounded-md bg-indigo-600 text-white text-center font-bold align-middle">{String.fromCharCode(65+i)}</span>
                  <span className="align-middle">{c}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => { setShowQuestion(false); setCurrentQuestion(null); }} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 shadow">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {showRankings && gameResults && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-[92%] border border-gray-200">
            <div className="mb-4">
              <div className="text-2xl font-extrabold text-gray-900">🏆 อันดับคะแนน</div>
              <div className="text-sm text-gray-600">ห้อง {gameResults?.roomId}</div>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {(gameResults.rankings || []).map((r, i) => {
                const isMe = r.playerId === socketManager.getPlayerId();
                const secs = Number.isFinite(r?.completionTime) ? (r.completionTime/1000).toFixed(1) : '—';
                return (
                  <div key={`${r.playerId}-${i}`} className={`p-3 rounded-xl border ${isMe ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-400 text-white font-bold flex items-center justify-center">{r.rank <= 3 ? ['1','2','3'][r.rank-1] : r.rank}</div>
                      <div>
                        <div className="font-bold text-gray-800">{r.playerName}</div>
                        <div className="text-xs text-gray-600">ใช้เวลา: {secs} วินาที</div>
                      </div>
                    </div>
                    <div className="text-lg font-extrabold text-emerald-700">{r.finalScore} คะแนน</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={async () => {
                  try {
                    if (roomId && roomPlayerId) {
                      await fetch(`http://localhost:5000/api/rooms/${roomId}/leave/${roomPlayerId}`, { method: 'POST' });
                    }
                  } catch {}
                  try { window.sessionStorage.removeItem(`qq:roomPlayerId:${roomId}:${playerName}`); } catch {}
                  try { setRoomPlayerId(null); } catch {}
                  router.push('/StudentDashboard/gameroom');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >กลับหน้าห้อง</button>
            </div>
          </div>
        </div>
      )}

      {touchControlsEnabled && (
        <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
          <div className="relative w-full h-28">
            <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex gap-3 pointer-events-auto">
              <button
                type="button"
                aria-label="เดินซ้าย"
                onPointerDown={(e) => { touchDown(e); e.currentTarget.setPointerCapture?.(e.pointerId); setLeftPressed(true); }}
                onPointerUp={(e) => { touchDown(e); setLeftPressed(false); }}
                onPointerCancel={(e) => { touchDown(e); setLeftPressed(false); }}
                onPointerLeave={(e) => { touchDown(e); setLeftPressed(false); }}
                className="select-none touch-none w-20 h-20 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-xl text-gray-800 font-extrabold text-base active:scale-95"
              >
                ซ้าย
              </button>
              <button
                type="button"
                aria-label="เดินขวา"
                onPointerDown={(e) => { touchDown(e); e.currentTarget.setPointerCapture?.(e.pointerId); setRightPressed(true); }}
                onPointerUp={(e) => { touchDown(e); setRightPressed(false); }}
                onPointerCancel={(e) => { touchDown(e); setRightPressed(false); }}
                onPointerLeave={(e) => { touchDown(e); setRightPressed(false); }}
                className="select-none touch-none w-20 h-20 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-xl text-gray-800 font-extrabold text-base active:scale-95"
              >
                ขวา
              </button>
            </div>

            <div className="absolute right-3 bottom-3 pointer-events-auto">
              <button
                type="button"
                aria-label="กระโดด"
                onPointerDown={(e) => { touchDown(e); e.currentTarget.setPointerCapture?.(e.pointerId); setJumpPressed(true); }}
                onPointerUp={(e) => { touchDown(e); setJumpPressed(false); }}
                onPointerCancel={(e) => { touchDown(e); setJumpPressed(false); }}
                onPointerLeave={(e) => { touchDown(e); setJumpPressed(false); }}
                className="select-none touch-none w-28 h-20 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-xl text-gray-800 font-extrabold text-base active:scale-95"
              >
                กระโดด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
