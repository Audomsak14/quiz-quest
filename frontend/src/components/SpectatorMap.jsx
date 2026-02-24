"use client";
import React, { useMemo } from "react";

// Read-only live map for teachers to spectate students
// Props:
// - roomId: string
// - players: { [playerId]: { name, x, y, role } }
// - questions: Array<{ id, x, y, question: { id, text, choices, answerIndex, points } }>
// - selectedPlayerId: string | null
// - onClose: () => void
// - onPrev: () => void
// - onNext: () => void
export default function SpectatorMap({ roomId, players = {}, questions = [], selectedPlayerId, onClose, onPrev, onNext }) {
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 800;
  // Purely presentational: rely on props from parent (TeacherGameView)
  const effectivePlayers = players || {};
  const effectiveQuestions = questions || [];
  const ids = useMemo(() => Object.keys(effectivePlayers || {}), [effectivePlayers]);
  const selected = selectedPlayerId && effectivePlayers[selectedPlayerId] ? effectivePlayers[selectedPlayerId] : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden w-full max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center">👀</div>
            <div>
              <div className="font-bold text-gray-800">โหมดผู้ชม (Spectator) • ห้อง {roomId}</div>
              <div className="text-xs text-gray-600">ดูการเคลื่อนไหวของนักเรียนแบบเรียลไทม์</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!ids.length}
              aria-label="ก่อนหน้า"
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >← ก่อนหน้า</button>
            <button
              onClick={onNext}
              disabled={!ids.length}
              aria-label="ถัดไป"
              className="px-4 py-2 rounded-xl bg-purple-600 text-white shadow hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >ถัดไป →</button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white shadow focus:outline-none focus:ring-2 focus:ring-gray-400">ปิด</button>
          </div>
        </div>

        {/* Map */}
        <div className="relative w-full" style={{ height: 600 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
            <defs>
              <pattern id="grassTextureSpectate" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <rect width="60" height="60" fill="#4ade80"/>
                <circle cx="15" cy="15" r="2" fill="#22c55e" opacity="0.6"/>
                <circle cx="45" cy="30" r="1.5" fill="#16a34a" opacity="0.8"/>
                <circle cx="30" cy="50" r="1" fill="#22c55e" opacity="0.7"/>
                <circle cx="10" cy="45" r="1.5" fill="#16a34a" opacity="0.6"/>
              </pattern>
              <linearGradient id="wallGradientSpectate" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <radialGradient id="leafGradientSpectate" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </radialGradient>
              <filter id="questionGlowSpectate" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grassTextureSpectate)" />

            {/* Outer walls */}
            <rect x="0" y="0" width={MAP_WIDTH} height="30" fill="url(#wallGradientSpectate)" rx="15"/>
            <rect x="0" y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradientSpectate)" rx="15"/>
            <rect x={MAP_WIDTH-30} y="0" width="30" height={MAP_HEIGHT} fill="url(#wallGradientSpectate)" rx="15"/>
            <rect x="0" y={MAP_HEIGHT-30} width={MAP_WIDTH} height="30" fill="url(#wallGradientSpectate)" rx="15"/>

            {/* Inner sample walls (same layout as game) */}
            <rect x="120" y="80" width="300" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="500" y="120" width="25" height="250" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="650" y="60" width="200" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="200" y="320" width="350" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="750" y="200" width="25" height="180" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="100" y="480" width="25" height="250" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="400" y="450" width="250" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="850" y="350" width="120" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="300" y="600" width="200" height="25" fill="url(#wallGradientSpectate)" rx="12"/>
            <rect x="680" y="520" width="25" height="150" fill="url(#wallGradientSpectate)" rx="12"/>

            {/* Trees (simplified) */}
            <g>
              <g transform="translate(380,280)">
                <ellipse cx="0" cy="35" rx="8" ry="4" fill="#00000020"/>
                <rect x="-6" y="15" width="12" height="40" fill="#8b4513" rx="3"/>
                <circle cx="0" cy="-5" r="35" fill="url(#leafGradientSpectate)"/>
              </g>
              <g transform="translate(900,180)">
                <ellipse cx="0" cy="25" rx="6" ry="3" fill="#00000020"/>
                <rect x="-4" y="10" width="8" height="30" fill="#8b4513" rx="2"/>
                <circle cx="0" cy="-5" r="25" fill="url(#leafGradientSpectate)"/>
              </g>
              <g transform="translate(280,580)">
                <ellipse cx="0" cy="40" rx="10" ry="5" fill="#00000020"/>
                <rect x="-8" y="20" width="16" height="45" fill="#8b4513" rx="4"/>
                <circle cx="0" cy="-10" r="40" fill="url(#leafGradientSpectate)"/>
              </g>
              <g transform="translate(1000,480)">
                <ellipse cx="0" cy="28" rx="7" ry="3" fill="#00000020"/>
                <rect x="-5" y="12" width="10" height="32" fill="#8b4513" rx="3"/>
                <circle cx="0" cy="-8" r="28" fill="url(#leafGradientSpectate)"/>
              </g>
            </g>

            {/* Question spots */}
            {(effectiveQuestions || []).map((spot) => {
              const spotX = spot.x; const spotY = spot.y;
              return (
                <g key={spot.id}>
                  <circle cx={spotX} cy={spotY} r={40} fill="#3b82f6" opacity="0.12" filter="url(#questionGlowSpectate)" />
                  <circle cx={spotX} cy={spotY} r={28} fill="#3b82f6" stroke="#ffffff" strokeWidth="4"/>
                  <circle cx={spotX} cy={spotY} r={22} fill="#60a5fa" opacity="0.9"/>
                  <text x={spotX} y={spotY + 8} textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">?</text>
                </g>
              );
            })}

            {/* Players */}
            {Object.values(effectivePlayers).map((p) => {
              const playerX = p.x; const playerY = p.y;
              const isSelected = p === selected;
              return (
                <g key={p.playerId || p.name}>
                  <ellipse cx={playerX} cy={playerY + 25} rx="15" ry="8" fill="#000000" opacity="0.2"/>
                  {isSelected && (
                    <circle cx={playerX} cy={playerY} r="28" fill="#2563eb" opacity="0.25" />
                  )}
                  <circle cx={playerX} cy={playerY} r="20" fill={isSelected ? "#2563eb" : "#ff6b6b"} stroke="#ffffff" strokeWidth="3"/>
                  <circle cx={playerX - 6} cy={playerY - 4} r="3" fill="#ffffff"/>
                  <circle cx={playerX + 6} cy={playerY - 4} r="3" fill="#ffffff"/>
                  <path d={`M ${playerX - 6} ${playerY + 8} Q ${playerX} ${playerY + 12} ${playerX + 6} ${playerY + 8}`} stroke="#ffffff" strokeWidth="2.5" fill="none"/>

                  <rect x={playerX - 40} y={playerY - 45} width="80" height="25" fill={isSelected ? "#2563eb" : "#ffffff"} stroke="#e5e7eb" strokeWidth="1" rx="12" opacity="0.95"/>
                  <text x={playerX} y={playerY - 27} textAnchor="middle" fontSize="12" fontWeight="bold" fill={isSelected ? "#ffffff" : "#374151"}>{p.name || 'Player'}</text>
                </g>
              );
            })}

            {/* Selected badge */}
            {selected && (
              <g>
                <rect x={20} y={20} width={320} height={52} rx={14} fill="#111827" opacity="0.9" />
                <text x={36} y={50} fontSize="16" fontWeight="bold" fill="#fff">กำลังดู: {selected.name}</text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
