"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from "../lib/socket";

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

  const [roomId] = useState(() => searchParams.get("roomId") || "");
  const [playerName] = useState(() => searchParams.get("playerName") || `Player_${Math.floor(Math.random()*1000)}`);
  const [providedPlayerId] = useState(() => searchParams.get("playerId") || null);
  const role = "student";

  // Canvas/world
  const VIEW_W = 1200;
  const VIEW_H = 700;
  const [worldW, setWorldW] = useState(3600);
  const GROUND_H = 120;
  const GROUND_Y = VIEW_H - GROUND_H;

  // Physics
  const SPEED = 6;
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

  // Input state
  const inputsRef = useRef({ left: false, right: false, jumpHeld: false, jumpPressed: false, jumpPressedAt: 0 });
  const lastLandingAtRef = useRef(0);
  const prevJumpHeldRef = useRef(false);

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

  // Ensure no buffered jump from overlays
  useEffect(() => {
    const inp = inputsRef.current;
    inp.jumpPressed = false;
    inp.jumpHeld = false;
  }, [showQuestion, showRankings]);

  const restartGame = useCallback(() => {
    completedOnceRef.current = false;
    setPlayerProgress({ answered: [], score: 0 });
    setAnsweredStatus({});
    setShowQuestion(false);
    setCurrentQuestion(null);
    setShowRankings(false);
  setBlocks(prev => (prev || []).map(b => ({ ...b, bounceY: 0, bounceV: 0 })));
    lastQuestionOpenAtRef.current = 0;
    setGameStartTime(Date.now());
    setGameStarted(true);
    try {
      posRef.current = { x: worldW / 2, y: GROUND_Y - 40 };
      velRef.current = { x: 0, y: 0 };
      cameraXRef.current = Math.max(0, Math.min(worldW - VIEW_W, posRef.current.x - VIEW_W / 2));
    } catch {}
  }, [worldW]);

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
          { dy: 170, w: 220 },
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
            const dy = i % 2 ? 120 : 170; const w = i % 2 ? 260 : 220; const px = center + off - w / 2; const py = GROUND_Y - dy;
            localPlatforms.push({ x: px, y: py, w, h: 18 }); y = py - 40;
          }
          return ({ id: `q${i+1}`, x: center + off, y, question: { id: `q${i+1}`, text: `คำถามตัวอย่าง ${i+1}`, choices: ["A","B","C","D"], answerIndex: i % 4, points: 100 } });
        }));
        setPlatforms(localPlatforms);
      }
    };
    load();
  }, [roomId]);

  // Rebuild visual blocks
  useEffect(() => {
    const b = (questionSpots || []).map(s => ({ id: s.id, x: s.x, y: s.y, bounceY: 0, bounceV: 0, prevOverlap: false }));
    setBlocks(b);
  }, [questionSpots]);

  // Lightweight UI heartbeat
  useEffect(() => {
    const t = setInterval(() => setUiTick(v => v + 1), 150);
    return () => clearInterval(t);
  }, []);

  // Sockets
  useEffect(() => {
    let gotRoomState = false;
    if (!roomId || !playerName) return;

    socketManager.connect();

    socketManager.on("connected", () => {
      const ok = socketManager.joinRoom(roomId, playerName, role, providedPlayerId);
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
      if (info?.wasKicked || reason === "io server disconnect" || reason === "transport close") redirectToLobby();
    });

    socketManager.on("gameResults", (payload) => { try { setGameResults(payload); setShowRankings(true); } catch {} });

    const failSafe = setTimeout(() => {
      try {
        const kicked = window.sessionStorage.getItem(`qq:kicked:${roomId}`) === "1";
        if (kicked || !socketManager.isSocketConnected() || !gotRoomState) redirectToLobby();
      } catch {}
    }, 2000);

    return () => { clearTimeout(failSafe); socketManager.disconnect(); setIsConnected(false); };
  }, [roomId, playerName, role, providedPlayerId]);

  // Failsafe: Poll room status; if not active, force back to lobby
  useEffect(() => {
    let timer;
    let cancelled = false;
    const check = async () => {
      try {
        if (!roomId) return;
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
      if (gameStarted && !showQuestion) {
        const pos = posRef.current; const vel = velRef.current; const inp = inputsRef.current;
        const wasGrounded = onGroundRef.current;
        let footOnSurface = false;

        // horizontal: allow movement on ground and in air (scaled by AIR_CONTROL)
        {
          const targetVx = (inp.left ? -SPEED : 0) + (inp.right ? SPEED : 0);
          vel.x = onGroundRef.current ? targetVx : targetVx * AIR_CONTROL;
        }

        // gravity only when airborne
        if (!onGroundRef.current) vel.y = Math.min(MAX_FALL, vel.y + GRAV); else vel.y = 0;

        // jump: true edge press after landing with tiny cooldown
        const edgeDown = !prevJumpHeldRef.current && inp.jumpHeld;
        const pressedAfterLanding = (inp.jumpPressedAt || 0) > (lastLandingAtRef.current || 0);
        const okLanding = (now - (lastLandingAtRef.current || 0) > 60);
        if (edgeDown && inp.jumpPressed && pressedAfterLanding && okLanding && onGroundRef.current) {
          vel.y = JUMP_V; onGroundRef.current = false;
        }
        if (inp.jumpPressed) inp.jumpPressed = false;

        // store previous position for collision direction
        prevPos.x = pos.x; prevPos.y = pos.y;
        pos.x += vel.x; pos.y += vel.y;

        // world bounds
        if (pos.x < 40) pos.x = 40; if (pos.x > worldW - 40) pos.x = worldW - 40;

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

      draw();
      prevJumpHeldRef.current = !!inputsRef.current.jumpHeld;
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const cam = cameraXRef.current; const pos = posRef.current;

      // sky
      ctx.fillStyle = "#9cd3ff"; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // parallax hills
      ctx.fillStyle = "#91e3a2";
      for (let i = -1; i < 8; i++) { const hx = (i * 400) - (cam * 0.3 % 400); ctx.beginPath(); ctx.ellipse(hx + 200, GROUND_Y + 40, 220, 60, 0, 0, Math.PI * 2); ctx.fill(); }

      // ground
      ctx.fillStyle = "#86efac"; ctx.fillRect(0 - cam, GROUND_Y, worldW, GROUND_H);
      // ground tiles
      ctx.fillStyle = "#34d399";
      for (let gx = Math.floor(cam / 40) * 40 - 200; gx < cam + VIEW_W + 200; gx += 40) { ctx.fillRect(gx - cam, GROUND_Y, 32, 8); }

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

      // me
  const meX = pos.x - cam; const meY = pos.y;
  const onSupport = onGroundRef.current && (supportTypeRef.current === 'platform' || supportTypeRef.current === 'ground') && (typeof supportYRef.current === 'number');
  // radius of body is 20px; align bottom to support top minus gap
  const drawY = onSupport ? (supportYRef.current - 20 - VISUAL_PLATFORM_GAP) : meY;
  const running = Math.abs(velRef.current.x) > 0.1 && onGroundRef.current; const t = performance.now() / 120;
  ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(meX, drawY, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ef4444"; ctx.fillRect(meX - 20, drawY - 28, 40, 10); ctx.beginPath(); ctx.arc(meX, drawY - 28, 20, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; const legSwing = running ? Math.sin(t) * 6 : 0;
  ctx.beginPath(); ctx.moveTo(meX - 6, drawY + 20); ctx.lineTo(meX - 6 - legSwing, drawY + 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(meX + 6, drawY + 20); ctx.lineTo(meX + 6 + legSwing, drawY + 28); ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${playerName} (คุณ) · ${playerProgress.answered.length}`, meX, drawY - 34);
    };

    raf = requestAnimationFrame(step);
    return () => { clearTimeout(autoStart); cancelAnimationFrame(raf); };
  }, [VIEW_W, VIEW_H, worldW, GROUND_Y, GROUND_H, platforms, isConnected, questionSpots, playerProgress.answered, showQuestion, gameStarted, playerName]);

  // Answer selection
  const answerQuestion = useCallback((idx) => {
    if (!currentQuestion) return;
    const qid = currentQuestion.id;
    // guard: if already answered, ignore
    if (answeredStatus[qid]) { setShowQuestion(false); setCurrentQuestion(null); return; }
    const correct = idx === currentQuestion.answerIndex; const earned = correct ? (currentQuestion.points ?? 100) : 0;
    setAnsweredStatus(prev => ({ ...prev, [qid]: correct ? 'correct' : 'wrong' }));
    setPlayerProgress(prev => ({ answered: [...prev.answered, qid], score: prev.score + earned }));
    setShowQuestion(false); setCurrentQuestion(null);
    const total = questionSpots.length; const answeredCount = playerProgress.answered.length + 1;
    if (answeredCount >= total && !completedOnceRef.current) {
      completedOnceRef.current = true;
      const elapsed = gameStartTime ? Date.now() - gameStartTime : undefined;
      socketManager.completeGame((playerProgress.score + earned), elapsed, answeredCount);
    }
  }, [currentQuestion, answeredStatus, playerProgress, questionSpots.length, gameStartTime]);

  // HUD + Canvas + Modals
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-200 to-teal-200 flex flex-col items-center p-4">
      <div className="w-full max-w-6xl rounded-3xl shadow-xl bg-white/70 backdrop-blur-sm p-3 mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-700 font-semibold">{playerName} • Room: {roomId}</div>
        <div className="text-sm">Score: <span className="font-bold text-emerald-700">{playerProgress.score}</span> • Answered: {playerProgress.answered.length}/{questionSpots.length}</div>
        <div className="text-xs text-gray-500">ปุ่ม: A/D หรือ ←/→ เดิน, W/↑/Space กระโดด</div>
      </div>

      <div className="w-full max-w-6xl mb-3">
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

      <div className="w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-white/40 bg-[#9bd1ff]">
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="w-full h-[700px] block" />
      </div>

      {!gameStarted && (<div className="mt-4 text-center text-amber-700 bg-amber-100 border border-amber-300 px-4 py-2 rounded-xl">รอครูเริ่มเกมอยู่...</div>)}

      {showQuestion && currentQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-[90%] border border-gray-200">
            <div className="text-xl font-extrabold text-gray-900 mb-4 leading-snug">{currentQuestion.text}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.choices.map((c, i) => (
                <button key={i} onClick={() => answerQuestion(i)} className="p-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-900 text-left font-semibold shadow-sm hover:bg-indigo-50 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
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
                        <div className="text-xs text-gray-600">เวลา: {secs} วินาที</div>
                      </div>
                    </div>
                    <div className="text-lg font-extrabold text-emerald-700">{r.finalScore} คะแนน</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={restartGame} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow focus:outline-none focus:ring-2 focus:ring-emerald-300">เริ่มอีกครั้ง</button>
              <button aria-label="ปิดอันดับคะแนน" onClick={() => setShowRankings(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 shadow focus:outline-none focus:ring-2 focus:ring-slate-300">ปิด</button>
              <button onClick={() => router.push('/StudentDashboard/gameroom')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300">กลับหน้าห้อง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
