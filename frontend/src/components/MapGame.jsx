"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import socketManager from '../lib/socket';

export default function MapGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get room and player info from URL
  const [roomId, setRoomId] = useState(() => searchParams.get('roomId') || '');
  const [playerName, setPlayerName] = useState(() => searchParams.get('playerName') || `Player_${Math.floor(Math.random()*1000)}`);
  const [isConnected, setIsConnected] = useState(false);
  
  // Avatar position (in pixels)
  const [position, setPosition] = useState({ x: 400, y: 300 });
  const [otherPlayers, setOtherPlayers] = useState({});
  
  // Game container ref
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  // Movement state
  const keysRef = useRef(new Set());
  const targetPositionRef = useRef({ x: 400, y: 300 });
  const isMovingRef = useRef(false);
  
  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [playerProgress, setPlayerProgress] = useState({ answered: [], score: 0 });
  
  const MOVE_SPEED = 3;
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 800;
  
  // Question hotspots - แต่ละจุดมีคำถามต่างกัน
  const questionSpots = [
    { id: 'q1', x: 200, y: 150, question: { id: 'q1', text: 'What is the capital of Japan?', choices: ['Seoul', 'Tokyo', 'Beijing', 'Bangkok'], answerIndex: 1 } },
    { id: 'q2', x: 600, y: 200, question: { id: 'q2', text: 'Which planet is known as the Red Planet?', choices: ['Earth', 'Mars', 'Jupiter', 'Venus'], answerIndex: 1 } },
    { id: 'q3', x: 800, y: 400, question: { id: 'q3', text: 'What is 2 + 2?', choices: ['3', '4', '5', '6'], answerIndex: 1 } },
    { id: 'q4', x: 300, y: 500, question: { id: 'q4', text: 'Which language runs in a web browser?', choices: ['Python', 'C#', 'JavaScript', 'Rust'], answerIndex: 2 } },
    { id: 'q5', x: 900, y: 600, question: { id: 'q5', text: 'What does HTML stand for?', choices: ['Hyper Text Markup Language', 'Home Tool Markup Language', 'Hyperlinks Text Mark Language', 'Hyperlinking Text Marking Language'], answerIndex: 0 } }
  ];

  const moveToPoint = useCallback((px, py) => {
    targetRef.current = { x: px, y: py };
  }, []);

  const navigateToHotspot = useCallback((hotspot) => {
    // Navigate to /game with roomId param
    const q = `?roomId=${encodeURIComponent(hotspot.roomId)}`;
    router.push(`/game${q}`);
  }, [router]);

  // click handler
  const handleClick = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const pX = ((e.clientX - rect.left) / rect.width) * 100;
    const pY = ((e.clientY - rect.top) / rect.height) * 100;

    // check hotspots first
    for (const hs of hotspots) {
      const left = hs.x - hs.w / 2;
      const top = hs.y - hs.h / 2;
      if (pX >= left && pX <= left + hs.w && pY >= top && pY <= top + hs.h) {
        navigateToHotspot(hs);
        return;
      }
    }

    moveToPoint(pX, pY);
  };

  // touch handler (tap)
  const handleTouch = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    handleClick({ clientX: t.clientX, clientY: t.clientY });
  };

  // keyboard control
  useEffect(() => {
    const onKey = (e) => {
      const delta = 2; // percent
      if (e.key === "ArrowUp") moveToPoint(pos.x, Math.max(0, pos.y - delta));
      if (e.key === "ArrowDown") moveToPoint(pos.x, Math.min(100, pos.y + delta));
      if (e.key === "ArrowLeft") moveToPoint(Math.max(0, pos.x - delta), pos.y);
      if (e.key === "ArrowRight") moveToPoint(Math.min(100, pos.x + delta), pos.y);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos.x, pos.y, moveToPoint]);

  // movement loop
  useEffect(() => {
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; // seconds
      last = now;
      const t = targetRef.current;
      const dx = t.x - pos.x;
      const dy = t.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.2) {
        const maxStep = speed * dt;
        const ratio = Math.min(1, maxStep / dist);
        const nx = pos.x + dx * ratio;
        const ny = pos.y + dy * ratio;
        setPos({ x: nx, y: ny });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pos.x, pos.y]);

  return (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center">
      <div
        ref={containerRef}
        onClick={handleClick}
        onTouchStart={handleTouch}
        className="relative w-full max-w-6xl h-[640px] bg-green-200 rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundImage: `url('/map-bg.jpg')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* hotspots */}
        {hotspots.map((hs) => (
          <div
            key={hs.id}
            className="absolute border-2 border-red-500 bg-red-500/30 rounded-md flex items-center justify-center text-white text-xs font-bold"
            style={{
              left: `calc(${hs.x}% - ${hs.w / 2}%)`,
              top: `calc(${hs.y}% - ${hs.h / 2}%)`,
              width: `${hs.w}%`,
              height: `${hs.h}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigateToHotspot(hs);
            }}
          >
            ไปเกม
          </div>
        ))}

        {/* avatar */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-xl">😀</div>
          <div className="text-xs text-white/90 mt-1 font-semibold">{avatarLabel}</div>
        </div>

        {/* small HUD */}
        <div className="absolute top-4 left-4 space-y-2">
          <div className="bg-white/10 text-white px-3 py-2 rounded-lg shadow">เมนู</div>
          <div className="bg-white/10 text-white px-3 py-2 rounded-lg shadow">ข้อมูล</div>
        </div>

        {/* legend */}
        <div className="absolute bottom-4 right-4 bg-white/10 px-3 py-2 rounded-lg text-white text-sm">แตะเพื่อเคลื่อน / ปุ่มลูกศร</div>
      </div>
    </div>
  );
}
