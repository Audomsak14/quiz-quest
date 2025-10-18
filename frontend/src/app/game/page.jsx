"use client";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import GamePage from "../../components/GamePage";
import TeacherGameView from "../../components/TeacherGameView";
import MapGameNew from "../../components/MapGameNew";
import SideScrollerQuiz from "../../components/SideScrollerQuiz";

function GameContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  
  // If teacher role, show teacher dashboard
  if (role === 'teacher') {
    // Use the unified TeacherGameView to keep data/events in sync with student clients
    return <TeacherGameView />;
  }
  
  // If student role, check if they want map-based or quiz-based game
  const gameMode = searchParams.get('mode') || 'side';
  
  if (gameMode === 'quiz') {
    // Traditional quiz mode
    return <GamePage />;
  }
  if (gameMode === 'side') {
    return <SideScrollerQuiz />;
  }
  
  // Default fallback: Zep-like map
  return <MapGameNew />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังโหลด...</p>
      </div>
    </div>}>
      <GameContent />
    </Suspense>
  );
}
