"use client";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { profileStorage } from "@/lib/profileStorage";

export default function StudentDashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [selectedCharacterName, setSelectedCharacterName] = useState("นักเรียน");
  const [selectedCharacterEmoji, setSelectedCharacterEmoji] = useState("👨‍🎓");
  const [playerName, setPlayerName] = useState("นักเรียน");
  const [characterImage, setCharacterImage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState("");
  const [tempPlayerImage, setTempPlayerImage] = useState(null);

  // History / Stats
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [history, setHistory] = useState({
    summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
    attempts: [],
  });
  const [deletingAttemptKey, setDeletingAttemptKey] = useState('');

  // ฟังก์ชันโหลดข้อมูลตัวละคร
  const loadCharacterData = () => {
    if (typeof window !== 'undefined') {
  const characterName = localStorage.getItem('selectedCharacterName');
  const characterId = profileStorage.getCharacterId() || localStorage.getItem('selectedCharacter');
  const savedPlayerName = profileStorage.getName();
  const savedCharacterImage = localStorage.getItem('selectedCharacterImage');
  const savedPlayerImage = profileStorage.getImage();
      
      console.log("Loading character data:", { characterName, characterId, savedPlayerName, savedCharacterImage, savedPlayerImage });
      
      // โหลดชื่อผู้เล่น
      if (savedPlayerName) {
        setPlayerName(savedPlayerName);
      } else {
        setPlayerName("นักเรียน");
      }

      // โหลดชื่อตัวละคร: ถ้าเลือกแบบเพศ ให้แสดง "ตัวละครชาย/หญิง" แทนค่าดั้งเดิม
      const id = characterId;
      if (id === 'male') {
        setSelectedCharacterName('ตัวละครชาย');
      } else if (id === 'female') {
        setSelectedCharacterName('ตัวละครหญิง');
      } else if (characterName) {
        setSelectedCharacterName(characterName);
      } else {
        setSelectedCharacterName("นักเรียน");
      }

      // โหลดรูปภาพตัวละคร - รองรับทั้งรูปตัวละครและรูปที่ผู้เล่นอัปโหลด
      if (savedPlayerImage) {
        // ถ้ามีรูปที่ผู้เล่นอัปโหลด ใช้รูปนั้น
        setCharacterImage(savedPlayerImage);
      } else if (savedCharacterImage) {
        // ถ้าไม่มีรูปที่อัปโหลด แต่มีรูปตัวละคร
        setCharacterImage(savedCharacterImage);
      } else if (characterId) {
        // ถ้าไม่มีรูปใดๆ แต่มี characterId ให้สร้างรูปตัวละคร
        const characters = [
          { id: 0, name: "นักรบ", emoji: "🗡️", image: "/images/characters/warrior.png" },
          { id: 1, name: "นักเวทย์", emoji: "🔮", image: "/images/characters/mage.png" },
          { id: 2, name: "นักธนู", emoji: "🏹", image: "/images/characters/archer.png" },
          { id: 3, name: "พ่อมด", emoji: "🧙‍♂️", image: "/images/characters/wizard.png" },
          { id: 4, name: "นินจา", emoji: "🥷", image: "/images/characters/ninja.png" },
          { id: 5, name: "อัศวินดำ", emoji: "⚔️", image: "/images/characters/knight.png" },
          { id: 6, name: "นักสู้", emoji: "👊", image: "/images/characters/fighter.png" },
          { id: 7, name: "โจร", emoji: "🔪", image: "/images/characters/rogue.png" },
          { id: 8, name: "นักบวช", emoji: "🙏", image: "/images/characters/priest.png" },
          { id: 9, name: "ดรูอิด", emoji: "🌿", image: "/images/characters/druid.png" },
          { id: 10, name: "บาร์เบเรียน", emoji: "⚡", image: "/images/characters/barbarian.png" },
          { id: 11, name: "บาร์ด", emoji: "🎵", image: "/images/characters/bard.png" }
        ];
        const character = characters[parseInt(characterId)];
        if (character) {
          setCharacterImage(character.image);
        } else {
          setCharacterImage(null);
        }
      } else {
        setCharacterImage(null);
      }

      // กำหนด emoji ตามตัวละครที่เลือก (รองรับ male/female)
      if (id === 'male') {
        setSelectedCharacterEmoji('👦');
      } else if (id === 'female') {
        setSelectedCharacterEmoji('👧');
      } else if (characterId) {
        const characters = ["🗡️","🔮","🏹","🧙‍♂️","🥷","⚔️","👊","🔪","🙏","🌿","⚡","🎵"];
        const emoji = characters[parseInt(characterId)] || "👨‍🎓";
        setSelectedCharacterEmoji(emoji);
      } else {
        setSelectedCharacterEmoji("👨‍🎓");
      }
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadCharacterData();

    // ตั้ง interval เพื่อเช็คการเปลี่ยนแปลงทุกๆ 1 วินาที
    const interval = setInterval(() => {
      loadCharacterData();
    }, 1000);

    // ฟัง visibility change (เมื่อ tab กลับมา active)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(loadCharacterData, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ฟัง page show event
    const handlePageShow = () => {
      setTimeout(loadCharacterData, 100);
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // Load game history (for stats + recent activities)
  useEffect(() => {
    if (!isClient) return;

    const run = async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const id = profileStorage.getId();
        const name = profileStorage.getName() || playerName || '';
        if (!id && !name) {
          setHistory({ summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 }, attempts: [] });
          return;
        }
        const params = new URLSearchParams();
        if (id) params.set('playerId', id);
        if (name) params.set('name', name);
        const qs = params.toString();
        const r = await fetch(`http://localhost:5000/api/game/history?${qs}&limit=200`, { cache: 'no-store' });
        const data = await r.json();
        if (!data?.success) throw new Error(data?.error || 'failed');
        setHistory({
          summary: data.summary || { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
          attempts: Array.isArray(data.attempts) ? data.attempts : [],
        });
      } catch (e) {
        setHistoryError('โหลดสถิติ/กิจกรรมล่าสุดไม่ได้');
        setHistory({ summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 }, attempts: [] });
      } finally {
        setHistoryLoading(false);
      }
    };

    run();
  }, [isClient, playerName]);

  const reloadHistory = async () => {
    if (typeof window === 'undefined') return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const id = profileStorage.getId();
      const name = profileStorage.getName() || playerName || '';
      if (!id && !name) {
        setHistory({ summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 }, attempts: [] });
        return;
      }
      const params = new URLSearchParams();
      if (id) params.set('playerId', id);
      if (name) params.set('name', name);
      const qs = params.toString();
      const r = await fetch(`http://localhost:5000/api/game/history?${qs}&limit=200`, { cache: 'no-store' });
      const data = await r.json();
      if (!data?.success) throw new Error(data?.error || 'failed');
      setHistory({
        summary: data.summary || { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 },
        attempts: Array.isArray(data.attempts) ? data.attempts : [],
      });
    } catch (e) {
      setHistoryError('โหลดสถิติ/กิจกรรมล่าสุดไม่ได้');
      setHistory({ summary: { totalTests: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 }, attempts: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteAttempt = async (att) => {
    try {
      const confirm = await Swal.fire({
        icon: 'warning',
        title: 'ลบกิจกรรมนี้?',
        text: 'การลบจะเอารายการนี้ออกจากประวัติการเล่น',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
      });
      if (!confirm.isConfirmed) return;

      const key = `${att?.roomId || 'room'}-${att?.timestamp || 'ts'}-${att?.playerId || att?.playerName || 'me'}`;
      setDeletingAttemptKey(key);

      const params = new URLSearchParams();
      const storedId = profileStorage.getId();
      if (att?.playerId) params.set('playerId', String(att.playerId));
      else if (att?.playerName) params.set('name', String(att.playerName));
      else if (storedId) params.set('playerId', String(storedId));
      else {
        const fallbackName = profileStorage.getName() || playerName || '';
        if (fallbackName) params.set('name', fallbackName);
      }
      if (att?.roomId) params.set('roomId', String(att.roomId));
      if (att?.timestamp) params.set('ts', String(att.timestamp));

      const token = (() => {
        try {
          return sessionStorage.getItem('token') || localStorage.getItem('token') || '';
        } catch {
          return '';
        }
      })();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await fetch(`http://localhost:5000/api/game/history?${params.toString()}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'ลบไม่สำเร็จ');
      }

      await Swal.fire({ icon: 'success', title: 'ลบแล้ว', timer: 900, showConfirmButton: false });
      await reloadHistory();
    } catch (e) {
      await Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setDeletingAttemptKey('');
    }
  };

  // เพิ่ม useEffect สำหรับโหลดข้อมูลเมื่อ component mount อีกครั้ง
  useEffect(() => {
    if (isClient) {
      const timer = setTimeout(() => {
        loadCharacterData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isClient]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      try {
        // Clear session-scoped auth to avoid cross-account bleed
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('username');
      } catch {}
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('selectedCharacter');
      localStorage.removeItem('selectedCharacterName');
      localStorage.removeItem('playerName');
      localStorage.removeItem('selectedCharacterImage');
      localStorage.removeItem('customCharacterImages');
      await Swal.fire({ icon: 'success', title: 'ออกจากระบบสำเร็จ', timer: 1200, showConfirmButton: false });
      router.push('/login');
    }
  };

  // Derived stats
  const attempts = Array.isArray(history?.attempts) ? history.attempts : [];
  const totalAttempts = Number.isFinite(history?.summary?.totalAttempts) ? history.summary.totalAttempts : attempts.length;
  const avgScore = Number.isFinite(history?.summary?.averageScore) ? history.summary.averageScore : 0;
  const bestRankEntry = attempts
    .filter(a => Number.isFinite(a?.rank) && Number.isFinite(a?.totalPlayers) && a.rank > 0 && a.totalPlayers > 0)
    .sort((a, b) => (a.rank - b.rank) || (a.totalPlayers - b.totalPlayers))[0];
  const rankLabel = bestRankEntry ? `${bestRankEntry.rank}/${bestRankEntry.totalPlayers}` : '-';
  const recentAttempts = attempts.slice(0, 5);

  const handleCharacterSelection = () => {
    router.push('/StudentDashboard/character');
  };

  // ฟังก์ชันเปิด modal แก้ไขข้อมูล
  const openEditProfile = () => {
    setTempPlayerName(playerName);
    setTempPlayerImage(characterImage);
    setShowEditProfile(true);
  };

  // ฟังก์ชันจัดการอัปโหลดรูปภาพ
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempPlayerImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ฟังก์ชันบันทึกข้อมูล
  const handleSaveProfile = () => {
    if (tempPlayerName.trim()) {
      setPlayerName(tempPlayerName);
      profileStorage.setName(tempPlayerName);
    }
    if (tempPlayerImage && tempPlayerImage !== characterImage) {
      setCharacterImage(tempPlayerImage);
      profileStorage.setImage(tempPlayerImage);
      localStorage.setItem('selectedCharacterImage', tempPlayerImage);
    }
    setShowEditProfile(false);
    setTempPlayerName("");
    setTempPlayerImage(null);
  };

  // ฟังก์ชันไปหน้าห้องเกม
  const handleGameRoom = () => {
    router.push('/StudentDashboard/gameroom');
  };

  // Component สำหรับแสดงรูปตัวละคร (ปรับดีไซน์ให้สวยและคมขึ้น พร้อมวงแหวนกราเดียนท์)
  const CharacterAvatar = ({ size = "w-16 h-16", showGlow = true, className = "" }) => {
    const [imageError, setImageError] = useState(false);
    const [usedCanvas, setUsedCanvas] = useState(false);
    const [frameUrl, setFrameUrl] = useState("");

    // Extract a single standing frame from sprite sheets so the avatar matches the full-body preview
    useEffect(() => {
      setUsedCanvas(false);
      setFrameUrl("");
      if (!characterImage) { setImageError(true); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const nW = img.naturalWidth || img.width || 0;
          const nH = img.naturalHeight || img.height || 0;
          // Robust sprite detection: treat wide images as 1-row strips; choose closest between 8 or 6 columns.
          let cols = 1, rows = 1;
          const aspect = nH > 0 ? (nW / nH) : 0;
          if (aspect >= 4) {
            const diff8 = Math.abs(aspect - 8);
            const diff6 = Math.abs(aspect - 6);
            cols = diff8 <= diff6 ? 8 : 6; rows = 1;
          } else if (aspect >= 2 && aspect < 4) {
            // Possibly 2 rows stacked
            const arPerRow = aspect * 2;
            const diff8 = Math.abs(arPerRow - 8);
            const diff6 = Math.abs(arPerRow - 6);
            cols = diff8 <= diff6 ? 8 : 6; rows = 2;
          }

          if (cols === 1 && rows === 1) { setUsedCanvas(false); return; } // not a grid -> use <img>

          // Use offscreen canvas so we don't depend on a DOM canvas element
          const canvas = document.createElement('canvas');
          // Pick a neutral standing frame from first row; prefer the 4th image if 8 cols
          const sW = Math.floor(nW / cols) || nW;
          const sH = Math.floor(nH / rows) || nH;
          let col = 0;
          if (cols >= 8) col = 3; // 4th (1-based)
          else if (cols === 6) col = 2; // 3rd (1-based)
          else col = Math.max(0, Math.min(cols - 1, Math.floor(cols / 2)));
          const sx = col * sW; const sy = 0;
          // Square canvas to fit circular mask nicely
          const CW = 256; const CH = 256;
          canvas.width = CW; canvas.height = CH;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0,0,CW,CH);
          const pad = 8;
          // Fit entire character inside the square while keeping full-body visible
          const scale = Math.min((CW - pad*2) / sW, (CH - pad*2) / sH);
          const w = Math.round(sW * scale); const h = Math.round(sH * scale);
          const x = Math.round((CW - w) / 2); const y = Math.round((CH - h) / 2);
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sW, sH, x, y, w, h);
          try { setFrameUrl(canvas.toDataURL('image/png')); } catch {}
          setUsedCanvas(true);
        } catch {
          setUsedCanvas(false);
        }
      };
      img.onerror = () => setImageError(true);
      img.src = characterImage;
    }, [characterImage]);

    return (
      <div className={`relative ${size} ${className}`}>
        {showGlow && (
          <div
            className="absolute -inset-1 rounded-full animate-spin"
            style={{
              background: 'conic-gradient(#a78bfa, #ec4899, #60a5fa, #a78bfa)',
              filter: 'blur(8px)',
              opacity: 0.6,
              animationDuration: '6s'
            }}
          />
        )}
        <div className="relative w-full h-full rounded-full p-[3px] bg-gradient-to-br from-purple-400 to-pink-500 shadow-xl">
          <div className="relative w-full h-full rounded-full overflow-hidden border border-white/30 bg-black/30 backdrop-blur-[2px]">
            {usedCanvas && frameUrl ? (
              <img src={frameUrl} alt={selectedCharacterName} className="w-full h-full object-cover" />
            ) : characterImage && !imageError ? (
              <img
                src={characterImage}
                alt={selectedCharacterName}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full select-none">
                <span className="text-2xl md:text-3xl">
                  {selectedCharacterEmoji}
                </span>
              </div>
            )}
            {/* glossy overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    );
  };

  // พรีวิวตัวละครแบบเต็มตัว (สัดส่วนแนวตั้ง เห็นทั้งตัว ไม่ครอป)
  const FullCharacterPreview = ({ widthClass = "w-28", heightClass = "h-44", className = "", standCol = 'center' }) => {
    const [imageError, setImageError] = useState(false);
    const [usedCanvas, setUsedCanvas] = useState(false);
    const [frameUrl, setFrameUrl] = useState("");

    useEffect(() => {
      setUsedCanvas(false);
      setFrameUrl("");
      if (!characterImage) { setImageError(true); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const nW = img.naturalWidth || img.width || 0;
          const nH = img.naturalHeight || img.height || 0;
          // Robust sprite detection: filename hints first, then aspect/size heuristics
          let cols = 1, rows = 1;
          const srcLower = String(characterImage).toLowerCase();
          if (srcLower.includes('8x1')) { cols = 8; rows = 1; }
          else if (srcLower.includes('6x1')) { cols = 6; rows = 1; }
          else if (srcLower.includes('8x2')) { cols = 8; rows = 2; }
          else if (srcLower.includes('6x2')) { cols = 6; rows = 2; }
          else if (srcLower.includes('sprite')) { cols = 8; rows = 1; }

          if (cols === 1 && rows === 1 && nW > 0 && nH > 0) {
            const aspect = nW / nH;
            if (aspect >= 4) {
              const diff8 = Math.abs(aspect - 8);
              const diff6 = Math.abs(aspect - 6);
              cols = diff8 <= diff6 ? 8 : 6; rows = 1;
            } else if (aspect >= 2 && aspect < 4) {
              const arPerRow = aspect * 2;
              const diff8 = Math.abs(arPerRow - 8);
              const diff6 = Math.abs(arPerRow - 6);
              cols = diff8 <= diff6 ? 8 : 6; rows = 2;
            }
          }

          if (cols === 1 && rows === 1) { setUsedCanvas(false); return; } // not a grid -> let <img> render

          // Use offscreen canvas to generate a single-frame image URL
          const canvas = document.createElement('canvas');
          // Choose first frame (standing) from first row
          const sW = Math.floor(nW / cols) || nW;
          const sH = Math.floor(nH / rows) || nH;
          // Pick a neutral standing frame; prefer the 4th image for 8 cols
          let col = 0;
          if (typeof standCol === 'number') col = Math.max(0, Math.min(cols - 1, Math.floor(standCol)));
          else if (cols >= 8) col = 3; else if (cols === 6) col = 2; else col = Math.max(0, Math.min(cols - 1, Math.floor(cols / 2)));
          const sx = col * sW; const sy = 0;
          // High-res internal size for crisp downscale
          const CW = 256; const CH = 384;
          canvas.width = CW; canvas.height = CH;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0,0,CW,CH);
          const pad = 10;
          const scale = Math.min((CW - pad*2) / sW, (CH - pad*2) / sH);
          const w = Math.round(sW * scale); const h = Math.round(sH * scale);
          const x = Math.round((CW - w) / 2); const y = Math.round((CH - h) / 2);
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sW, sH, x, y, w, h);
          try { setFrameUrl(canvas.toDataURL('image/png')); } catch {}
          setUsedCanvas(true);
        } catch {
          setUsedCanvas(false);
        }
      };
      img.onerror = () => setImageError(true);
      img.src = characterImage;
    }, [characterImage, standCol]);

    return (
      <div className={`relative ${widthClass} ${heightClass} ${className}`}>
        <div className="absolute -inset-[2px] rounded-2xl" style={{
          background: 'linear-gradient(135deg, rgba(167,139,250,0.8), rgba(236,72,153,0.8))'
        }} />
        <div className="relative w-full h-full rounded-2xl bg-white/5 border border-white/20 overflow-hidden backdrop-blur-sm flex items-center justify-center">
          {usedCanvas && frameUrl ? (
            <img src={frameUrl} alt={selectedCharacterName} className="w-full h-full object-contain p-2" />
          ) : characterImage && !imageError ? (
            <img
              src={characterImage}
              alt={selectedCharacterName}
              className="w-full h-full object-contain p-2"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-5xl select-none">{selectedCharacterEmoji}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
        </div>
      </div>
    );
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 mb-8 border border-white/10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/70 to-violet-500/70 border border-white/20 shadow-md">
              <span className="text-2xl">🎓</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-1 drop-shadow">แดชบอร์ดนักเรียน</h1>
              <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                <p className="text-pink-200 font-medium">ยินดีต้อนรับ {playerName}</p>
                <p className="text-blue-200 text-sm">ตัวละคร: {selectedCharacterName}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-3 px-6 md:px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border border-white/20"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Debug Info (hidden for cleaner UI) */}
      <div className="hidden">
        <p>
          Debug: Player = {playerName} | Character = {selectedCharacterName} ({selectedCharacterEmoji}) | 
          Image: {characterImage ? 'Custom' : 'Default'} | 
          local/session: {typeof window !== 'undefined' ? (sessionStorage.getItem('playerName') || localStorage.getItem('playerName') || 'none') : 'not available'}
        </p>
      </div>

      {/* Main Content Cards */}
      <div className="relative grid md:grid-cols-2 gap-6 mb-10">
        {/* แบบทดสอบ */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center transition-all duration-300 border border-white/10 group hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:-translate-y-1">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-all duration-300">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">แบบทดสอบ</h2>
          <p className="text-blue-200 mb-4">เข้าร่วมแบบทดสอบออนไลน์</p>
          <button 
            onClick={() => router.push('/StudentDashboard/gameroom')}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
          >
            เข้าร่วมแบบทดสอบ
          </button>
        </div>

        {/* เลือกตัวละคร */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center transition-all duration-300 border border-white/10 group hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:-translate-y-1">
          <FullCharacterPreview className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">เลือกตัวละคร</h2>
          <p className="text-pink-200 mb-2">จัดการตัวละครของคุณ</p>
          <p className="text-pink-300 text-sm mb-4">ปัจจุบัน: {selectedCharacterName}</p>
          <button 
            onClick={handleCharacterSelection}
            className="bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
          >
            แก้ไขตัวละคร
          </button>
        </div>
      </div>

      {/* ข้อมูลผู้เล่นและตัวละคร */}
      <div className="relative grid md:grid-cols-2 gap-6 mb-8">
        {/* ข้อมูลผู้เล่น */}
        <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-between drop-shadow-lg">
            <span className="flex items-center">
              <span className="mr-2">👤</span>
              ข้อมูลผู้เล่น
            </span>
            <button
              onClick={openEditProfile}
              className="text-pink-300 hover:text-pink-100 text-sm font-medium hover:underline transition-colors"
            >
              แก้ไข
            </button>
          </h3>
          <div>
            <p className="text-lg font-semibold text-white drop-shadow">{playerName}</p>
            <p className="text-blue-200">ตัวละคร: {selectedCharacterName}</p>
            {/* Removed image source line per user request */}
            <button
              onClick={openEditProfile}
              className="mt-2 text-xs text-pink-300 hover:text-pink-100 font-medium hover:underline transition-colors"
            >
              คลิกเพื่อแก้ไขข้อมูล
            </button>
          </div>
        </div>

        {/* สถิติการเล่น */}
        <div className="bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center drop-shadow-lg">
            <span className="mr-2">📊</span>
            สถิติการเล่น
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-500/20 rounded-xl border border-blue-400/30 backdrop-blur-sm">
              <div className="text-2xl font-bold text-blue-300">{historyLoading ? '…' : totalAttempts}</div>
              <div className="text-sm text-blue-200">แบบทดสอบที่ทำ</div>
            </div>
            <div className="text-center p-4 bg-green-500/20 rounded-xl border border-green-400/30 backdrop-blur-sm">
              <div className="text-2xl font-bold text-green-300">{historyLoading ? '…' : avgScore}</div>
              <div className="text-sm text-green-200">คะแนนเฉลี่ย</div>
            </div>
            <div className="text-center p-4 bg-pink-500/20 rounded-xl border border-pink-400/30 backdrop-blur-sm">
              <div className="text-2xl font-bold text-pink-300">{historyLoading ? '…' : rankLabel}</div>
              <div className="text-sm text-pink-200">อันดับ</div>
            </div>
          </div>

          {historyError && (
            <div className="mt-4 text-sm text-pink-200">
              {historyError}
            </div>
          )}
        </div>
      </div>

      {/* กิจกรรมล่าสุด */}
      <div className="relative bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20 mb-20">
        <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">กิจกรรมล่าสุด</h2>

        {historyLoading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-xl bg-white/10 border border-white/10 animate-pulse" />
            <div className="h-16 rounded-xl bg-white/10 border border-white/10 animate-pulse" />
            <div className="h-16 rounded-xl bg-white/10 border border-white/10 animate-pulse" />
          </div>
        ) : recentAttempts.length ? (
          <div className="space-y-3">
            {recentAttempts.map((att, idx) => {
              const when = att?.timestamp ? new Date(att.timestamp).toLocaleString('th-TH') : '';
              const rankText = (Number.isFinite(att?.rank) && Number.isFinite(att?.totalPlayers) && att.rank && att.totalPlayers)
                ? ` • อันดับ ${att.rank}/${att.totalPlayers}`
                : '';
              const delKey = `${att?.roomId || 'room'}-${att?.timestamp || idx}-${att?.playerId || att?.playerName || 'me'}`;
              return (
                <div key={`${att.roomId || 'room'}-${att.timestamp || idx}`} className="backdrop-blur-md bg-white/10 rounded-2xl p-4 border border-white/20 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{att.roomName || 'ห้องแบบทดสอบ'}</div>
                    <div className="text-blue-200 text-sm truncate">{att.questionSetTitle || 'ชุดข้อสอบ'}</div>
                    <div className="text-white/70 text-xs">{when}{rankText}</div>
                  </div>
                  <div className="text-right ml-4 shrink-0 flex flex-col items-end gap-2">
                    <div>
                      <div className="text-2xl font-bold text-green-300">{att.finalScore ?? 0}</div>
                      <div className="text-xs text-green-200">คะแนน</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteAttempt(att);
                      }}
                      disabled={historyLoading || deletingAttemptKey === delKey}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-200 border border-rose-400/30 hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingAttemptKey === delKey ? 'กำลังลบ…' : 'ลบ'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-white/20">
                <svg className="w-8 h-8 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
            </div>
            <p className="text-pink-200 text-lg font-medium drop-shadow">ยังไม่มีกิจกรรมล่าสุด</p>
            <p className="text-blue-200 mt-2">เริ่มทำแบบทดสอบเพื่อดูประวัติการทำงาน</p>
          </div>
        )}
      </div>

      {/* ปุ่มห้องเกม - ล่างขวา */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleGameRoom}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 flex items-center space-x-3 group border border-white/20"
        >
          <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-all duration-300">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L12 11l.707-.707A1 1 0 0113.414 10H15M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold">🎮 ห้องเกม</span>
          <div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse shadow-lg">
            NEW
          </div>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-white/90 to-white/80 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/20">
            <h3 className="text-xl font-bold text-gray-800 mb-4">แก้ไขข้อมูลผู้เล่น</h3>
            
            {/* Avatar Preview */}
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-4xl relative overflow-hidden shadow-lg">
                {tempPlayerImage && tempPlayerImage.startsWith('data:') ? (
                  <img 
                    src={tempPlayerImage} 
                    alt="Temp Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{selectedCharacterEmoji}</span>
                )}
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                ชื่อผู้เล่น
              </label>
              <input
                type="text"
                placeholder="กรอกชื่อผู้เล่น"
                value={tempPlayerName}
                onChange={(e) => setTempPlayerName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm bg-white/80"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                รูปโปรไฟล์
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm bg-white/80"
              />
              <p className="text-gray-500 text-xs mt-1">อัปโหลดรูปภาพ (JPG, PNG, GIF)</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowEditProfile(false);
                  setTempPlayerName("");
                  setTempPlayerImage(null);
                }}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}