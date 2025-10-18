import { Suspense } from 'react';
import TeacherGameView from '../../components/TeacherGameView'

export default function TeacherGamePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังโหลดหน้าครู...</p>
      </div>
    </div>}>
      <TeacherGameView />
    </Suspense>
  );
}