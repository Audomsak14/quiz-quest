"use client";
import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { profileStorage } from "@/lib/profileStorage";

function drawTransformed(ctx, img, dx, dy, dw, dh, opts = {}) {
  const { flipX = false, rotate = 0, yShift = 0, xShift = 0, scale = 1 } = opts;
  ctx.save();
  ctx.translate(dx + dw / 2 + xShift, dy + dh / 2 + yShift);
  ctx.rotate(rotate);
  ctx.scale(flipX ? -scale : scale, scale);
  const w = dw, h = dh;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export default function SpriteMakerPage() {
  const router = useRouter();
  const [fileUrl, setFileUrl] = useState("");
  const [imgEl, setImgEl] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [size, setSize] = useState(256);
  const [bg, setBg] = useState("transparent");

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    const i = new Image();
    i.onload = () => setImgEl(i);
    i.src = url;
  };

  const generate = () => {
    if (!imgEl) return;
    const frame = size;
    const cols = 8, rows = 1;
    const canvas = document.createElement("canvas");
    canvas.width = frame * cols;
    canvas.height = frame * rows;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    // Fill bg if requested
    if (bg !== "transparent") { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    // Fit source image nicely inside a frame with slight margin
    const margin = Math.round(frame * 0.08);
    const avail = frame - margin * 2;
    const ratio = Math.min(avail / imgEl.naturalWidth, avail / imgEl.naturalHeight);
    const drawW = Math.round(imgEl.naturalWidth * ratio);
    const drawH = Math.round(imgEl.naturalHeight * ratio);

    // Define 8 frames akin to Mario-like sheet
    // 0 Idle, 1 WalkL_A, 2 WalkL_B, 3 WalkR_A, 4 WalkR_B, 5 JumpUp, 6 JumpL, 7 JumpR
    const frames = [
      { flipX: false, rotate: 0, yShift: 0 },                    // Idle
      { flipX: true,  rotate: -0.08, yShift: -4 },               // WalkL_A
      { flipX: true,  rotate: 0.08,  yShift: 2 },                // WalkL_B
      { flipX: false, rotate: -0.08, yShift: -4 },               // WalkR_A
      { flipX: false, rotate: 0.08,  yShift: 2 },                // WalkR_B
      { flipX: false, rotate: -0.15, yShift: -12 },              // JumpUp
      { flipX: true,  rotate: -0.12, yShift: -10 },              // JumpL
      { flipX: false, rotate: 0.12,  yShift: -10 },              // JumpR
    ];

    frames.forEach((opts, idx) => {
      const x = idx * frame;
      drawTransformed(
        ctx,
        imgEl,
        x + margin,
        margin,
        drawW,
        drawH,
        opts
      );
    });

    setSheetUrl(canvas.toDataURL("image/png"));
  };

  const download = () => {
    if (!sheetUrl) return;
    const a = document.createElement("a");
    a.href = sheetUrl;
    a.download = "character-sprite-8x1.png";
    a.click();
  };

  const saveAsCharacter = () => {
    if (!sheetUrl) return;
    profileStorage.setImage(sheetUrl);
    profileStorage.setCharacterId("custom");
    router.push("/game?mode=side&debug=1");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">← กลับ</button>
          <h1 className="text-2xl font-extrabold">ตัวช่วยทำสไปรต์ชีต (แบบมาริโอ้)</h1>
          <div />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div className="font-semibold mb-2">1) อัปโหลดรูปตัวละครเดี่ยว</div>
            <input type="file" accept="image/*" onChange={onPick} className="block w-full text-sm text-white" />
            <div className="mt-3 text-sm text-blue-200">ทิป: ใช้พื้นหลังโปร่งใสจะสวยที่สุด (PNG/SVG)</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="text-sm">ขนาดเฟรม (px)
                <input type="number" min={128} max={512} step={32} value={size} onChange={(e)=>setSize(parseInt(e.target.value || 256))} className="mt-1 w-full rounded bg-slate-800 border border-slate-600 px-2 py-1" />
              </label>
              <label className="text-sm">พื้นหลัง
                <select value={bg} onChange={(e)=>setBg(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-600 px-2 py-1">
                  <option value="transparent">โปร่งใส</option>
                  <option value="#ffffff">ขาว</option>
                  <option value="#000000">ดำ</option>
                </select>
              </label>
            </div>
            <button onClick={generate} disabled={!imgEl} className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 disabled:opacity-50 hover:bg-emerald-600">สร้างสไปรต์ชีต 8x1</button>
            {fileUrl && (
              <div className="mt-4">
                <div className="text-sm mb-1">พรีวิวรูปต้นฉบับ</div>
                <img src={fileUrl} alt="source" className="w-full max-h-64 object-contain rounded border border-white/10 bg-white/5" />
              </div>
            )}
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div className="font-semibold mb-2">2) ผลลัพธ์ 8 เฟรม</div>
            {sheetUrl ? (
              <>
                <div className="overflow-auto rounded border border-white/10 bg-white/5">
                  <img src={sheetUrl} alt="sheet" className="w-full object-contain" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={download} className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600">ดาวน์โหลด PNG</button>
                  <button onClick={saveAsCharacter} className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600">ใช้เป็นตัวละครของฉัน</button>
                </div>
                <div className="mt-2 text-xs text-blue-200">กดปุ่ม “ใช้เป็นตัวละครของฉัน” แล้วจะไปที่เกมพร้อมเปิดโหมดดีบักให้ดูเฟรมที่ถูกจับ</div>
              </>
            ) : (
              <div className="text-sm text-blue-200">ยังไม่มีผลลัพธ์ ลองอัปโหลดรูปและกดปุ่มสร้าง</div>
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-white/70">
          เคล็ดลับ: ถ้าต้องการสมจริงมากขึ้น ให้เตรียมสไปรต์ชีต 8x1 ที่วาดท่าเดิน 2 เฟรมซ้าย/ขวา และท่ากระโดด 3 แบบ จากนั้นเลือกไฟล์นั้นในหน้าเลือกตัวละครได้เลย
        </div>
      </div>
    </div>
  );
}
