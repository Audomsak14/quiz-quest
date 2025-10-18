"use client";
import React, { useMemo } from "react";

// Read-only spectator for the side-scrolling quiz
// Props: roomId, players (map), questions (array), selectedPlayerId, onClose, onPrev, onNext
export default function SpectatorSideScroller({ roomId, players = {}, questions = [], selectedPlayerId, onClose, onPrev, onNext }) {
  const VIEW_W = 1200;
  const VIEW_H = 700;
  const WORLD_W = 3600;
  const GROUND_H = 120;
  const GROUND_Y = VIEW_H - GROUND_H;

  // Match the student's layout logic
  const platforms = useMemo(() => ([
    { x: WORLD_W/2 - 500, y: GROUND_Y - 120, w: 260, h: 18 },
    { x: WORLD_W/2 + 360, y: GROUND_Y - 170, w: 220, h: 18 },
    { x: WORLD_W/2 - 900, y: GROUND_Y - 200, w: 280, h: 18 },
    { x: WORLD_W/2 + 900, y: GROUND_Y - 130, w: 300, h: 18 },
  ]), [GROUND_Y, WORLD_W]);

  // Derive block positions (same offsets as game client)
  const blocks = useMemo(() => {
    const offsets = [-1000, -700, -400, 400, 700, 1000];
    return (questions || []).slice(0, offsets.length).map((q, i) => ({
      id: q.id,
      x: WORLD_W/2 + offsets[i],
      y: (i % 3 === 0 ? GROUND_Y - 40 : (platforms[i % platforms.length]?.y - 40) || (GROUND_Y - 40)),
    }));
  }, [questions, WORLD_W, GROUND_Y, platforms]);

  // Fit entire world into the frame (scale down) for overview
  const scale = Math.min(1, VIEW_W / WORLD_W);
  const canvasW = WORLD_W * scale;
  const canvasH = VIEW_H;

  const selectedPlayer = useMemo(() => {
    if (!players) return null;
    if (selectedPlayerId && players[selectedPlayerId]) return players[selectedPlayerId];
    const vals = Object.values(players);
    return vals.length ? vals[0] : null;
  }, [players, selectedPlayerId]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden w-full max-w-[1300px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center">👀</div>
            <div>
              <div className="font-bold text-gray-800">โหมดผู้ชม (Side-Scroller) • ห้อง {roomId}</div>
              <div className="text-xs text-gray-600">ดูการเคลื่อนไหวของนักเรียนแบบเรียลไทม์</div>
              <div className="mt-1">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  กำลังดู: {selectedPlayer ? (selectedPlayer.name || '—') : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrev} disabled={!Object.keys(players).length} className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-600">← ก่อนหน้า</button>
            <button onClick={onNext} disabled={!Object.keys(players).length} className="px-4 py-2 rounded-xl bg-purple-600 text-white shadow hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-600">ถัดไป →</button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white shadow">ปิด</button>
          </div>
        </div>

        {/* World */}
        <div className="relative w-full flex items-center justify-center bg-[#9bd1ff]">
          {/* Floating name tab for clarity */}
          {selectedPlayer && (
            <div className="absolute top-2 left-2 z-10">
              <div className="px-3 py-1 rounded-xl bg-white/90 border border-gray-200 shadow text-sm font-semibold text-gray-800">
                👤 กำลังดู: <span className="text-indigo-700">{selectedPlayer.name || '—'}</span>
              </div>
            </div>
          )}
          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${WORLD_W} ${VIEW_H}`} className="my-4" style={{ width: canvasW, height: canvasH }}>
            {/* Sky */}
            <rect x="0" y="0" width={WORLD_W} height={VIEW_H} fill="#9cd3ff" />
            {/* Ground */}
            <rect x="0" y={GROUND_Y} width={WORLD_W} height={GROUND_H} fill="#86efac" />
            {/* Platforms */}
            {platforms.map((p, idx) => (
              <rect key={idx} x={p.x} y={p.y} width={p.w} height={p.h} fill="#8b5cf6" />
            ))}
            {/* Blocks */}
            {blocks.map(b => (
              <g key={b.id}>
                <rect x={b.x-24} y={b.y-24} width="48" height="48" fill="#f59e0b" stroke="#fff" strokeWidth="3" />
                <text x={b.x} y={b.y+8} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">?</text>
              </g>
            ))}
            {/* Players */}
            {Object.values(players).map(p => {
              const isSelected = selectedPlayerId && p.playerId === selectedPlayerId;
              return (
                <g key={p.playerId || p.name}>
                  {isSelected && <circle cx={p.x} cy={p.y} r="28" fill="#2563eb" opacity="0.25" />}
                  <circle cx={p.x} cy={p.y} r="18" fill={isSelected ? '#2563eb' : '#ef4444'} />
                  <text x={p.x} y={p.y - 28} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#111827">{p.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
