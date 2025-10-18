"use client";
import { Suspense } from 'react';
import MapGame from "../../components/MapGameNew";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังโหลด...</p>
      </div>
    </div>}>
      <MapGame />
    </Suspense>
  );
}
