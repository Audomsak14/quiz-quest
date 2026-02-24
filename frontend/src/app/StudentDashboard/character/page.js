"use client";
import { useEffect, useState, useRef } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { profileStorage } from "@/lib/profileStorage";

const CHARACTER_ASSET_VERSION = "2026-02-24-old";
const GIRL_SPRITE_URL = `/characters/girl-sprite-8x1.svg?v=${CHARACTER_ASSET_VERSION}`;
const BOY_SPRITE_URL = `/characters/boy-sprite-8x1.svg?v=${CHARACTER_ASSET_VERSION}`;

// Lightweight sprite-strip previewer (e.g., 8x1). Renders selected columns as small tiles.
function SpriteStripPreview({ src, cols = 8, rows = 1, includeCols, tile = 64, className = "" }) {
  const [img, setImg] = useState(null);
  const [frameUrls, setFrameUrls] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      try {
        const aW = image.naturalWidth || image.width;
        const aH = image.naturalHeight || image.height;
        const sW = Math.floor(aW / cols) || aW;
        const sH = Math.floor(aH / rows) || aH;
        const picks = Array.isArray(includeCols) && includeCols.length
          ? includeCols
          : Array.from({ length: cols }, (_, i) => i);
        const urls = picks.map((c) => {
          const canvas = document.createElement("canvas");
          canvas.width = tile; canvas.height = tile;
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, tile, tile);
          // cover-fit into square tile keeping aspect
          const ratio = Math.min(tile / sW, tile / sH);
          const w = Math.round(sW * ratio);
          const h = Math.round(sH * ratio);
          const x = Math.round((tile - w) / 2);
          const y = Math.round((tile - h) / 2);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(image, c * sW, 0, sW, sH, x, y, w, h);
          return canvas.toDataURL("image/png");
        });
        setFrameUrls(urls);
        setImg(image);
      } catch {}
    };
    image.onerror = () => setImg(null);
    image.src = src;
    return () => { cancelled = true; };
  }, [src, cols, rows, includeCols, tile]);

  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur flex items-center gap-3 p-3 overflow-x-auto">
        {frameUrls.length ? (
          frameUrls.map((u, i) => (
            <div key={i} className="relative">
              <div className="p-[2px] rounded-xl bg-gradient-to-b from-pink-400/60 via-fuchsia-400/50 to-indigo-400/60">
                <img
                  src={u}
                  alt={`frame-${i}`}
                  width={tile}
                  height={tile}
                  className="block rounded-[10px] shadow-sm"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-blue-200 text-sm p-4">กำลังโหลดพรีวิว…</div>
        )}
      </div>
    </div>
  );
}

// Animated single-sprite preview that cycles specific columns from a sheet
function AnimatedSpritePreview({ src, cols = 8, rows = 1, frames = [1,2,3,4], tile = 120, fps = 7, className = "" }) {
  const [img, setImg] = useState(null);
  const [frameW, setFrameW] = useState(0);
  const [frameH, setFrameH] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const aW = image.naturalWidth || image.width;
      const aH = image.naturalHeight || image.height;
      setFrameW(Math.floor(aW / cols) || aW);
      setFrameH(Math.floor(aH / rows) || aH);
      setImg(image);
    };
    image.onerror = () => setImg(null);
    image.src = src;
    return () => { cancelled = true; };
  }, [src, cols, rows]);

  useEffect(() => {
  if (!img || !frameW || !frameH || !canvasRef.current) return;
    let raf; let last = performance.now();
    let t = 0; // seconds
    const seq = frames.length ? frames : [0];
    const ctx = canvasRef.current.getContext('2d');
    const draw = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; t += dt;
      const idx = Math.floor(t * fps) % seq.length;
      const col = seq[idx];
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const ratio = Math.min(canvasRef.current.width / frameW, canvasRef.current.height / frameH);
      const w = Math.round(frameW * ratio); const h = Math.round(frameH * ratio);
      const x = Math.round((canvasRef.current.width - w) / 2);
      const y = Math.round((canvasRef.current.height - h) / 2);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, col * frameW, 0, frameW, frameH, x, y, w, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [img, frameW, frameH, frames, fps]);

  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur p-3 flex items-center justify-center">
        <canvas ref={canvasRef} width={tile} height={tile} className="block rounded-[10px] shadow-sm" />
      </div>
    </div>
  );
}

