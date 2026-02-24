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

  // ใช้สูตรเดียวกับฝั่งนักเรียนในการวางแท่นและบล็อก (buildSymmetricOffsets + platLevels)
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

  const layout = useMemo(() => {
    const qArr = Array.isArray(questions) ? questions : [];
    const count = qArr.length || 4;
    const GAP = 320; const LEFT_PAD = 800; const RIGHT_PAD = 800;
    const minWorld = 3600;
    const needed = count > 1 ? (count - 1) * GAP : 0;
    const world = Math.max(minWorld, LEFT_PAD + RIGHT_PAD + needed + VIEW_W);
    const center = world / 2;
    const offsets = buildSymmetricOffsets(count, GAP);

    const platLevels = [
      { dy: 120, w: 260 },
      { dy: 150, w: 220 },
    ];

    const plats = [];
    const blocks = (qArr.length ? qArr : Array.from({ length: count }).map((_, i) => ({ id: `q${i+1}`, text: `Q${i+1}`, choices: ["A","B","C","D"], answerIndex: i % 4, points: 100 })))
      .map((q, i) => {
        const off = offsets[i] || 0;
        const level = i % 3; // 0 ground, 1/2 platforms
        let y = GROUND_Y - 40;
        if (level === 1 || level === 2) {
          const lvl = platLevels[level - 1];
          const w = lvl.w; const px = center + off - w / 2; const py = GROUND_Y - lvl.dy;
          plats.push({ x: px, y: py, w, h: 18 });
          y = py - 40;
        }
        return { id: q.id || `q${i+1}`, x: center + off, y };
      });
    return { world, center, plats, blocks };
  }, [questions, VIEW_W, GROUND_Y]);

  const platforms = layout.plats;
  const blocks = layout.blocks;
  const worldUsed = layout.world;

  // Fit entire world into the frame (scale down) for overview
  const scale = Math.min(1, VIEW_W / worldUsed);
  const canvasW = worldUsed * scale;
  const canvasH = VIEW_H;

  // Spectator view is purely driven by props from TeacherGameView (which subscribes to sockets)
  const effectivePlayers = players || {};
  const selectedPlayer = useMemo(() => {
    if (!effectivePlayers) return null;
    if (selectedPlayerId && effectivePlayers[selectedPlayerId]) return effectivePlayers[selectedPlayerId];
    const vals = Object.values(effectivePlayers);
    return vals.length ? vals[0] : null;
  }, [effectivePlayers, selectedPlayerId]);

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
          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${worldUsed} ${VIEW_H}`} className="my-4" style={{ width: canvasW, height: canvasH }}>
            {/* Sky */}
            <rect x="0" y="0" width={worldUsed} height={VIEW_H} fill="#9cd3ff" />
            {/* Ground */}
            <rect x="0" y={GROUND_Y} width={worldUsed} height={GROUND_H} fill="#86efac" />
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
            {Object.values(effectivePlayers).map(p => {
              const isSelected = selectedPlayerId && p.playerId === selectedPlayerId;
              // Use exact physics Y from student client so standing under blocks/platforms matches perfectly
              const ry = p.y;
              return (
                <g key={p.playerId || p.name}>
                  {isSelected && <circle cx={p.x} cy={ry} r="28" fill="#2563eb" opacity="0.25" />}
                  <circle cx={p.x} cy={ry} r="18" fill={isSelected ? '#2563eb' : '#ef4444'} />
                  <text x={p.x} y={ry - 28} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#111827">{p.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
