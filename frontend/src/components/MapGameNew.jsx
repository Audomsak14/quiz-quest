"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from '../lib/socket';
import { profileStorage } from '@/lib/profileStorage';

// Add custom animations
const customStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0; 
      transform: translateY(50px) scale(0.9); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
  }
  
  @keyframes characterBob {
    0%, 100% { transform: translateY(0px); }
    25% { transform: translateY(-2px) rotate(1deg); }
    50% { transform: translateY(-4px); }
    75% { transform: translateY(-2px) rotate(-1deg); }
  }
  
  @keyframes characterPulse {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.02); }
    50% { transform: scale(1.05); }
    75% { transform: scale(1.02); }
  }
  
  @keyframes sparkleRotate {
    0% { transform: rotate(0deg) scale(1); opacity: 1; }
    25% { opacity: 0.7; }
    50% { transform: rotate(180deg) scale(1.2); opacity: 0.5; }
    75% { opacity: 0.8; }
    100% { transform: rotate(360deg) scale(1); opacity: 1; }
  }
  
  @keyframes glowPulse {
    0%, 100% { opacity: 0.3; filter: blur(2px); }
    25% { opacity: 0.5; }
    50% { opacity: 0.8; filter: blur(1px); }
    75% { opacity: 0.6; }
  }
  
  @keyframes walkingBob {
    0%, 100% { transform: translateY(0px) scale(1); }
    25% { transform: translateY(-1px) scale(1.01) rotate(0.5deg); }
    50% { transform: translateY(-2px) scale(1.02); }
    75% { transform: translateY(-1px) scale(1.01) rotate(-0.5deg); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  
  .animate-slideUp {
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .character-bob {
    animation: characterBob 2s ease-in-out infinite;
  }
  
  .character-pulse {
    animation: characterPulse 3s ease-in-out infinite;
  }
  
  .sparkle-rotate {
    animation: sparkleRotate 4s linear infinite;
  }
  
  .glow-pulse {
    animation: glowPulse 2s ease-in-out infinite;
  }
  
  .walking-bob {
    animation: walkingBob 0.6s ease-in-out infinite;
  }
  
  .smooth-transition {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

// Inject styles
if (typeof window !== 'undefined' && !document.getElementById('custom-animations')) {
  const styleSheet = document.createElement("style");
  styleSheet.id = 'custom-animations';
  styleSheet.textContent = customStyles;
  document.head.appendChild(styleSheet);
}

export default function MapGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get room and player info from URL
  const [roomId, setRoomId] = useState(() => searchParams.get('roomId') || '');
  const [playerName, setPlayerName] = useState(() => {
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
  // Allow explicit playerId via URL so teacher can open a student link that joins as that player
  const [providedPlayerId] = useState(() => searchParams.get('playerId') || profileStorage.ensureId(playerName) || null);
  // Role from query (default student). Used to filter visibility of teacher avatar
  const role = searchParams.get('role') || 'student';
  const [roomPlayerId, setRoomPlayerId] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return window.sessionStorage.getItem(`qq:roomPlayerId:${roomId}:${playerName}`) || null; } catch { return null; }
  });

  // Ensure the student is registered in the room (DB) for teacher roster, even without Socket.IO.
  useEffect(() => {
    if (!roomId || !playerName) return;
    if (role !== 'student') return;
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
            const list = Array.isArray(rd?.room?.players) ? rd.room.players : [];
            const target = list.find((p) => (String(p?.name || '').trim().toLowerCase() === String(playerName).trim().toLowerCase()));
            if (target?.playerId) {
              const pid = String(target.playerId);
              setRoomPlayerId(pid);
              try { window.sessionStorage.setItem(`qq:roomPlayerId:${roomId}:${playerName}`, pid); } catch {}
            }
          } catch {}
        }
      } catch {}
    };

    join();
    return () => { cancelled = true; };
  }, [roomId, playerName, role]);

  const [isConnected, setIsConnected] = useState(false);
  
  // Avatar position (in pixels)
  const [position, setPosition] = useState({ x: 400, y: 300 });
  const [otherPlayers, setOtherPlayers] = useState({});
  const [isMoving, setIsMoving] = useState(false); // Track movement for animations
  
  // Game container ref
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  // Movement state
  const targetPositionRef = useRef({ x: 400, y: 300 });
  const moveHoldRef = useRef(null);
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [roomStatus, setRoomStatus] = useState('waiting'); // 'waiting', 'active', 'ended'
  const [competitionMode, setCompetitionMode] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [gameEndTime, setGameEndTime] = useState(null);
  const [gameResults, setGameResults] = useState(null);
  const [showRankings, setShowRankings] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [hintCollapsed, setHintCollapsed] = useState(false);
  
  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [playerProgress, setPlayerProgress] = useState({ answered: [], score: 0 });

  // REST fallback for spectator mode: periodically publish our live position.
  useEffect(() => {
    if (!roomId || !playerName) return;
    if (role !== 'student') return;
    if (!roomPlayerId) return;

    let cancelled = false;
    let lastSentAt = 0;

    const tick = async () => {
      const now = Date.now();
      if (now - lastSentAt < 90) return;
      lastSentAt = now;
      try {
        const payload = {
          roomId,
          playerId: roomPlayerId,
          playerName,
          x: position?.x ?? 0,
          y: position?.y ?? 0,
          score: playerProgress?.score ?? 0,
          answered: playerProgress?.answered?.length ?? 0,
          mode: 'map',
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
  }, [roomId, playerName, role, roomPlayerId, position?.x, position?.y, playerProgress?.score, playerProgress?.answered?.length]);
  
    const MOVE_SPEED = 34; // pixels per second (derived from previous feel ~0.56 * 60)
  const KEY_STEP = 17;    // keyboard step distance (pixels per key press)
  const MAP_WIDTH = 2400; // widened further for an even broader play area
  const MAP_HEIGHT = 1000; // taller canvas for larger visuals
  
  // Question state - will be loaded from API
  const [questionSpots, setQuestionSpots] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const totalQuestions = questionSpots.length;

  // Per-question timer (seconds) from question set
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeUp, setTimeUp] = useState(false);
  const timeUpHandledRef = useRef(false);
  const timeUpTimeoutRef = useRef(null);

  const redirectToLobby = useCallback(() => {
    try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, '1'); } catch {}
    try { window.location.replace('/StudentDashboard/gameroom'); }
    catch { window.location.href = '/StudentDashboard/gameroom'; }
  }, [roomId]);

  // If previously kicked, immediately redirect out of the game
  useEffect(() => {
    const rid = searchParams.get('roomId');
    if (!rid) return;
    try {
      if (window.sessionStorage.getItem(`qq:kicked:${rid}`) === '1') {
        window.location.replace('/StudentDashboard/gameroom');
      }
    } catch {}
  }, [searchParams]);

  // Continuous safety: check kicked flag periodically (covers any missed events)
  useEffect(() => {
    const rid = searchParams.get('roomId');
    if (!rid) return;
    const iv = setInterval(() => {
      try {
        if (window.sessionStorage.getItem(`qq:kicked:${rid}`) === '1') {
          window.location.replace('/StudentDashboard/gameroom');
        }
      } catch {}
    }, 800);
    return () => clearInterval(iv);
  }, [searchParams]);

  // Load questions from API
  useEffect(() => {
    const loadQuestions = async () => {
      if (!roomId) return;
      
      try {
        setIsLoadingQuestions(true);
        console.log('Loading questions for room:', roomId);
        
        const response = await fetch(`http://localhost:5000/api/game/questions/${roomId}`);
        const data = await response.json();

        const tl = Number(data?.timeLimit);
        if (Number.isFinite(tl) && tl > 0) setTimePerQuestion(Math.max(1, Math.floor(tl)));
        
        if (data.success && data.questions) {
          // Transform API questions to game format
          const gameQuestions = data.questions.map(q => ({
            id: q.id,
            x: q.x,
            y: q.y,
            question: {
              id: q.id,
              text: q.text,
              choices: q.choices,
              answerIndex: q.answerIndex,
              points: q.points || 100
            }
          }));
          
          setQuestionSpots(gameQuestions);
          console.log('Questions loaded successfully:', gameQuestions);
        } else {
          console.error('Failed to load questions:', data.error);
          // Fallback to default questions if API fails
          setQuestionSpots([
            { id: 'q1', x: 200, y: 150, question: { id: 'q1', text: 'Sample Question 1', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
            { id: 'q2', x: 600, y: 200, question: { id: 'q2', text: 'Sample Question 2', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
            { id: 'q3', x: 800, y: 400, question: { id: 'q3', text: 'Sample Question 3', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
            { id: 'q4', x: 300, y: 500, question: { id: 'q4', text: 'Sample Question 4', choices: ['A', 'B', 'C', 'D'], answerIndex: 2 } },
            { id: 'q5', x: 900, y: 600, question: { id: 'q5', text: 'Sample Question 5', choices: ['A', 'B', 'C', 'D'], answerIndex: 0 } }
          ]);
        }
      } catch (error) {
        console.error('Error loading questions:', error);
        // Fallback to default questions
        setQuestionSpots([
          { id: 'q1', x: 200, y: 150, question: { id: 'q1', text: 'Sample Question 1', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
          { id: 'q2', x: 600, y: 200, question: { id: 'q2', text: 'Sample Question 2', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
          { id: 'q3', x: 800, y: 400, question: { id: 'q3', text: 'Sample Question 3', choices: ['A', 'B', 'C', 'D'], answerIndex: 1 } },
          { id: 'q4', x: 300, y: 500, question: { id: 'q4', text: 'Sample Question 4', choices: ['A', 'B', 'C', 'D'], answerIndex: 2 } },
          { id: 'q5', x: 900, y: 600, question: { id: 'q5', text: 'Sample Question 5', choices: ['A', 'B', 'C', 'D'], answerIndex: 0 } }
        ]);
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    
    loadQuestions();
  }, [roomId]);

  // Question countdown timer: starts when the question modal opens.
  useEffect(() => {
    if (!showQuestionModal || !currentQuestion) {
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
        timeUpTimeoutRef.current = setTimeout(() => {
          try { handleAnswerQuestion(-1, { timedOut: true }); } catch {}
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
  }, [showQuestionModal, currentQuestion, timePerQuestion]);

  // Socket connection
  useEffect(() => {
    let gotRoomState = false;
    if (roomId && playerName) {
      socketManager.connect();
      
      socketManager.on('connected', () => {
        // Join with explicit role so backend tracks teacher/student
        // Prefer DB-backed roomPlayerId so REST roster + socket state align (prevents duplicates/blinking in spectator/teacher views)
        const socketPlayerId = roomPlayerId || providedPlayerId;
        const success = socketManager.joinRoom(roomId, playerName, role, socketPlayerId);
        setIsConnected(success);
      });

      socketManager.on('roomState', (data) => {
        gotRoomState = true;
        // Update room status
        if (data.status) {
          setRoomStatus(data.status);
          setGameStarted(data.status === 'active');
        }
        if (data.startedAt && !gameStartTime) {
          setGameStartTime(data.startedAt);
        }
        
        if (data.players) {
          const others = {};
          let selfPresent = false;
          data.players.forEach(player => {
            if (player.playerId === socketManager.getPlayerId()) {
              selfPresent = true;
            }
            // Hide teacher avatar on student view
            if (role === 'student' && player.role === 'teacher') return;
            if (player.playerId !== socketManager.getPlayerId()) {
              others[player.playerId] = player;
            }
          });
          setOtherPlayers(others);
          // If this client is not present in the room state after we've joined, treat as kicked and leave
          if (isConnected && !selfPresent) {
            redirectToLobby();
          }
        }
      });

      socketManager.on('playerJoined', (data) => {
        // Ignore teacher appearance on student view
        if (role === 'student' && data?.role === 'teacher') return;
        if (data.playerId !== socketManager.getPlayerId()) {
          setOtherPlayers(prev => ({
            ...prev,
            [data.playerId]: data
          }));
        }
      });

      socketManager.on('playerMoved', (data) => {
        // Movement events don't include role; avoid re-adding filtered players
        if (data.playerId !== socketManager.getPlayerId()) {
          setOtherPlayers(prev => {
            // If this player isn't already tracked (e.g., a teacher we filtered out), ignore
            if (!prev[data.playerId]) return prev;
            return {
              ...prev,
              [data.playerId]: { ...prev[data.playerId], x: data.x, y: data.y }
            };
          });
        }
      });

      // Remove avatars when someone leaves or is kicked
      socketManager.on('playerLeft', (data) => {
        if (!data?.playerId) return;
        // If the left player is me, leave the game immediately
        if (data.playerId === socketManager.getPlayerId()) {
          redirectToLobby();
          return;
        }
        setOtherPlayers(prev => {
          if (!prev[data.playerId]) return prev;
          const copy = { ...prev };
          delete copy[data.playerId];
          return copy;
        });
      });

      // Listen for game start event
      socketManager.on('gameStarted', (payload) => {
        setGameStarted(true);
        setRoomStatus('active');
        const ts = payload?.startedAt || Date.now();
        setGameStartTime(ts);
      });

      socketManager.on('competitionMode', (payload) => {
        if (payload?.roomId === roomId) {
          setCompetitionMode(!!payload.enabled);
        }
      });

      // Listen for game results and rankings
      socketManager.on('gameResults', (data) => {
        console.log('Game results received:', data);
        setGameResults(data);
        // Auto show rankings when we receive results
        setTimeout(() => setShowRankings(true), 1000);
      });

      // If teacher kicks this player, redirect them back to gameroom
      socketManager.on('kicked', () => {
        try { window.sessionStorage.setItem(`qq:kicked:${roomId}`, '1'); } catch {}
        try { window.location.replace('/StudentDashboard/gameroom'); } catch { window.location.href = '/StudentDashboard/gameroom'; }
      });

      // On disconnect, do not auto-redirect unless explicitly kicked;
      // allow transient disconnects to reconnect without ejecting the player.
      socketManager.on('disconnected', (info) => {
        const wasKicked = !!info?.wasKicked;
        if (wasKicked) redirectToLobby();
      });

      // Fallback: leave only if explicitly kicked (avoid ejecting on brief connection hiccups)
      const failSafe = setTimeout(() => {
        try {
          const kickedFlag = window.sessionStorage.getItem(`qq:kicked:${roomId}`) === '1';
          if (kickedFlag) {
            redirectToLobby();
          }
        } catch {}
      }, 2000);

      return () => {
        clearTimeout(failSafe);
        socketManager.disconnect();
        setIsConnected(false);
      };
    }
  }, [roomId, playerName, role, providedPlayerId, roomPlayerId]);

  // Failsafe: Poll room status and force leave if not active
  useEffect(() => {
    let timer;
    let cancelled = false;
    const confirmedInRosterRef = { current: false };
    const check = async () => {
      try {
        if (!roomId) return;
        const r = await fetch(`http://localhost:5000/api/game/room/${roomId}`);
        const data = await r.json().catch(() => ({}));
        const status = data?.room?.status || data?.status;

        // If we are a student and got kicked from the DB roster, leave even if room remains active.
        if (role === 'student' && roomPlayerId) {
          const roster = Array.isArray(data?.room?.players) ? data.room.players : [];
          const stillHere = roster.some((p) => String(p?.playerId) === String(roomPlayerId));
          if (stillHere) confirmedInRosterRef.current = true;
          if (!cancelled && confirmedInRosterRef.current && !stillHere) {
            redirectToLobby();
            return;
          }
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
  }, [roomId, role, roomPlayerId, redirectToLobby]);

  const moveToPoint = useCallback((x, y) => {
    // Clamp to map boundaries
    const clampedX = Math.max(30, Math.min(MAP_WIDTH - 30, x));
    const clampedY = Math.max(30, Math.min(MAP_HEIGHT - 30, y));
    
    targetPositionRef.current = { x: clampedX, y: clampedY };
    
    // Broadcast movement if connected
    if (isConnected) {
      socketManager.movePlayer(clampedX, clampedY);
    }
  }, [isConnected]);

  // Small step movement helper (used by keyboard and on-screen buttons)
  const stepBy = useCallback((dx, dy) => {
    if (showQuestionModal || !gameStarted) return;
    const currentPos = targetPositionRef.current;
    moveToPoint(currentPos.x + dx, currentPos.y + dy);
  }, [moveToPoint, showQuestionModal, gameStarted]);

  // Hold-to-move for touch/mouse on-screen buttons
  const startHold = useCallback((dx, dy) => {
    // initial step for snappy feel
    stepBy(dx, dy);
  if (moveHoldRef.current) clearInterval(moveHoldRef.current);
  moveHoldRef.current = setInterval(() => stepBy(dx, dy), 60);
  }, [stepBy]);

  const stopHold = useCallback(() => {
    if (moveHoldRef.current) {
      clearInterval(moveHoldRef.current);
      moveHoldRef.current = null;
    }
  }, []);

  const handleClick = useCallback((e) => {
    if (!containerRef.current || showQuestionModal || !gameStarted) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    moveToPoint(x, y);
  }, [moveToPoint, showQuestionModal, gameStarted]);

  const handleTouch = useCallback((e) => {
    e.preventDefault();
    if (!containerRef.current || showQuestionModal || !gameStarted) return;
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((touch.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    moveToPoint(x, y);
  }, [moveToPoint, showQuestionModal, gameStarted]);

  // Arrow/WASD key handlers (use e.code for layout-independent WASD)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showQuestionModal || !gameStarted) return; // Don't move when answering questions or game not started
      
      const code = e.code;
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault(); stepBy(0, -KEY_STEP); break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault(); stepBy(0, KEY_STEP); break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault(); stepBy(-KEY_STEP, 0); break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault(); stepBy(KEY_STEP, 0); break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepBy, showQuestionModal, gameStarted]);

  // Movement animation loop with enhanced smoothing
  useEffect(() => {
    let lastTime = 0;
    let lastPosition = { x: 400, y: 300 };
    
    // Easing function for smooth movement
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
    const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    const animate = (currentTime) => {
      const deltaMs = lastTime ? (currentTime - lastTime) : 16.67; // default first frame ~60fps
      lastTime = currentTime;
      const deltaTime = Math.min(deltaMs / 1000, 1/30); // seconds, cap to avoid huge jumps
      
      const target = targetPositionRef.current;
      setPosition(currentPos => {
        const dx = target.x - currentPos.x;
        const dy = target.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if character is moving
        const movementThreshold = 0.5;
        const actualDistance = Math.sqrt(
          Math.pow(currentPos.x - lastPosition.x, 2) + 
          Math.pow(currentPos.y - lastPosition.y, 2)
        );
        setIsMoving(actualDistance > movementThreshold || distance > 2);
        lastPosition = { ...currentPos };
        
        if (distance < 1.5) {
          return target; // arrived with tighter threshold
        }
        
        // Enhanced movement with smooth deceleration
        const normalizedDistance = Math.min(distance / 100, 1); // Normalize for easing
        const easedProgress = easeInOutCubic(normalizedDistance);
        
        // Dynamic speed based on distance and true deltaTime seconds
        const adaptiveSpeed = MOVE_SPEED * deltaTime; // pixels per second * seconds
        const stepSize = Math.min(adaptiveSpeed * (0.3 + easedProgress * 0.7), distance);
        const ratio = stepSize / distance;
        
        return {
          x: currentPos.x + dx * ratio,
          y: currentPos.y + dy * ratio
        };
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Removed timer effect (no elapsed time display)

  // Check for question hotspot collisions
  useEffect(() => {
    if (!gameStarted) return; // Only check collisions when game is started
    
    questionSpots.forEach(spot => {
      const distance = Math.sqrt(
        Math.pow(position.x - spot.x, 2) + Math.pow(position.y - spot.y, 2)
      );
      
      // If close to a question spot (50px radius) and haven't answered this question yet
      if (distance < 50 && !playerProgress.answered.includes(spot.id)) {
        setCurrentQuestion(spot.question);
        setShowQuestionModal(true);
      }
    });
  }, [position, playerProgress.answered, gameStarted]);

  const handleAnswerQuestion = (selectedIndex, opts = {}) => {
    if (!currentQuestion) return;

    if (timeUp && !opts?.timedOut) return;

    const timedOut = Boolean(opts?.timedOut) || !Number.isFinite(selectedIndex) || selectedIndex < 0;
    
    const correct = (!timedOut) && (selectedIndex === currentQuestion.answerIndex);
    const earned = correct ? (currentQuestion.points ?? 100) : 0;
    
    // Update local progress
    const newAnswered = [...playerProgress.answered, currentQuestion.id];
    const newScore = playerProgress.score + earned;
    
    setPlayerProgress({
      answered: newAnswered,
      score: newScore
    });
    
    // Check if all questions are completed (5 questions total)
    if (newAnswered.length >= questionSpots.length) {
      const endTime = Date.now();
      setGameEndTime(endTime);
      setGameCompleted(true);

      // Send game completion to server (socket if available, otherwise REST)
      const elapsedMs = gameStartTime ? Math.max(0, endTime - gameStartTime) : 0;
      // Prefer DB-backed roomPlayerId so REST + socket + teacher views stay aligned
      const playerId = roomPlayerId || socketManager.getPlayerId() || providedPlayerId || null;
      const playerLabel = playerName || 'Player';
      // Keep socket UX responsiveness, but ALWAYS persist via REST so teacher results (esp. completion time)
      // remain accurate even if the player leaves right after finishing.
      if (isConnected) socketManager.completeGame(newScore, elapsedMs, newAnswered.length);

      fetch('http://localhost:5000/api/game/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId,
          playerName: playerLabel,
          finalScore: newScore,
          completionTime: elapsedMs,
          questionsAnswered: newAnswered.length,
        }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data?.success && data?.rankings) {
            setGameResults(data);
            return;
          }
          // Only apply a local fallback if we don't already have results (e.g., via socket)
          setGameResults((prev) =>
            prev?.rankings?.length
              ? prev
              : {
                  roomId,
                  rankings: [
                    {
                      rank: 1,
                      playerId,
                      playerName: playerLabel,
                      finalScore: newScore,
                      completionTime: elapsedMs,
                      timestamp: Date.now(),
                    },
                  ],
                }
          );
        })
        .catch(() => {
          setGameResults((prev) =>
            prev?.rankings?.length
              ? prev
              : {
                  roomId,
                  rankings: [
                    {
                      rank: 1,
                      playerId,
                      playerName: playerLabel,
                      finalScore: newScore,
                      completionTime: elapsedMs,
                      timestamp: Date.now(),
                    },
                  ],
                }
          );
        });
    }
    
    // Send answer to server
    if (isConnected) {
      socketManager.answerQuestion(currentQuestion.id, timedOut ? -1 : selectedIndex, correct, earned);
    }
    
    // Close modal
    setShowQuestionModal(false);
    setCurrentQuestion(null);
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    setCurrentQuestion(null);
  };

  // Show loading screen while questions are loading
  if (isLoadingQuestions) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-spin">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">กำลังโหลดคำถาม...</h2>
          <p className="text-gray-600">กรุณารอสักครู่</p>
          <div className="text-sm text-gray-500 mt-4">
            <div>ห้อง: <span className="font-semibold text-blue-600">{roomId}</span></div>
          </div>
        </div>
      </div>
    );
  }

  // If game hasn't started, show waiting screen
  if (!gameStarted && roomStatus === 'waiting') {
    return (
      <div className="relative w-full h-screen bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 overflow-hidden flex items-center justify-center">
        <div className="bg-white/90 rounded-2xl p-8 max-w-md mx-4 text-center shadow-xl">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">รอครูเริ่มเกม</h2>
            <p className="text-gray-600">กรุณารอจนกว่าครูจะกดปุ่มเริ่มเกม</p>
          </div>
          
          <div className="text-sm text-gray-500 space-y-1">
            <div>ห้อง: <span className="font-semibold text-blue-600">{roomId}</span></div>
            <div>ผู้เล่น: <span className="font-semibold text-blue-600">{playerName}</span></div>
            {isConnected && (
              <div className="text-xs text-green-600">🟢 เชื่อมต่อแล้ว</div>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>เมื่อเกมเริ่ม:</strong><br />
              - เดินไปหาเครื่องหมาย ? เพื่อตอบคำถาม<br />
              - ใช้ Click หรือปุ่ม WASD เพื่อเดิน<br />
              - ตอบถูกจะได้ {questionSpots?.[0]?.question?.points ?? 100} แต้ม
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{
      background: 'linear-gradient(135deg, #87ceeb 0%, #98fb98 50%, #90ee90 100%)'
    }}>

      {/* Competition banner */}
      {competitionMode && (
        <div className="absolute top-6 right-6 z-30 pointer-events-none">
          <div className="bg-red-600 text-white px-4 py-2 rounded-2xl shadow-lg font-bold">🏁 โหมดการแข่งขัน — ครูดูได้เท่านั้น</div>
        </div>
      )}
      
      {/* Enhanced Stylish Game HUD (non-blocking) with collapse/expand */}
      <div className="absolute top-6 left-6 z-20">
        {hudCollapsed ? (
          <button
            onClick={() => setHudCollapsed(false)}
            className="pointer-events-auto bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-white/50 px-5 py-3 flex items-center gap-3 hover:shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition-all duration-300 transform hover:scale-105 smooth-transition"
            title="แสดง HUD"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-lg">👤</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-700 font-semibold max-w-[120px] truncate">{playerName}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-lg">{playerProgress.score}</span>
                <span className="text-gray-400">•</span>
                <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-lg">{playerProgress.answered.length}/{totalQuestions || 5}</span>
              </div>
            </div>
          </button>
        ) : (
          <>
            {/* Enhanced Toggle row */}
            <div className="flex mb-3">
              <button
                onClick={() => setHudCollapsed(true)}
                className="pointer-events-auto w-10 h-10 rounded-xl bg-gradient-to-br from-white/95 to-gray-50/95 hover:from-white hover:to-gray-50 text-gray-700 flex items-center justify-center shadow-lg border border-white/60 transition-all duration-200 transform hover:scale-105"
                title="ซ่อน HUD"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {/* Enhanced HUD Card - non-blocking */}
            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-xl rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-white/40 p-6 min-w-[320px] pointer-events-none">
              {/* Header with profile */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white/60">
                    <span className="text-white text-2xl">👤</span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                </div>
                <div>
                  <div className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    {playerName}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>Room: {roomId}</span>
                    {isMoving && <span className="text-blue-500 animate-pulse">🏃‍♂️</span>}
                  </div>
                </div>
              </div>
              
              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border border-blue-200/50 shadow-inner">
                  <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Score</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">{playerProgress.score}</div>
                  <div className="text-xs text-blue-500 mt-1">คะแนน</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-4 text-center border border-green-200/50 shadow-inner">
                  <div className="text-xs text-green-600 font-semibold uppercase tracking-wider">Progress</div>
                  <div className="text-2xl font-bold text-green-700 mt-1">{playerProgress.answered.length}/{totalQuestions || 5}</div>
                  <div className="text-xs text-green-500 mt-1">คำถาม</div>
                </div>
              </div>
              
              {/* Game Status */}
              <div className="mb-4">
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-4 text-center border border-purple-200/50 shadow-inner">
                  <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Status</div>
                  <div className="text-3xl my-2">{gameStarted ? '🎮' : '⏳'}</div>
                  <div className="text-sm font-medium text-purple-700">
                    {gameStarted ? (isMoving ? 'กำลังเดิน' : 'พร้อมเล่น') : 'รอเริ่มเกม'}
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600 font-semibold">ความคืบหน้า</span>
                  <span className="text-xs text-gray-600 font-bold">
                    {Math.min(100, Math.round(((playerProgress.answered.length || 0) / Math.max(1, totalQuestions || 5)) * 100))}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner border border-gray-300/30">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-green-500 to-cyan-500 transition-all duration-500 ease-out rounded-full shadow-lg"
                    style={{ width: `${Math.min(100, Math.round(((playerProgress.answered.length || 0) / Math.max(1, totalQuestions || 5)) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Enhanced Connection Status */}
              <div className={`text-xs px-4 py-3 rounded-2xl text-center font-semibold shadow-inner border transition-all duration-300 ${
                isConnected 
                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-200/50' 
                  : 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700 border-red-200/50'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  {isConnected ? 'เชื่อมต่อแล้ว' : 'การเชื่อมต่อขาด'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Beautiful Game Canvas with SVG (nearly full-screen; keep top HUD area) */}
      <div 
        ref={containerRef}
        className="relative w-full h-full cursor-pointer"
        onClick={handleClick}
        onTouchStart={handleTouch}
      >
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="absolute inset-0"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100vw', height: 'calc(100vh - 180px)' }}
        >
          {/* Define patterns and effects */}
          <defs>
            {/* Enhanced grass texture with multiple layers */}
            <pattern id="grassTexture" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect width="80" height="80" fill="#4ade80"/>
              {/* Grass blades */}
              <circle cx="20" cy="20" r="3" fill="#22c55e" opacity="0.7"/>
              <circle cx="60" cy="35" r="2" fill="#16a34a" opacity="0.8"/>
              <circle cx="45" cy="65" r="2.5" fill="#22c55e" opacity="0.6"/>
              <circle cx="15" cy="55" r="1.8" fill="#16a34a" opacity="0.9"/>
              <circle cx="70" cy="15" r="2.2" fill="#34d399" opacity="0.7"/>
              <circle cx="35" cy="40" r="1.5" fill="#10b981" opacity="0.8"/>
              {/* Flowers */}
              <circle cx="25" cy="70" r="1" fill="#fbbf24" opacity="0.9"/>
              <circle cx="65" cy="50" r="1.2" fill="#f59e0b" opacity="0.8"/>
              <circle cx="50" cy="25" r="0.8" fill="#ec4899" opacity="0.7"/>
            </pattern>

            {/* Sky gradient background */}
            <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{stopColor:'#87ceeb', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#b6e5f5', stopOpacity:1}} />
              <stop offset="60%" style={{stopColor:'#d6f3ff', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#f0f9ff', stopOpacity:1}} />
            </linearGradient>

            {/* Ground gradient */}
            <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{stopColor:'#4ade80', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#22c55e', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#16a34a', stopOpacity:1}} />
            </linearGradient>

            {/* Cloud pattern */}
            <pattern id="cloudPattern" x="0" y="0" width="400" height="200" patternUnits="userSpaceOnUse">
              <rect width="400" height="200" fill="none"/>
              <ellipse cx="80" cy="40" rx="35" ry="15" fill="#ffffff" opacity="0.8"/>
              <ellipse cx="100" cy="35" rx="25" ry="12" fill="#ffffff" opacity="0.9"/>
              <ellipse cx="65" cy="35" rx="20" ry="10" fill="#ffffff" opacity="0.7"/>
              
              <ellipse cx="280" cy="80" rx="40" ry="18" fill="#ffffff" opacity="0.6"/>
              <ellipse cx="305" cy="75" rx="30" ry="15" fill="#ffffff" opacity="0.8"/>
              <ellipse cx="260" cy="75" rx="25" ry="12" fill="#ffffff" opacity="0.7"/>
              
              <ellipse cx="350" cy="120" rx="30" ry="12" fill="#ffffff" opacity="0.9"/>
              <ellipse cx="370" cy="118" rx="20" ry="8" fill="#ffffff" opacity="0.8"/>
            </pattern>

            {/* Enhanced wall gradient with depth */}
            <linearGradient id="wallGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#6366f1', stopOpacity:1}} />
              <stop offset="25%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
              <stop offset="75%" style={{stopColor:'#a855f7', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#7c3aed', stopOpacity:1}} />
            </linearGradient>

            {/* Enhanced tree gradients */}
            <radialGradient id="leafGradient" cx="30%" cy="30%" r="100%">
              <stop offset="0%" style={{stopColor:'#34d399', stopOpacity:1}} />
              <stop offset="40%" style={{stopColor:'#10b981', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#065f46', stopOpacity:1}} />
            </radialGradient>

            <linearGradient id="trunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:'#92400e', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#8b4513', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#451a03', stopOpacity:1}} />
            </linearGradient>

            {/* Flower gradients */}
            <radialGradient id="flowerGradient1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{stopColor:'#fef3c7', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
            </radialGradient>

            <radialGradient id="flowerGradient2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{stopColor:'#fce7f3', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#ec4899', stopOpacity:1}} />
            </radialGradient>

            <radialGradient id="flowerGradient3" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{stopColor:'#dbeafe', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
            </radialGradient>

            {/* Enhanced player body gradient */}
            <linearGradient id="playerBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#6366f1', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#1d4ed8', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#1e40af', stopOpacity:1}} />
            </linearGradient>
            
            {/* Body outline gradient */}
            <linearGradient id="bodyOutlineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#1e293b', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#475569', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#1e293b', stopOpacity:1}} />
            </linearGradient>
            
            {/* Body border gradient */}
            <linearGradient id="bodyBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#60a5fa', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#2563eb', stopOpacity:1}} />
            </linearGradient>

            {/* Face gradient */}
            <radialGradient id="faceGradient" cx="30%" cy="30%" r="80%">
              <stop offset="0%" style={{stopColor:'#fcd34d', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#fbbf24', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
            </radialGradient>
            
            {/* Face border gradient */}
            <linearGradient id="faceBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#d97706', stopOpacity:1}} />
            </linearGradient>

            {/* Controller gradient */}
            <linearGradient id="controllerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#34d399', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#10b981', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#059669', stopOpacity:1}} />
            </linearGradient>

            {/* Crown gradient */}
            <linearGradient id="crownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#fcd34d', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#fbbf24', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#d97706', stopOpacity:1}} />
            </linearGradient>
            
            {/* Crown border gradient */}
            <linearGradient id="crownBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#b45309', stopOpacity:1}} />
            </linearGradient>

            {/* Rainbow gradient for outer ring */}
            <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:'#ef4444', stopOpacity:1}} />
              <stop offset="16.66%" style={{stopColor:'#f97316', stopOpacity:1}} />
              <stop offset="33.33%" style={{stopColor:'#eab308', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#22c55e', stopOpacity:1}} />
              <stop offset="66.66%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
              <stop offset="83.33%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#ec4899', stopOpacity:1}} />
            </linearGradient>

            {/* Shadow gradient */}
            <radialGradient id="shadowGradient" cx="50%" cy="50%" r="100%">
              <stop offset="0%" style={{stopColor:'#000000', stopOpacity:0.6}} />
              <stop offset="100%" style={{stopColor:'#000000', stopOpacity:0}} />
            </radialGradient>

            {/* Name tag gradient */}
            <linearGradient id="nameTagGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#7c3aed', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#6366f1', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#4f46e5', stopOpacity:1}} />
            </linearGradient>
            
            {/* Name tag border gradient */}
            <linearGradient id="nameTagBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#a78bfa', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#60a5fa', stopOpacity:1}} />
            </linearGradient>

            {/* Other player gradients */}
            <linearGradient id="otherPlayerOutlineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#374151', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#4b5563', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#374151', stopOpacity:1}} />
            </linearGradient>
            
            <linearGradient id="otherPlayerBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#ef4444', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#f97316', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#dc2626', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#b91c1c', stopOpacity:1}} />
            </linearGradient>
            
            <radialGradient id="otherFaceGradient" cx="30%" cy="30%" r="80%">
              <stop offset="0%" style={{stopColor:'#fde68a', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#fcd34d', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#f59e0b', stopOpacity:1}} />
            </radialGradient>
            
            <linearGradient id="otherNameTagGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#64748b', stopOpacity:1}} />
              <stop offset="30%" style={{stopColor:'#475569', stopOpacity:1}} />
              <stop offset="70%" style={{stopColor:'#334155', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#1e293b', stopOpacity:1}} />
            </linearGradient>

            {/* Enhanced filter effects */}
            <filter id="questionGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <filter id="playerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.3"/>
            </filter>
            
            <filter id="faceShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.2"/>
            </filter>
            
            <filter id="nameTagShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.4"/>
            </filter>
            
            <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.5"/>
            </filter>
          </defs>

          {/* Enhanced Beautiful Background Layers */}
          
          {/* Sky background layer */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT * 0.6} fill="url(#skyGradient)" />
          
          {/* Animated clouds layer */}
          <g className="clouds">
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT * 0.6} fill="url(#cloudPattern)" opacity="0.8">
              <animateTransform attributeName="transform" type="translate" 
                dur="120s" values={`-400,0; ${MAP_WIDTH},0; -400,0`} repeatCount="indefinite"/>
            </rect>
            <rect x="200" y="20" width={MAP_WIDTH} height={MAP_HEIGHT * 0.5} fill="url(#cloudPattern)" opacity="0.6">
              <animateTransform attributeName="transform" type="translate" 
                dur="80s" values={`-300,0; ${MAP_WIDTH + 200},0; -300,0`} repeatCount="indefinite"/>
            </rect>
          </g>
          
          {/* Ground/grass background with gradient */}
          <rect x="0" y={MAP_HEIGHT * 0.6} width={MAP_WIDTH} height={MAP_HEIGHT * 0.4} fill="url(#groundGradient)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grassTexture)" opacity="0.8" />
          
          {/* Sun/light source */}
          <g className="sun">
            <circle cx={MAP_WIDTH - 200} cy="100" r="60" fill="#fbbf24" opacity="0.8">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="8s" repeatCount="indefinite"/>
            </circle>
            <circle cx={MAP_WIDTH - 200} cy="100" r="45" fill="#fcd34d" opacity="0.9"/>
            <circle cx={MAP_WIDTH - 200} cy="100" r="30" fill="#fef3c7" opacity="1"/>
            
            {/* Sun rays */}
            <g opacity="0.5">
              <line x1={MAP_WIDTH - 200} y1="20" x2={MAP_WIDTH - 200} y2="40" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 140} y1="40" x2={MAP_WIDTH - 155} y2="55" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 120} y1="100" x2={MAP_WIDTH - 140} y2="100" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 140} y1="160" x2={MAP_WIDTH - 155} y2="145" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 200} y1="180" x2={MAP_WIDTH - 200} y2="160" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 260} y1="160" x2={MAP_WIDTH - 245} y2="145" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 280} y1="100" x2={MAP_WIDTH - 260} y2="100" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
              <line x1={MAP_WIDTH - 260} y1="40" x2={MAP_WIDTH - 245} y2="55" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" 
                  dur="20s" values={`0 ${MAP_WIDTH - 200} 100; 360 ${MAP_WIDTH - 200} 100`} repeatCount="indefinite"/>
              </line>
            </g>
          </g>
          
          {/* Maze walls - creating a beautiful maze layout with enhanced shadows */}
          {/* Outer boundary walls */}
          <rect x="0" y="0" width={MAP_WIDTH} height="30" fill="url(#wallGradient)" rx="15" filter="url(#dropShadow)"/>
          <rect x="0" y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradient)" rx="15" filter="url(#dropShadow)"/>
          <rect x={MAP_WIDTH-30} y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradient)" rx="15" filter="url(#dropShadow)"/>
          <rect x="0" y={MAP_HEIGHT-30} width={MAP_WIDTH} height="30" fill="url(#wallGradient)" rx="15" filter="url(#dropShadow)"/>
          
          {/* Inner maze walls with depth and shadow */}
          <rect x="120" y="80" width="300" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="500" y="120" width="25" height="250" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="650" y="60" width="200" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="200" y="320" width="350" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="750" y="200" width="25" height="180" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="100" y="480" width="25" height="250" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="400" y="450" width="250" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="850" y="350" width="120" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="300" y="600" width="200" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="680" y="520" width="25" height="150" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          
          {/* Additional decorative walls for more interesting maze */}
          <rect x="1200" y="400" width="150" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="800" y="680" width="200" height="25" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="1400" y="200" width="25" height="300" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          <rect x="600" y="800" width="25" height="150" fill="url(#wallGradient)" rx="12" filter="url(#dropShadow)"/>
          
          {/* Light rays effect from sun */}
          <g className="light-rays" opacity="0.3">
            <polygon points={`${MAP_WIDTH - 200},100 200,600 250,620 ${MAP_WIDTH - 180},120`} fill="#fbbf24" opacity="0.1"/>
            <polygon points={`${MAP_WIDTH - 200},100 400,700 450,720 ${MAP_WIDTH - 170},130`} fill="#fde047" opacity="0.08"/>
            <polygon points={`${MAP_WIDTH - 200},100 800,800 850,820 ${MAP_WIDTH - 150},150`} fill="#fef3c7" opacity="0.06"/>
            <polygon points={`${MAP_WIDTH - 200},100 1200,850 1250,870 ${MAP_WIDTH - 130},170`} fill="#fffbeb" opacity="0.04"/>
          </g>
          
          {/* Enhanced Beautiful decorative trees and nature elements */}
          <g className="trees">
            {/* Large majestic tree 1 */}
            <g transform="translate(380,280)">
              <ellipse cx="0" cy="40" rx="12" ry="6" fill="#00000030"/>
              <rect x="-8" y="15" width="16" height="50" fill="url(#trunkGradient)" rx="4" filter="url(#dropShadow)"/>
              <circle cx="0" cy="-5" r="40" fill="url(#leafGradient)" filter="url(#dropShadow)"/>
              <circle cx="-15" cy="-20" r="28" fill="#22c55e" opacity="0.8"/>
              <circle cx="20" cy="-15" r="22" fill="#16a34a" opacity="0.9"/>
              <circle cx="0" cy="-30" r="18" fill="#34d399" opacity="0.7"/>
              <circle cx="-8" cy="-8" r="12" fill="#10b981" opacity="0.8"/>
              
              {/* Swaying animation */}
              <animateTransform attributeName="transform" type="rotate" 
                dur="6s" values="-1 0 65; 1 0 65; -1 0 65" repeatCount="indefinite"/>
            </g>
            
            {/* Elegant tree 2 */}
            <g transform="translate(900,180)">
              <ellipse cx="0" cy="30" rx="8" ry="4" fill="#00000025"/>
              <rect x="-5" y="10" width="10" height="35" fill="url(#trunkGradient)" rx="3"/>
              <circle cx="0" cy="-8" r="30" fill="url(#leafGradient)"/>
              <circle cx="-12" cy="-18" r="20" fill="#16a34a" opacity="0.8"/>
              <circle cx="15" cy="-12" r="16" fill="#22c55e" opacity="0.9"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="8s" values="1 0 45; -1 0 45; 1 0 45" repeatCount="indefinite"/>
            </g>
            
            {/* Grand tree 3 */}
            <g transform="translate(280,580)">
              <ellipse cx="0" cy="45" rx="14" ry="7" fill="#00000030"/>
              <rect x="-10" y="20" width="20" height="55" fill="url(#trunkGradient)" rx="5" filter="url(#dropShadow)"/>
              <circle cx="0" cy="-10" r="45" fill="url(#leafGradient)" filter="url(#dropShadow)"/>
              <circle cx="-20" cy="-25" r="30" fill="#22c55e" opacity="0.8"/>
              <circle cx="25" cy="-20" r="25" fill="#16a34a" opacity="0.9"/>
              <circle cx="0" cy="-35" r="20" fill="#34d399" opacity="0.7"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="7s" values="-1.5 0 75; 1.5 0 75; -1.5 0 75" repeatCount="indefinite"/>
            </g>
            
            {/* Charming tree 4 */}
            <g transform="translate(1000,480)">
              <ellipse cx="0" cy="32" rx="9" ry="4" fill="#00000025"/>
              <rect x="-6" y="12" width="12" height="38" fill="url(#trunkGradient)" rx="3"/>
              <circle cx="0" cy="-8" r="32" fill="url(#leafGradient)"/>
              <circle cx="-14" cy="-20" r="22" fill="#22c55e" opacity="0.8"/>
              <circle cx="16" cy="-15" r="18" fill="#16a34a" opacity="0.9"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="9s" values="1.2 0 50; -1.2 0 50; 1.2 0 50" repeatCount="indefinite"/>
            </g>
            
            {/* Small decorative tree 5 */}
            <g transform="translate(1500,350)">
              <ellipse cx="0" cy="25" rx="6" ry="3" fill="#00000020"/>
              <rect x="-3" y="8" width="6" height="25" fill="url(#trunkGradient)" rx="2"/>
              <circle cx="0" cy="-5" r="22" fill="url(#leafGradient)"/>
              <circle cx="-8" cy="-12" r="14" fill="#16a34a" opacity="0.8"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="5s" values="-1 0 33; 1 0 33; -1 0 33" repeatCount="indefinite"/>
            </g>
            
            {/* Young tree 6 */}
            <g transform="translate(650,750)">
              <ellipse cx="0" cy="28" rx="7" ry="3" fill="#00000020"/>
              <rect x="-4" y="10" width="8" height="30" fill="url(#trunkGradient)" rx="2"/>
              <circle cx="0" cy="-6" r="25" fill="url(#leafGradient)"/>
              <circle cx="-10" cy="-15" r="16" fill="#22c55e" opacity="0.8"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="6s" values="1.5 0 40; -1.5 0 40; 1.5 0 40" repeatCount="indefinite"/>
            </g>
          </g>

          {/* Decorative flowers and plants */}
          <g className="flowers">
            {/* Flower patch 1 */}
            <g transform="translate(450,400)">
              <circle cx="0" cy="0" r="4" fill="url(#flowerGradient1)"/>
              <circle cx="0" cy="0" r="2" fill="#fef3c7"/>
              <circle cx="8" cy="5" r="3" fill="url(#flowerGradient2)"/>
              <circle cx="8" cy="5" r="1.5" fill="#fce7f3"/>
              <circle cx="-5" cy="8" r="3.5" fill="url(#flowerGradient3)"/>
              <circle cx="-5" cy="8" r="1.8" fill="#dbeafe"/>
              
              {/* Gentle swaying */}
              <animateTransform attributeName="transform" type="rotate" 
                dur="4s" values="-2 0 0; 2 0 0; -2 0 0" repeatCount="indefinite"/>
            </g>
            
            {/* Flower patch 2 */}
            <g transform="translate(800,600)">
              <circle cx="0" cy="0" r="3.5" fill="url(#flowerGradient2)"/>
              <circle cx="0" cy="0" r="1.8" fill="#fce7f3"/>
              <circle cx="10" cy="-3" r="4" fill="url(#flowerGradient1)"/>
              <circle cx="10" cy="-3" r="2" fill="#fef3c7"/>
              <circle cx="-6" cy="6" r="3" fill="url(#flowerGradient3)"/>
              <circle cx="-6" cy="6" r="1.5" fill="#dbeafe"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="5s" values="2 0 0; -2 0 0; 2 0 0" repeatCount="indefinite"/>
            </g>
            
            {/* Flower patch 3 */}
            <g transform="translate(1200,250)">
              <circle cx="0" cy="0" r="4.5" fill="url(#flowerGradient3)"/>
              <circle cx="0" cy="0" r="2.2" fill="#dbeafe"/>
              <circle cx="12" cy="4" r="3.8" fill="url(#flowerGradient1)"/>
              <circle cx="12" cy="4" r="1.9" fill="#fef3c7"/>
              <circle cx="-8" cy="7" r="3.2" fill="url(#flowerGradient2)"/>
              <circle cx="-8" cy="7" r="1.6" fill="#fce7f3"/>
              
              <animateTransform attributeName="transform" type="rotate" 
                dur="3.5s" values="-1.5 0 0; 1.5 0 0; -1.5 0 0" repeatCount="indefinite"/>
            </g>
            
            {/* Small scattered flowers */}
            <circle cx="320" cy="450" r="2" fill="url(#flowerGradient1)"/>
            <circle cx="320" cy="450" r="1" fill="#fef3c7"/>
            
            <circle cx="1350" cy="550" r="2.5" fill="url(#flowerGradient2)"/>
            <circle cx="1350" cy="550" r="1.2" fill="#fce7f3"/>
            
            <circle cx="750" cy="150" r="2.2" fill="url(#flowerGradient3)"/>
            <circle cx="750" cy="150" r="1.1" fill="#dbeafe"/>
            
            <circle cx="1600" cy="700" r="1.8" fill="url(#flowerGradient1)"/>
            <circle cx="1600" cy="700" r="0.9" fill="#fef3c7"/>
          </g>

          {/* Decorative bushes */}
          <g className="bushes">
            <g transform="translate(600,350)">
              <ellipse cx="0" cy="8" rx="8" ry="3" fill="#00000020"/>
              <circle cx="0" cy="0" r="15" fill="#16a34a" opacity="0.9"/>
              <circle cx="-6" cy="-3" r="10" fill="#22c55e" opacity="0.8"/>
              <circle cx="8" cy="-2" r="12" fill="#10b981" opacity="0.7"/>
              
              <animateTransform attributeName="transform" type="scale" 
                dur="6s" values="1,1; 1.02,0.98; 1,1" repeatCount="indefinite"/>
            </g>
            
            <g transform="translate(1100,650)">
              <ellipse cx="0" cy="6" rx="6" ry="2" fill="#00000020"/>
              <circle cx="0" cy="0" r="12" fill="#16a34a" opacity="0.9"/>
              <circle cx="-4" cy="-2" r="8" fill="#22c55e" opacity="0.8"/>
              <circle cx="6" cy="-1" r="9" fill="#10b981" opacity="0.7"/>
              
              <animateTransform attributeName="transform" type="scale" 
                dur="8s" values="1,1; 1.01,0.99; 1,1" repeatCount="indefinite"/>
            </g>
          </g>

          {/* Floating magical effects */}
          <g className="magical-effects">
            {/* Floating light orbs */}
            <circle cx="150" cy="200" r="4" fill="#fbbf24" opacity="0.7">
              <animateTransform attributeName="transform" type="translate" 
                dur="12s" values="0,0; 20,-30; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0.3;0.7" dur="3s" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="800" cy="300" r="3" fill="#60a5fa" opacity="0.6">
              <animateTransform attributeName="transform" type="translate" 
                dur="15s" values="0,0; -25,-40; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="4s" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="1200" cy="400" r="3.5" fill="#34d399" opacity="0.8">
              <animateTransform attributeName="transform" type="translate" 
                dur="10s" values="0,0; 15,-35; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2.5s" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="400" cy="650" r="2.5" fill="#ec4899" opacity="0.5">
              <animateTransform attributeName="transform" type="translate" 
                dur="14s" values="0,0; -18,-28; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3.5s" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="1500" cy="180" r="4.5" fill="#f59e0b" opacity="0.6">
              <animateTransform attributeName="transform" type="translate" 
                dur="11s" values="0,0; 22,-32; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="4.5s" repeatCount="indefinite"/>
            </circle>
            
            {/* Floating bubbles */}
            <circle cx="600" cy="500" r="6" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.4">
              <animateTransform attributeName="transform" type="translate" 
                dur="20s" values="0,0; 40,-80; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="5s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="scale" 
                dur="6s" values="1; 1.3; 1" repeatCount="indefinite" additive="sum"/>
            </circle>
            
            <circle cx="1000" cy="300" r="8" fill="none" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.3">
              <animateTransform attributeName="transform" type="translate" 
                dur="25s" values="0,0; -35,-90; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.3;0.05;0.3" dur="6s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="scale" 
                dur="8s" values="1; 1.5; 1" repeatCount="indefinite" additive="sum"/>
            </circle>
            
            <circle cx="300" cy="750" r="5" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.5">
              <animateTransform attributeName="transform" type="translate" 
                dur="18s" values="0,0; 30,-70; 0,0" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="scale" 
                dur="7s" values="1; 1.4; 1" repeatCount="indefinite" additive="sum"/>
            </circle>
            
            {/* Sparkling dust */}
            <circle cx="700" cy="250" r="1" fill="#fde047" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="translate" 
                dur="8s" values="0,0; 10,-20; 0,0" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="1300" cy="600" r="1.5" fill="#a78bfa" opacity="0.7">
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.5s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="translate" 
                dur="9s" values="0,0; -12,-25; 0,0" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="200" cy="450" r="1.2" fill="#fb7185" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="translate" 
                dur="7s" values="0,0; 8,-18; 0,0" repeatCount="indefinite"/>
            </circle>
          </g>

          {/* Maze walls with enhanced styling */}
          {questionSpots.map((spot) => {
            const isAnswered = playerProgress.answered.includes(spot.id);
            const spotX = (spot.x / MAP_WIDTH) * MAP_WIDTH;
            const spotY = (spot.y / MAP_HEIGHT) * MAP_HEIGHT;
            
            return (
              <g key={spot.id} className="question-spot">
                {/* Outer glow ring */}
                <circle
                  cx={spotX}
                  cy={spotY}
                  r={48}
                  fill={isAnswered ? "#10b981" : "#3b82f6"}
                  opacity="0.15"
                  filter="url(#questionGlow)"
                />
                
                {/* Main question circle */}
                <circle
                  cx={spotX}
                  cy={spotY}
                  r={32}
                  fill={isAnswered ? "#10b981" : "#3b82f6"}
                  stroke="#ffffff"
                  strokeWidth="5"
                  className="cursor-pointer"
                />
                
                {/* Inner highlight */}
                <circle
                  cx={spotX}
                  cy={spotY}
                  r={26}
                  fill={isAnswered ? "#34d399" : "#60a5fa"}
                  opacity="0.9"
                  className="cursor-pointer"
                />
                
                {/* Question icon or checkmark */}
                <text
                  x={spotX}
                  y={spotY + 10}
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="bold"
                  fill="white"
                  className="cursor-pointer select-none"
                >
                  {isAnswered ? "✓" : "?"}
                </text>
                
                {/* Floating sparkle for unanswered questions */}
                {!isAnswered && (
                  <>
                    <circle cx={spotX - 15} cy={spotY - 45} r="2" fill="#fbbf24" opacity="0.8">
                      <animateTransform attributeName="transform" type="translate" 
                        dur="3s" values="0,0; 5,-8; 0,0" repeatCount="indefinite"/>
                    </circle>
                    <circle cx={spotX + 18} cy={spotY - 40} r="1.5" fill="#f59e0b" opacity="0.9">
                      <animateTransform attributeName="transform" type="translate" 
                        dur="2.5s" values="0,0; -3,-6; 0,0" repeatCount="indefinite"/>
                    </circle>
                  </>
                )}
              </g>
            );
          })}

          {/* Other Players with enhanced design */}
          {Object.values(otherPlayers).map((player) => {
            const playerX = (player.x / MAP_WIDTH) * MAP_WIDTH;
            const playerY = (player.y / MAP_HEIGHT) * MAP_HEIGHT;
            
            return (
              <g key={player.playerId} className="other-player character-bob">
                {/* Player shadow with depth */}
                <ellipse cx={playerX} cy={playerY + 28} rx="20" ry="12" fill="url(#shadowGradient)" opacity="0.35"/>
                
                {/* Subtle glow effect */}
                <circle cx={playerX} cy={playerY} r="30" fill="#8b5cf6" opacity="0.1" className="glow-pulse"/>
                
                {/* Player body with enhanced styling */}
                <circle cx={playerX} cy={playerY} r="24" fill="url(#otherPlayerOutlineGradient)" 
                        stroke="#ffffff" strokeWidth="2.5" filter="url(#dropShadow)"/>
                <circle cx={playerX} cy={playerY} r="21" fill="url(#otherPlayerBodyGradient)" 
                        stroke="url(#bodyBorderGradient)" strokeWidth="1.5"/>
                
                {/* Player face with better lighting */}
                <circle cx={playerX} cy={playerY - 6} r="16" fill="url(#otherFaceGradient)" 
                        stroke="url(#faceBorderGradient)" strokeWidth="1.5" filter="url(#faceShadow)"/>
                
                {/* Enhanced eyes */}
                <g className="eyes">
                  <circle cx={playerX - 6} cy={playerY - 10} r="3.5" fill="#1f2937"/>
                  <circle cx={playerX + 6} cy={playerY - 10} r="3.5" fill="#1f2937"/>
                  <circle cx={playerX - 5} cy={playerY - 11} r="1.8" fill="#ffffff"/>
                  <circle cx={playerX + 7} cy={playerY - 11} r="1.8" fill="#ffffff"/>
                  <circle cx={playerX - 4} cy={playerY - 12} r="0.6" fill="#34d399"/>
                  <circle cx={playerX + 8} cy={playerY - 12} r="0.6" fill="#34d399"/>
                </g>
                
                {/* Enhanced smile */}
                <path d={`M ${playerX - 6} ${playerY + 1} Q ${playerX} ${playerY + 4} ${playerX + 6} ${playerY + 1}`} 
                      stroke="#dc2626" strokeWidth="2" fill="#fef2f2" strokeLinecap="round"/>
                
                {/* Enhanced accessory */}
                <g className="controller-badge">
                  <rect x={playerX - 8} y={playerY + 10} width="16" height="10" 
                        fill="url(#controllerGradient)" stroke="#065f46" strokeWidth="1.2" rx="3"/>
                  <circle cx={playerX - 4} cy={playerY + 14} r="1.5" fill="#ffffff" opacity="0.9"/>
                  <circle cx={playerX + 4} cy={playerY + 14} r="1.5" fill="#ffffff" opacity="0.9"/>
                  <rect x={playerX - 1.5} y={playerY + 12.5} width="3" height="1" fill="#10b981"/>
                </g>
                
                {/* Floating sparkle */}
                <circle cx={playerX + 18} cy={playerY - 15} r="1.2" fill="#f59e0b" opacity="0.8">
                  <animateTransform attributeName="transform" type="translate" 
                    dur="3.5s" values="0,0; -5,-8; 0,0" repeatCount="indefinite"/>
                </circle>
                
                {/* Player name tag with premium styling */}
                <g className="name-tag">
                  <rect x={playerX - 40} y={playerY - 80} width="80" height="32" 
                        fill="url(#otherNameTagGradient)" stroke="url(#nameTagBorderGradient)" 
                        strokeWidth="2" rx="16" opacity="0.95" filter="url(#nameTagShadow)"/>
                  <text x={playerX} y={playerY - 60} textAnchor="middle" fontSize="13" 
                        fontWeight="bold" fill="#ffffff" filter="url(#textShadow)">
                    {player.name || 'Player'}
                  </text>
                  <text x={playerX} y={playerY - 48} textAnchor="middle" fontSize="10" 
                        fontWeight="bold" fill="#34d399">🎮 Challenger</text>
                </g>
              </g>
            );
          })}

          {/* Current Player with enhanced game-like design */}
          <g className={`current-player ${isMoving ? 'character-bob character-pulse' : 'character-pulse'}`}>
            {/* Player shadow with motion blur */}
            <ellipse cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={((position.y / MAP_HEIGHT) * MAP_HEIGHT) + 35} 
                     rx="28" ry="15" fill="url(#shadowGradient)" opacity={isMoving ? "0.6" : "0.4"}>
              {isMoving && (
                <animateTransform attributeName="transform" type="scale" 
                  dur="0.6s" values="1,1; 1.1,0.9; 1,1" repeatCount="indefinite"/>
              )}
            </ellipse>
            
            {/* Multi-layered glow effect */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} 
                    r="40" fill="#6366f1" opacity={isMoving ? "0.2" : "0.1"} className="glow-pulse" filter="url(#playerGlow)"/>
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} 
                    r="35" fill="#8b5cf6" opacity={isMoving ? "0.25" : "0.15"} className="glow-pulse" filter="url(#playerGlow)"/>
            
            {/* Outer ring animation - faster when moving */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} 
                    r="38" fill="none" stroke="url(#rainbowGradient)" strokeWidth="2" strokeDasharray="8,8" opacity="0.7">
              <animateTransform attributeName="transform" type="rotate" 
                dur={isMoving ? "2s" : "4s"} values="0;360" repeatCount="indefinite"/>
            </circle>
            
            {/* Player body outline with premium styling */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} r="30" 
                    fill="url(#bodyOutlineGradient)" stroke="#ffffff" strokeWidth="4" filter="url(#dropShadow)">
              {isMoving && (
                <animateTransform attributeName="transform" type="scale" 
                  dur="0.4s" values="1; 1.02; 1" repeatCount="indefinite"/>
              )}
            </circle>
            
            {/* Player main body with enhanced gradient */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} r="26" 
                    fill="url(#playerBodyGradient)" stroke="url(#bodyBorderGradient)" strokeWidth="2"/>
            
            {/* Character face background with better lighting */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 8} r="20" 
                    fill="url(#faceGradient)" stroke="url(#faceBorderGradient)" strokeWidth="2" filter="url(#faceShadow)"/>
            
            {/* Enhanced character eyes with reflections */}
            <g className={`eyes ${isMoving ? 'character-bob' : ''}`}>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 12} r="4" fill="#1f2937"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 12} r="4" fill="#1f2937"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 6} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 13} r="2" fill="#ffffff"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 8} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 13} r="2" fill="#ffffff"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 5} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 14} r="0.8" fill="#60a5fa"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 9} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 14} r="0.8" fill="#60a5fa"/>
              {/* Blinking animation */}
              {isMoving && (
                <>
                  <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 12} 
                          r="4" fill="#1f2937" opacity="0">
                    <animate attributeName="opacity" values="0;0;1;0;0" dur="3s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 12} 
                          r="4" fill="#1f2937" opacity="0">
                    <animate attributeName="opacity" values="0;0;1;0;0" dur="3s" repeatCount="indefinite"/>
                  </circle>
                </>
              )}
            </g>
            
            {/* Enhanced character smile */}
            <path d={`M ${(position.x / MAP_WIDTH) * MAP_WIDTH - 8} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 2} 
                     Q ${(position.x / MAP_WIDTH) * MAP_WIDTH} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT + 3} 
                     ${(position.x / MAP_WIDTH) * MAP_WIDTH + 8} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 2}`} 
                  stroke="#dc2626" strokeWidth="2.5" fill="#fef2f2" strokeLinecap="round"/>
            
            {/* Character accessories - enhanced game controller badge */}
            <g className={`controller-badge ${isMoving ? 'character-pulse' : 'character-pulse'}`}>
              <rect x={(position.x / MAP_WIDTH) * MAP_WIDTH - 10} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 14} 
                    width="20" height="12" fill="url(#controllerGradient)" stroke="#065f46" strokeWidth="1.5" rx="4"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 5} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 19} 
                      r="2" fill="#ffffff" opacity="0.9">
                {isMoving && (
                  <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.5s" repeatCount="indefinite"/>
                )}
              </circle>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 5} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 19} 
                      r="2" fill="#ffffff" opacity="0.9">
                {isMoving && (
                  <animate attributeName="opacity" values="0.5;0.9;0.5" dur="0.5s" repeatCount="indefinite"/>
                )}
              </circle>
              <rect x={(position.x / MAP_WIDTH) * MAP_WIDTH - 2} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 17} 
                    width="4" height="1" fill="#10b981"/>
            </g>
            
            {/* Floating sparkle effects */}
            <g className={`sparkles ${isMoving ? 'sparkle-rotate' : ''}`}>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 25} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 20} 
                      r="2" fill="#fbbf24">
                <animateTransform attributeName="transform" type="translate" 
                  dur={isMoving ? "2s" : "3s"} values="0,0; 8,-12; 0,0" repeatCount="indefinite"/>
              </circle>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 28} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 15} 
                      r="1.5" fill="#f59e0b">
                <animateTransform attributeName="transform" type="translate" 
                  dur={isMoving ? "1.8s" : "2.8s"} values="0,0; -6,-10; 0,0" repeatCount="indefinite"/>
              </circle>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 15} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 25} 
                      r="1" fill="#60a5fa">
                <animateTransform attributeName="transform" type="translate" 
                  dur={isMoving ? "2.2s" : "3.2s"} values="0,0; -4,8; 0,0" repeatCount="indefinite"/>
              </circle>
              {/* Extra sparkles when moving */}
              {isMoving && (
                <>
                  <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 35} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 10} 
                          r="1" fill="#34d399">
                    <animateTransform attributeName="transform" type="translate" 
                      dur="1.5s" values="0,0; 6,-15; 0,0" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 35} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT + 5} 
                          r="1.2" fill="#ec4899">
                    <animateTransform attributeName="transform" type="translate" 
                      dur="1.7s" values="0,0; -8,-12; 0,0" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0;1;0" dur="1.7s" repeatCount="indefinite"/>
                  </circle>
                </>
              )}
            </g>
            
            {/* Enhanced crown with premium styling */}
            <g className="crown character-pulse">
              <polygon points={`${(position.x / MAP_WIDTH) * MAP_WIDTH - 16},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 42} 
                               ${(position.x / MAP_WIDTH) * MAP_WIDTH - 8},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 54} 
                               ${(position.x / MAP_WIDTH) * MAP_WIDTH},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 48} 
                               ${(position.x / MAP_WIDTH) * MAP_WIDTH + 8},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 54} 
                               ${(position.x / MAP_WIDTH) * MAP_WIDTH + 16},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 42}`} 
                       fill="url(#crownGradient)" stroke="url(#crownBorderGradient)" strokeWidth="2" filter="url(#dropShadow)"/>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 46} 
                      r="3" fill="#dc2626">
                <animate attributeName="fill" values="#dc2626;#ef4444;#dc2626" dur={isMoving ? "1s" : "2s"} repeatCount="indefinite"/>
              </circle>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 8} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 48} 
                      r="2" fill="#3b82f6">
                <animate attributeName="fill" values="#3b82f6;#60a5fa;#3b82f6" dur={isMoving ? "1.2s" : "2.5s"} repeatCount="indefinite"/>
              </circle>
              <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 8} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 48} 
                      r="2" fill="#10b981">
                <animate attributeName="fill" values="#10b981;#34d399;#10b981" dur={isMoving ? "1.1s" : "2.2s"} repeatCount="indefinite"/>
              </circle>
            </g>
            
            {/* Enhanced name tag with premium styling */}
            <g className="name-tag">
              <rect x={(position.x / MAP_WIDTH) * MAP_WIDTH - 52} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 120} 
                    width="104" height="42" fill="url(#nameTagGradient)" stroke="url(#nameTagBorderGradient)" 
                    strokeWidth="3" rx="21" filter="url(#nameTagShadow)" opacity="0.98"/>
              <text x={(position.x / MAP_WIDTH) * MAP_WIDTH} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 94} 
                    textAnchor="middle" fontSize="15" fontWeight="bold" fill="#ffffff" filter="url(#textShadow)">
                {playerName}
              </text>
              <text x={(position.x / MAP_WIDTH) * MAP_WIDTH} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 80} 
                    textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fbbf24">
                ⭐ {isMoving ? 'Moving Master' : 'Master Player'} ⭐
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* Beautiful Question Modal */}
      {showQuestionModal && currentQuestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4 transform animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-2xl">❓</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    คำถาม
                  </h3>
                  <p className="text-sm text-gray-500">เลือกคำตอบที่ถูกต้อง • ข้อนี้ {currentQuestion.points ?? 100} แต้ม</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-xl text-sm font-extrabold border ${timeUp ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  ⏱️ {typeof timeLeft === 'number' ? timeLeft : Math.max(1, Math.floor(Number(timePerQuestion) || 30))}s
                </div>
                <button 
                  onClick={closeQuestionModal}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 transform hover:scale-105"
                >
                  ✕
                </button>
              </div>
            </div>

            {timeUp && (
              <div className="mb-4 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
                หมดเวลา! ข้อนี้นับว่าตอบผิด
              </div>
            )}
            
            {/* Question Text */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-6 border border-blue-100">
              <p className="text-lg text-gray-800 font-medium leading-relaxed">{currentQuestion.text}</p>
            </div>
            
            {/* Answer Choices */}
            <div className="space-y-3">
              {currentQuestion.choices.map((choice, index) => {
                const choiceLabels = ['A', 'B', 'C', 'D'];
                const colors = [
                  'from-red-400 to-red-500 hover:from-red-500 hover:to-red-600',
                  'from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600', 
                  'from-green-400 to-green-500 hover:from-green-500 hover:to-green-600',
                  'from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600'
                ];

                const colorClass = timeUp
                  ? 'from-red-500 to-red-600'
                  : colors[index];
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerQuestion(index)}
                    disabled={timeUp}
                    className={`w-full p-4 text-left bg-gradient-to-r ${colorClass} text-white rounded-xl transition-all duration-200 font-medium flex items-center space-x-4 ${timeUp ? 'opacity-90 cursor-not-allowed' : 'transform hover:scale-[1.02] hover:shadow-lg'}`}
                  >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">
                      {choiceLabels[index]}
                    </div>
                    <span className="flex-1">{choice}</span>
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                      →
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">💡 คลิกที่คำตอบที่คิดว่าถูกต้อง</p>
            </div>
          </div>
        </div>
      )}

      {/* Game Results Modal */}
      {gameCompleted && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 transform animate-slideUp">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                <span className="text-3xl">🏆</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">เกมจบแล้ว!</h2>
              <p className="text-gray-600">คุณตอบคำถามครบทุกข้อแล้ว</p>
            </div>

            {/* Results Summary */}
            <div className="space-y-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">🎯</span>
                  </div>
                  <span className="font-medium text-blue-700">คะแนนรวม</span>
                </div>
                <span className="text-2xl font-bold text-blue-700">{playerProgress.score}</span>
              </div>

              {/* Removed time used section */}

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">✅</span>
                  </div>
                  <span className="font-medium text-purple-700">คำถามที่ตอบ</span>
                </div>
                <span className="text-xl font-bold text-purple-700">{playerProgress.answered.length}/{totalQuestions || 5}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRankings(true)}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🏆 ดูอันดับ
              </button>
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
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🏠 กลับห้อง
              </button>
              <button
                onClick={() => {
                  // Reset game state for new game
                  setGameCompleted(false);
                  setPlayerProgress({ answered: [], score: 0 });
                  setGameStartTime(null);
                  setGameEndTime(null);
                  // removed elapsed time reset
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🎮 เล่นใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rankings Modal */}
      {showRankings && gameResults && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto transform animate-slideUp">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                <span className="text-3xl">🏆</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">🎉 อันดับคะแนน</h2>
              <p className="text-gray-600">ผลการแข่งขันในห้อง {roomId}</p>
            </div>

            {/* Rankings List */}
            <div className="space-y-3 mb-6">
              {gameResults.rankings && gameResults.rankings.map((result, index) => {
                const isCurrentPlayer = result.playerId === socketManager.getPlayerId();
                const rankColors = [
                  'from-yellow-400 to-yellow-500', // 1st place - Gold
                  'from-gray-300 to-gray-400',     // 2nd place - Silver  
                  'from-orange-400 to-orange-500', // 3rd place - Bronze
                ];
                const rankEmojis = ['🥇', '🥈', '🥉'];
                
                return (
                  <div
                    key={`${result.playerId}-${result.timestamp ?? index}`}
                    className={`relative p-4 rounded-2xl shadow-lg transition-all duration-300 ${
                      isCurrentPlayer 
                        ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 transform scale-105'
                        : 'bg-gradient-to-r from-gray-50 to-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 bg-gradient-to-br ${
                          result.rank <= 3 ? rankColors[result.rank - 1] : 'from-gray-400 to-gray-500'
                        } rounded-xl flex items-center justify-center shadow-lg`}>
                          <span className="text-white text-xl font-bold">
                            {result.rank <= 3 ? rankEmojis[result.rank - 1] : result.rank}
                          </span>
                        </div>
                        
                        {/* Player Info */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${
                              isCurrentPlayer ? 'text-blue-700' : 'text-gray-800'
                            }`}>
                              {result.playerName}
                            </span>
                            {isCurrentPlayer && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                คุณ
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {result.questionsAnswered}/{totalQuestions || 5} คำถาม
                          </div>
                        </div>
                      </div>

                      {/* Score and Time */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {result.finalScore} แต้ม
                        </div>
                        <div className="text-sm text-gray-600">
                          ใช้เวลา: {Number.isFinite(result?.completionTime) ? (Number(result.completionTime) / 1000).toFixed(1) : '—'} วินาที
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Player Highlight */}
                    {isCurrentPlayer && (
                      <div className="absolute -top-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRankings(false);
                  setGameResults(null);
                }}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                ❌ ปิด
              </button>
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
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🏠 กลับห้อง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Controls Hint (non-blocking, beautified, collapsible) */}
      {hintCollapsed ? (
        <button
          onClick={() => setHintCollapsed(false)}
          className="absolute bottom-6 right-6 z-20 pointer-events-auto bg-white/90 backdrop-blur-xl rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-white/40 px-4 py-2 flex items-center gap-2 hover:shadow-[0_12px_36px_rgba(0,0,0,0.22)]"
          title="แสดงวิธีควบคุม"
        >
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center">🎮</span>
          <span className="text-sm text-gray-700">แสดงวิธีควบคุม</span>
        </button>
      ) : (
        <>
          {/* Card (non-blocking) */}
          <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-white/30 p-4 min-w-[240px]">
              {/* Header */}
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow mr-2">🎮</div>
                <div className="font-semibold text-gray-800">วิธีควบคุม</div>
              </div>
              {/* Accent divider */}
              <div className="h-1 w-full rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 mb-3 opacity-40" />
              {/* Items */}
              <div className="text-sm text-gray-700 space-y-2">
                <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50/80 to-blue-100/50 rounded-xl px-3 py-2 border border-blue-100">
                  <span className="w-7 h-7 rounded-lg bg-blue-200/70 text-blue-800 flex items-center justify-center shadow-inner">🖱️</span>
                  <span className="font-medium">Click เพื่อเดิน</span>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50/80 to-emerald-100/50 rounded-xl px-3 py-2 border border-emerald-100">
                  <span className="w-7 h-7 rounded-lg bg-emerald-200/70 text-emerald-800 flex items-center justify-center shadow-inner">⌨️</span>
                  <span className="font-medium">WASD/Arrow keys เพื่อเดิน</span>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-fuchsia-50/80 to-fuchsia-100/50 rounded-xl px-3 py-2 border border-fuchsia-100">
                  <span className="w-7 h-7 rounded-lg bg-fuchsia-200/70 text-fuchsia-800 flex items-center justify-center shadow-inner">❓</span>
                  <span className="font-medium">เดินไปใกล้ ? เพื่อตอบคำถาม</span>
                </div>
              </div>
            </div>
          </div>
          {/* Close button overlay (clickable) */}
          <button
            onClick={() => setHintCollapsed(true)}
            className="absolute bottom-6 right-6 z-20 pointer-events-auto w-8 h-8 rounded-xl bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow border border-white/60 translate-x-[-8px] -translate-y-[140px]"
            title="ซ่อนวิธีควบคุม"
          >
            ✕
          </button>
        </>
      )}

      {/* On-screen WASD control pad (mobile friendly). Buttons are clickable; container stays non-blocking. */}
      <div className="absolute bottom-6 left-6 z-20 select-none">
        <div className="pointer-events-none">
          <div className="grid grid-cols-3 gap-2">
            <div />
            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(0, -KEY_STEP)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(0, -KEY_STEP); }}
              onTouchEnd={stopHold}
              title="เดินหน้า (W)"
            >W</button>
            <div />

            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(-KEY_STEP, 0)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(-KEY_STEP, 0); }}
              onTouchEnd={stopHold}
              title="ซ้าย (A)"
            >A</button>
            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(0, KEY_STEP)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(0, KEY_STEP); }}
              onTouchEnd={stopHold}
              title="ถอยหลัง (S)"
            >S</button>
            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(KEY_STEP, 0)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(KEY_STEP, 0); }}
              onTouchEnd={stopHold}
              title="ขวา (D)"
            >D</button>
          </div>
        </div>
      </div>
    </div>
  );
}