// Final simple flow: choose Male or Female from a pre-bundled image without upload
// Expected file location (add this once): frontend/public/characters/boy-girl.png
export default function CharacterMaleFemaleChoice() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [leftAvatar, setLeftAvatar] = useState("");
  const [rightAvatar, setRightAvatar] = useState("");
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [tried, setTried] = useState([]);
  const [isSpriteGrid, setIsSpriteGrid] = useState(false); // true when using a 6x2 or 6x1 sheet
  // Try common extensions to reduce friction
  const candidates = [
    "/characters/boy-girl.png",
    "/characters/boy-girl.jpg",
    "/characters/boy-girl.jpeg",
    "/characters/boy-girl.webp",
    "/characters/boy-girl.svg",
    // Common 2x2 sheet name variants
    "/characters/boy-girl-2x2.png",
    "/characters/boy-girl-2x2.jpg",
    "/characters/boy-girl-2x2.jpeg",
    "/characters/boy-girl-2x2.webp",
    "/characters/boy-girl-2x2.svg",
  ];
  const individual = [
    { boy: "/characters/boy.png", girl: "/characters/girl.png" },
    { boy: "/characters/boy.jpg", girl: "/characters/girl.jpg" },
    { boy: "/characters/boy.jpeg", girl: "/characters/girl.jpeg" },
    { boy: "/characters/boy.webp", girl: "/characters/girl.webp" },
    { boy: "/characters/boy.svg", girl: "/characters/girl.svg" },
  ];

  useEffect(() => {
    setIsClient(true);
    // Try loading each candidate until one succeeds
    let cancelled = false;
    const tryNext = (idx = 0) => {
      if (cancelled) return;
      if (idx >= candidates.length) { setMissing(true); return; }
      setTried((t) => [...t, candidates[idx]]);
      const img = new Image();
      img.onload = () => {
        try {
            // Detect sprite sheet layouts that the game can use directly.
            const nW = img.naturalWidth || img.width || 0;
            const nH = img.naturalHeight || img.height || 0;
            const is8x2 = nW % 8 === 0 && nH % 2 === 0 && nW > 0 && nH > 0;
            const is8x1 = nW % 8 === 0 && Math.round(nW / 8) === nH && nW > 0 && nH > 0; // square frames
            const is6x2 = nW % 6 === 0 && nH % 2 === 0 && nW > 0 && nH > 0;
            const is6x1 = nW % 6 === 0 && Math.round(nW / 6) === nH && nW > 0 && nH > 0; // square frames
            const is2x2 = nW % 2 === 0 && nH % 2 === 0 && nW > 0 && nH > 0;
            if (is8x2 || is8x1 || is6x2 || is6x1 || is2x2) {
            // Use the original URL directly so dimensions remain intact for runtime detection.
            setLeftAvatar(candidates[idx]);
            setRightAvatar(candidates[idx]);
            setIsSpriteGrid(true);
            setReady(true);
            return;
          }

          const size = 1024;
            const halfW = Math.floor(nW / 2);
          // Independent seams for male and female to keep male clean and female full
            const centerGap = Math.max(3, Math.round(nW * 0.02)); // ~2%
            const maleShiftRight = Math.max(1, Math.round(nW * 0.015)); // ~1.5%
            const femaleRecoverLeft = Math.max(1, Math.round(nW * 0.02)); // ~2%

          // Male (left): cut a bit more to avoid bleeding
          const leftSx = 0;
          const leftSw = Math.max(1, halfW - (centerGap + maleShiftRight));

          // Female (right): start a little closer to center to recover left hair
          const rightSx = Math.min(img.width - 1, halfW + femaleRecoverLeft);
          const rightSw = Math.max(1, img.width - rightSx);

          const makeHalf = (sx, sw) => {
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, size, size);
            // cover-fit
              const srcW = sw, srcH = nH;
            const ratio = Math.min(size / srcW, size / srcH);
            const w = Math.round(srcW * ratio), h = Math.round(srcH * ratio);
            const x = Math.round((size - w) / 2), y = Math.round((size - h) / 2);
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, sx, 0, srcW, srcH, x, y, w, h);
            return canvas.toDataURL('image/png');
          };
          setLeftAvatar(makeHalf(leftSx, leftSw));
          setRightAvatar(makeHalf(rightSx, rightSw));
          setReady(true);
        } catch (e) {
          console.error(e);
          setMissing(true);
        }
      };
      img.onerror = () => tryNext(idx + 1);
      img.src = candidates[idx];
    };
    tryNext(0);
    return () => { cancelled = true; };
  }, []);

  // Fallback: if combined image is missing, try two individual files
  useEffect(() => {
    if (ready || missing !== true) return; // only when combined failed
    let cancelled = false;
    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    const makeHalfFromImg = (img, which = 'left') => {
      const size = 1024;
      const halfW = Math.floor(img.width / 2);
  const centerGap = Math.max(3, Math.round(img.width * 0.02));
  const maleShiftRight = Math.max(1, Math.round(img.width * 0.015));
  const femaleRecoverLeft = Math.max(1, Math.round(img.width * 0.02));
      const sx = which === 'left'
        ? 0
        : Math.min(img.width - 1, halfW + femaleRecoverLeft);
      const sw = which === 'left'
        ? Math.max(1, halfW - (centerGap + maleShiftRight))
        : Math.max(1, img.width - Math.min(img.width - 1, halfW + femaleRecoverLeft));
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      const srcW = sw, srcH = img.height;
      const ratio = Math.min(size / srcW, size / srcH);
      const w = Math.round(srcW * ratio), h = Math.round(srcH * ratio);
      const x = Math.round((size - w) / 2), y = Math.round((size - h) / 2);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, 0, srcW, srcH, x, y, w, h);
      return canvas.toDataURL('image/png');
    };

    const loadPair = async () => {
      for (const pair of individual) {
        try {
          const [imgB, imgG] = await Promise.all([
            loadImage(pair.boy),
            loadImage(pair.girl),
          ]);
          if (cancelled) return;

          // ถ้ารูปใดรูปหนึ่งมีสัดส่วนกว้างกว่าสูงมาก (เช่น 2 ตัวอยู่ข้างกัน) ให้ครอปซ้าย/ขวาอัตโนมัติ
          const looksCompositeB = imgB.width > imgB.height * 1.3;
          const looksCompositeG = imgG.width > imgG.height * 1.3;

          if (looksCompositeB || looksCompositeG) {
            const base = looksCompositeB ? imgB : imgG; // ใช้รูปที่กว้างแนวนอนเป็นฐาน
            const left = makeHalfFromImg(base, 'left');
            const right = makeHalfFromImg(base, 'right');
            setLeftAvatar(left);
            setRightAvatar(right);
          } else {
            // ใช้ไฟล์แยกปกติ
            setLeftAvatar(pair.boy);
            setRightAvatar(pair.girl);
          }
          setReady(true);
          setMissing(false);
          return;
        } catch (e) {
          // ลองคู่ถัดไป
        }
      }
    };
    loadPair();
    return () => { cancelled = true; };
  }, [ready, missing]);

  const save = async (side) => {
    if (!isClient) return;
    const dataUrl = side === 'left' ? leftAvatar : rightAvatar;
    if (!dataUrl) { await Swal.fire({ icon: 'warning', title: 'ยังไม่พร้อมใช้งาน' }); return; }
    // If image is a sprite grid (6x2 or 6x1), keep original URL string to preserve dimensions.
    profileStorage.setImage(dataUrl);
    profileStorage.setCharacterId(side === 'left' ? 'male' : 'female');
    await Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 900, showConfirmButton: false });
    router.back();
  };

  if (!isClient) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-4 md:p-6">
      <div className="bg-white/10 backdrop-blur-2xl rounded-2xl shadow-xl p-4 md:p-5 mb-4 md:mb-6 border border-white/20 w-fit max-w-full mr-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-3 py-1.5 rounded-lg shadow text-sm">← กลับ</button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">เลือกตัวละครแบบเร็ว</h1>
              <p className="text-blue-200 text-sm md:text-base">ใช้ตัวละครแนะนำด้านล่างได้ทันที</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* female character card */}
          <div className="relative w-full max-w-[600px]">
            <div className="absolute inset-0 rounded-[26px] bg-gradient-to-b from-indigo-500/20 via-fuchsia-500/15 to-pink-500/10 blur-xl" />
            <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl p-4 md:p-5 border border-white/20">
            <h3 className="text-white font-bold mb-3 text-lg">ตัวละครหญิง</h3>
            {/* แสดงท่าเดินเป็นภาพเคลื่อนไหว: ใช้เฟรมเดิน [1,2,3,4] จากแผง 8x1 (L/R) */}
            <AnimatedSpritePreview src={GIRL_SPRITE_URL} cols={8} rows={1} frames={[1,2,3,4]} tile={120} fps={7} className="w-full" />
            <div className="mt-4 flex gap-2">
              <button
                onClick={async()=>{
                  profileStorage.setImage(GIRL_SPRITE_URL);
                  profileStorage.setCharacterId('female');
                  await Swal.fire({icon:'success',title:'บันทึกสำเร็จ',timer:900,showConfirmButton:false});
                  router.back();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 text-white font-semibold w-full shadow"
              >
                เลือกตัวละครหญิง
              </button>
              <button onClick={async()=>{ profileStorage.setImage(''); profileStorage.setCharacterId(''); await Swal.fire({icon:'success',title:'ซ่อนตัวละครแล้ว',timer:900,showConfirmButton:false}); router.back(); }} className="px-4 py-2 rounded-xl bg-slate-700/90 hover:bg-slate-800 text-white font-semibold w-full">ซ่อนตัวละคร</button>
            </div>
            <div className="mt-2 text-xs text-blue-200">คลิก “เลือกตัวละครหญิง” เพื่อใช้สไปรต์นี้ในเกม (พรีวิวเดินอัตโนมัติ)</div>
            </div>
          </div>
          {/* male character card */}
          <div className="relative w-full max-w-[600px]">
            <div className="absolute inset-0 rounded-[26px] bg-gradient-to-b from-indigo-500/20 via-sky-500/15 to-cyan-500/10 blur-xl" />
            <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl p-4 md:p-5 border border-white/20">
              <h3 className="text-white font-bold mb-3 text-lg">ตัวละครชาย</h3>
              {/* แสดงท่าเดินเป็นภาพเคลื่อนไหว: ใช้เฟรมเดิน [1,2,3,4] จากแผง 8x1 */}
              <AnimatedSpritePreview src={BOY_SPRITE_URL} cols={8} rows={1} frames={[1,2,3,4]} tile={120} fps={7} className="w-full" />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={async()=>{
                    profileStorage.setImage(BOY_SPRITE_URL);
                    profileStorage.setCharacterId('male');
                    await Swal.fire({icon:'success',title:'บันทึกสำเร็จ',timer:900,showConfirmButton:false});
                    router.back();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-semibold w-full shadow"
                >
                  เลือกตัวละครชาย
                </button>
                <button onClick={async()=>{ profileStorage.setImage(''); profileStorage.setCharacterId(''); await Swal.fire({icon:'success',title:'ซ่อนตัวละครแล้ว',timer:900,showConfirmButton:false}); router.back(); }} className="px-4 py-2 rounded-xl bg-slate-700/90 hover:bg-slate-800 text-white font-semibold w-full">ซ่อนตัวละคร</button>
              </div>
              <div className="mt-2 text-xs text-blue-200">คลิก “เลือกตัวละครชาย” เพื่อใช้สไปรต์นี้ในเกม</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
