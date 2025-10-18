"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from '../lib/socket';

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
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  
  .animate-slideUp {
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  const [playerName, setPlayerName] = useState(() => searchParams.get('playerName') || `Player_${Math.floor(Math.random()*1000)}`);
  // Allow explicit playerId via URL so teacher can open a student link that joins as that player
  const [providedPlayerId] = useState(() => searchParams.get('playerId') || null);
  // Role from query (default student). Used to filter visibility of teacher avatar
  const role = searchParams.get('role') || 'student';
  const [isConnected, setIsConnected] = useState(false);
  
  // Avatar position (in pixels)
  const [position, setPosition] = useState({ x: 400, y: 300 });
  const [otherPlayers, setOtherPlayers] = useState({});
  
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
  
  const MOVE_SPEED = 3;
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 800;
  
  // Question state - will be loaded from API
  const [questionSpots, setQuestionSpots] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const totalQuestions = questionSpots.length;

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

  // Socket connection
  useEffect(() => {
    let gotRoomState = false;
    if (roomId && playerName) {
      socketManager.connect();
      
      socketManager.on('connected', () => {
        // Join with explicit role so backend tracks teacher/student
        const success = socketManager.joinRoom(roomId, playerName, role, providedPlayerId);
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

      // Also handle disconnects that follow a kick or server disconnects
      socketManager.on('disconnected', (info) => {
        const reason = info?.reason || '';
        const wasKicked = !!info?.wasKicked;
        // Redirect if we know we were kicked, or if server forcibly disconnected us
        if (wasKicked || reason === 'io server disconnect' || reason === 'transport close') {
          redirectToLobby();
        }
      });

      // Fallback: if within 2 seconds we are not connected and no roomState came (e.g., banned join), redirect
      const failSafe = setTimeout(() => {
        try {
          const kickedFlag = window.sessionStorage.getItem(`qq:kicked:${roomId}`) === '1';
          if (kickedFlag || !socketManager.isSocketConnected() || !gotRoomState) {
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
  }, [roomId, playerName, role, providedPlayerId]);

  // Failsafe: Poll room status and force leave if not active
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
    moveHoldRef.current = setInterval(() => stepBy(dx, dy), 120);
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
          e.preventDefault(); stepBy(0, -40); break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault(); stepBy(0, 40); break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault(); stepBy(-40, 0); break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault(); stepBy(40, 0); break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepBy, showQuestionModal, gameStarted]);

  // Movement animation loop
  useEffect(() => {
    const animate = () => {
      const target = targetPositionRef.current;
      setPosition(currentPos => {
        const dx = target.x - currentPos.x;
        const dy = target.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) {
          return target; // arrived
        }
        
        const stepSize = Math.min(MOVE_SPEED, distance);
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

  const handleAnswerQuestion = (selectedIndex) => {
    if (!currentQuestion) return;
    
  const correct = selectedIndex === currentQuestion.answerIndex;
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
      
      // Send game completion to server
      if (isConnected) {
        const elapsed = gameStartTime ? Math.max(0, endTime - gameStartTime) : 0;
        socketManager.completeGame(newScore, elapsed, newAnswered.length);
      }
    }
    
    // Send answer to server
    if (isConnected) {
      socketManager.answerQuestion(currentQuestion.id, selectedIndex, correct, earned);
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
            <div className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่เชื่อมต่อ'}
            </div>
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
      
      {/* Stylish Game HUD (non-blocking) with collapse/expand */}
      <div className="absolute top-6 left-6 z-20">
        {hudCollapsed ? (
          <button
            onClick={() => setHudCollapsed(false)}
            className="pointer-events-auto bg-white/85 backdrop-blur-xl rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-white/40 px-4 py-2 flex items-center gap-2 hover:shadow-[0_12px_36px_rgba(0,0,0,0.22)] transition-shadow"
            title="แสดง HUD"
          >
            <span className="text-xl">👤</span>
            <span className="text-sm text-gray-700 max-w-[140px] truncate">{playerName}</span>
            <span className="text-xs text-blue-700 font-semibold">{playerProgress.score}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-green-700 font-semibold">{playerProgress.answered.length}/{totalQuestions || 5}</span>
          </button>
        ) : (
          <>
            {/* Toggle row */}
            <div className="flex mb-2">
              <button
                onClick={() => setHudCollapsed(true)}
                className="pointer-events-auto w-8 h-8 rounded-xl bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow border border-white/60"
                title="ซ่อน HUD"
              >
                –
              </button>
            </div>
            {/* HUD Card - non-blocking */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-white/30 p-4 min-w-[280px] pointer-events-none">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                  <span className="text-white text-xl">👤</span>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-800">{playerName}</div>
                  <div className="text-sm text-gray-500">Room: {roomId}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 text-center border border-blue-100">
                  <div className="text-xs text-blue-600 font-semibold">Score</div>
                  <div className="text-lg font-bold text-blue-700">{playerProgress.score}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-2 text-center border border-green-100">
                  <div className="text-xs text-green-600 font-semibold">Progress</div>
                  <div className="text-lg font-bold text-green-700">{playerProgress.answered.length}/{totalQuestions || 5}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 mb-3 place-items-center">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-2 text-center">
                  <div className="text-xs text-purple-600 font-semibold">Status</div>
                  <div className="text-lg">{gameStarted ? '🎮' : '⏳'}</div>
                </div>
              </div>

              <div className="mb-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round(((playerProgress.answered.length || 0) / Math.max(1, totalQuestions || 5)) * 100))}%` }}
                />
              </div>

              <div className={`text-xs px-3 py-2 rounded-xl text-center font-semibold shadow border ${
                isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
              }`}>
                {isConnected ? '🟢 เชื่อมต่อแล้ว' : '🔴 การเชื่อมต่อขาด'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Beautiful Game Canvas with SVG */}
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
          style={{ width: '100%', height: '100%' }}
        >
          {/* Define patterns and effects */}
          <defs>
            {/* Grass texture */}
            <pattern id="grassTexture" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="#4ade80"/>
              <circle cx="15" cy="15" r="2" fill="#22c55e" opacity="0.6"/>
              <circle cx="45" cy="30" r="1.5" fill="#16a34a" opacity="0.8"/>
              <circle cx="30" cy="50" r="1" fill="#22c55e" opacity="0.7"/>
              <circle cx="10" cy="45" r="1.5" fill="#16a34a" opacity="0.6"/>
            </pattern>

            {/* Wall gradient */}
            <linearGradient id="wallGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#6366f1', stopOpacity:1}} />
              <stop offset="50%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#a855f7', stopOpacity:1}} />
            </linearGradient>

            {/* Tree gradients */}
            <radialGradient id="leafGradient" cx="50%" cy="30%" r="70%">
              <stop offset="0%" style={{stopColor:'#34d399', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#10b981', stopOpacity:1}} />
            </radialGradient>

            {/* Question glow effect */}
            <filter id="questionGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Player glow */}
            <filter id="playerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Beautiful grass background */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grassTexture)" />
          
          {/* Maze walls - creating a beautiful maze layout */}
          {/* Outer boundary walls */}
          <rect x="0" y="0" width={MAP_WIDTH} height="30" fill="url(#wallGradient)" rx="15"/>
          <rect x="0" y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradient)" rx="15"/>
          <rect x={MAP_WIDTH-30} y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradient)" rx="15"/>
          <rect x="0" y={MAP_HEIGHT-30} width={MAP_WIDTH} height="30" fill="url(#wallGradient)" rx="15"/>
          
          {/* Inner maze walls - creating interesting paths */}
          <rect x="120" y="80" width="300" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="500" y="120" width="25" height="250" fill="url(#wallGradient)" rx="12"/>
          <rect x="650" y="60" width="200" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="200" y="320" width="350" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="750" y="200" width="25" height="180" fill="url(#wallGradient)" rx="12"/>
          <rect x="100" y="480" width="25" height="250" fill="url(#wallGradient)" rx="12"/>
          <rect x="400" y="450" width="250" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="850" y="350" width="120" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="300" y="600" width="200" height="25" fill="url(#wallGradient)" rx="12"/>
          <rect x="680" y="520" width="25" height="150" fill="url(#wallGradient)" rx="12"/>
          
          {/* Beautiful decorative trees */}
          <g className="trees">
            {/* Large tree 1 */}
            <g transform="translate(380,280)">
              <ellipse cx="0" cy="35" rx="8" ry="4" fill="#00000020"/>
              <rect x="-6" y="15" width="12" height="40" fill="#8b4513" rx="3"/>
              <circle cx="0" cy="-5" r="35" fill="url(#leafGradient)"/>
              <circle cx="-12" cy="-15" r="22" fill="#22c55e" opacity="0.8"/>
              <circle cx="15" cy="-10" r="18" fill="#16a34a" opacity="0.9"/>
              <circle cx="0" cy="-25" r="15" fill="#34d399" opacity="0.7"/>
            </g>
            
            {/* Tree 2 */}
            <g transform="translate(900,180)">
              <ellipse cx="0" cy="25" rx="6" ry="3" fill="#00000020"/>
              <rect x="-4" y="10" width="8" height="30" fill="#8b4513" rx="2"/>
              <circle cx="0" cy="-5" r="25" fill="url(#leafGradient)"/>
              <circle cx="-8" cy="-12" r="15" fill="#16a34a" opacity="0.8"/>
            </g>
            
            {/* Tree 3 */}
            <g transform="translate(280,580)">
              <ellipse cx="0" cy="40" rx="10" ry="5" fill="#00000020"/>
              <rect x="-8" y="20" width="16" height="45" fill="#8b4513" rx="4"/>
              <circle cx="0" cy="-10" r="40" fill="url(#leafGradient)"/>
              <circle cx="-15" cy="-20" r="25" fill="#22c55e" opacity="0.8"/>
              <circle cx="18" cy="-15" r="20" fill="#16a34a" opacity="0.9"/>
            </g>
            
            {/* Tree 4 */}
            <g transform="translate(1000,480)">
              <ellipse cx="0" cy="28" rx="7" ry="3" fill="#00000020"/>
              <rect x="-5" y="12" width="10" height="32" fill="#8b4513" rx="3"/>
              <circle cx="0" cy="-8" r="28" fill="url(#leafGradient)"/>
              <circle cx="-10" cy="-18" r="18" fill="#22c55e" opacity="0.8"/>
            </g>
          </g>

          {/* Beautiful Question Spots */}
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
                  r={40}
                  fill={isAnswered ? "#10b981" : "#3b82f6"}
                  opacity="0.15"
                  filter="url(#questionGlow)"
                />
                
                {/* Main question circle */}
                <circle
                  cx={spotX}
                  cy={spotY}
                  r={28}
                  fill={isAnswered ? "#10b981" : "#3b82f6"}
                  stroke="#ffffff"
                  strokeWidth="4"
                  className="cursor-pointer"
                />
                
                {/* Inner highlight */}
                <circle
                  cx={spotX}
                  cy={spotY}
                  r={22}
                  fill={isAnswered ? "#34d399" : "#60a5fa"}
                  opacity="0.9"
                  className="cursor-pointer"
                />
                
                {/* Question icon or checkmark */}
                <text
                  x={spotX}
                  y={spotY + 8}
                  textAnchor="middle"
                  fontSize="24"
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

          {/* Other Players with cute design */}
          {Object.values(otherPlayers).map((player) => {
            const playerX = (player.x / MAP_WIDTH) * MAP_WIDTH;
            const playerY = (player.y / MAP_HEIGHT) * MAP_HEIGHT;
            
            return (
              <g key={player.playerId} className="other-player">
                {/* Player shadow */}
                <ellipse cx={playerX} cy={playerY + 25} rx="15" ry="8" fill="#000000" opacity="0.2"/>
                
                {/* Player body */}
                <circle cx={playerX} cy={playerY} r="20" fill="#ff6b6b" stroke="#ffffff" strokeWidth="3"/>
                
                {/* Player face */}
                <circle cx={playerX - 6} cy={playerY - 4} r="3" fill="#ffffff"/>
                <circle cx={playerX + 6} cy={playerY - 4} r="3" fill="#ffffff"/>
                <path d={`M ${playerX - 6} ${playerY + 8} Q ${playerX} ${playerY + 12} ${playerX + 6} ${playerY + 8}`} 
                      stroke="#ffffff" strokeWidth="2.5" fill="none"/>
                
                {/* Player name tag */}
                <rect x={playerX - 30} y={playerY - 45} width="60" height="25" 
                      fill="#ffffff" stroke="#e5e7eb" strokeWidth="1" rx="12" opacity="0.95"/>
                <text x={playerX} y={playerY - 26} textAnchor="middle" fontSize="12" 
                      fontWeight="bold" fill="#374151">{player.name || 'Player'}</text>
              </g>
            );
          })}

          {/* Current Player with special design */}
          <g className="current-player">
            {/* Player shadow */}
            <ellipse cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={((position.y / MAP_HEIGHT) * MAP_HEIGHT) + 28} rx="18" ry="9" fill="#000000" opacity="0.25"/>
            
            {/* Player glow effect */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} r="25" 
                    fill="#4f46e5" opacity="0.2" filter="url(#playerGlow)"/>
            
            {/* Player body */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT} r="22" 
                    fill="#4f46e5" stroke="#ffffff" strokeWidth="4"/>
            
            {/* Player face */}
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH - 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 5} r="3.5" fill="#ffffff"/>
            <circle cx={(position.x / MAP_WIDTH) * MAP_WIDTH + 7} cy={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 5} r="3.5" fill="#ffffff"/>
            <path d={`M ${(position.x / MAP_WIDTH) * MAP_WIDTH - 7} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT + 10} Q ${(position.x / MAP_WIDTH) * MAP_WIDTH} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT + 15} ${(position.x / MAP_WIDTH) * MAP_WIDTH + 7} ${(position.y / MAP_HEIGHT) * MAP_HEIGHT + 10}`} 
                  stroke="#ffffff" strokeWidth="3" fill="none"/>
            
            {/* Crown indicator */}
            <polygon points={`${(position.x / MAP_WIDTH) * MAP_WIDTH - 10},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 30} ${(position.x / MAP_WIDTH) * MAP_WIDTH - 5},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 38} ${(position.x / MAP_WIDTH) * MAP_WIDTH},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 35} ${(position.x / MAP_WIDTH) * MAP_WIDTH + 5},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 38} ${(position.x / MAP_WIDTH) * MAP_WIDTH + 10},${(position.y / MAP_HEIGHT) * MAP_HEIGHT - 30}`} 
                     fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
            
            {/* Player name tag */}
            <rect x={(position.x / MAP_WIDTH) * MAP_WIDTH - 35} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 55} width="70" height="28" 
                  fill="#4f46e5" stroke="#ffffff" strokeWidth="2" rx="14" opacity="0.95"/>
            <text x={(position.x / MAP_WIDTH) * MAP_WIDTH} y={(position.y / MAP_HEIGHT) * MAP_HEIGHT - 35} textAnchor="middle" fontSize="13" 
                  fontWeight="bold" fill="#ffffff">{playerName} (คุณ)</text>
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
              <button 
                onClick={closeQuestionModal}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 transform hover:scale-105"
              >
                ✕
              </button>
            </div>
            
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
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerQuestion(index)}
                    className={`w-full p-4 text-left bg-gradient-to-r ${colors[index]} text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-medium flex items-center space-x-4`}
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
                onClick={() => router.push('/StudentDashboard/gameroom')}
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
                        {/* Removed per-ranking time display */}
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
                onClick={() => router.push('/StudentDashboard/gameroom')}
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
              onMouseDown={() => startHold(0, -40)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(0, -40); }}
              onTouchEnd={stopHold}
              title="เดินหน้า (W)"
            >W</button>
            <div />

            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(-40, 0)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(-40, 0); }}
              onTouchEnd={stopHold}
              title="ซ้าย (A)"
            >A</button>
            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(0, 40)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(0, 40); }}
              onTouchEnd={stopHold}
              title="ถอยหลัง (S)"
            >S</button>
            <button
              className="pointer-events-auto w-12 h-12 rounded-xl bg-white/90 hover:bg-white shadow border border-white/60 flex items-center justify-center text-gray-700 text-lg"
              onMouseDown={() => startHold(40, 0)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(40, 0); }}
              onTouchEnd={stopHold}
              title="ขวา (D)"
            >D</button>
          </div>
        </div>
      </div>
    </div>
  );
}