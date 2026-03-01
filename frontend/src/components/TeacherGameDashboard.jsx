"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import socketManager from '../lib/socket';

export default function TeacherGameDashboard() {
  const searchParams = useSearchParams();
  const params = useParams();
  // Try to get roomId from URL params first, then from query parameters
  const roomId = params?.roomId || searchParams.get('roomId');
  
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [students, setStudents] = useState([]);
  const [gameProgress, setGameProgress] = useState({});
  
  // All available questions
  const allQuestions = [
    { id: 'q1', text: 'What is the capital of Japan?' },
    { id: 'q2', text: 'Which planet is known as the Red Planet?' },
    { id: 'q3', text: 'What is 2 + 2?' },
    { id: 'q4', text: 'Which language runs in a web browser?' },
    { id: 'q5', text: 'What does HTML stand for?' }
  ];

  useEffect(() => {
    if (!roomId) return;

    socketManager.connect();
    
    socketManager.on('connected', () => {
      const success = socketManager.joinRoom(roomId, 'Teacher', 'teacher');
      setIsConnected(success);
    });

    socketManager.on('roomState', (data) => {
      setRoomData(data);
      if (data.players) {
        const studentPlayers = data.players.filter(p => p.role !== 'teacher');
        setStudents(studentPlayers);
      }
    });

    socketManager.on('playerJoined', (data) => {
      if (data.role !== 'teacher') {
        setStudents(prev => {
          const existing = prev.find(s => s.playerId === data.playerId);
          if (existing) return prev;
          return [...prev, data];
        });
      }
    });

    socketManager.on('playerMoved', (data) => {
      setStudents(prev => prev.map(student => 
        student.playerId === data.playerId 
          ? { ...student, x: data.x, y: data.y }
          : student
      ));
    });

    socketManager.on('questionAnswered', (data) => {
      setGameProgress(prev => ({
        ...prev,
        [data.playerId]: {
          ...prev[data.playerId],
          [data.questionId]: {
            selectedIndex: data.selectedIndex,
            correct: data.correct,
            earned: data.earned,
            timestamp: data.timestamp
          }
        }
      }));
      
      // Update student score
      setStudents(prev => prev.map(student => 
        student.playerId === data.playerId 
          ? { ...student, score: (student.score || 0) + data.earned }
          : student
      ));
    });

    return () => {
      socketManager.disconnect();
    };
  }, [roomId]);

  const getStudentProgress = (playerId) => {
    const progress = gameProgress[playerId] || {};
    const answered = Object.keys(progress).length;
    const totalScore = Object.values(progress).reduce((sum, q) => sum + (q.earned || 0), 0);
    return { answered, totalScore, progress };
  };

  const getQuestionStats = (questionId) => {
    const studentAnswers = students.map(student => {
      const progress = gameProgress[student.playerId] || {};
      return progress[questionId];
    }).filter(Boolean);
    
    const totalAnswered = studentAnswers.length;
    const correctAnswers = studentAnswers.filter(a => a.correct).length;
    
    return { totalAnswered, correctAnswers };
  };

  const handleStartGame = async () => {
    console.log('🎮 Starting game...', { isConnected, roomId });
    
    if (!isConnected || !roomId) {
      console.log('❌ Cannot start game - not connected or no roomId');
      return;
    }
    
    try {
      console.log('📡 Calling backend API to update room status...');
      // Call backend API to start the game
  const token = (typeof window !== 'undefined') ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const response = await fetch(`http://localhost:5000/api/rooms/${roomId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'active' }),
      });
      
      console.log('📡 Backend API response:', response.status, response.statusText);
      
      if (response.ok) {
        console.log('🚀 Emitting startGame socket event...');
        // Emit socket event to notify all players
        if (socketManager.getSocket()) {
          socketManager.getSocket().emit('startGame', { roomId });
          console.log('✅ startGame event emitted successfully');
        } else {
          console.log('❌ No socket connection available');
        }
      } else {
        const errorData = await response.text();
        console.log('❌ Backend API error:', errorData);
      }
    } catch (error) {
      console.error('❌ Error starting game:', error);
    }
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">ไม่พบรหัสห้อง</h1>
          <p className="text-gray-600">กรุณาเข้าจากลิงก์ที่มีรหัสห้องที่ถูกต้อง</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Teacher Dashboard</h1>
            <p className="text-gray-600">ห้อง: {roomId}</p>
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-2">ลิงก์สำหรับนักเรียน:</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={typeof window !== 'undefined' ? `${window.location.origin}/lobby?roomId=${roomId}&playerName=Student` : `http://localhost:3000/lobby?roomId=${roomId}&playerName=Student`}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm"
                />
                <button 
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? `${window.location.origin}/lobby?roomId=${roomId}&playerName=Student` : `http://localhost:3000/lobby?roomId=${roomId}&playerName=Student`;
                    navigator.clipboard?.writeText(url);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                  คัดลอก
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                🟢 เชื่อมต่อแล้ว
              </div>
            )}
          </div>
        </div>
        
        {/* Game Control */}
        <div className="mt-4 flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            roomData?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            สถานะ: {roomData?.status === 'active' ? '🎮 เกมเริ่มแล้ว' : '⏳ รอเริ่มเกม'}
          </div>
          
          {roomData?.status !== 'active' && (
            <button
              onClick={handleStartGame}
              disabled={!isConnected || students.length === 0}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              🚀 เริ่มเกม
            </button>
          )}
          
          {students.length === 0 && (
            <p className="text-sm text-gray-500">รอนักเรียนเข้าร่วมก่อนเริ่มเกม</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students Overview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">นักเรียน ({students.length})</h2>
          <div className="space-y-3">
            {students.map(student => {
              const { answered, totalScore } = getStudentProgress(student.playerId);
              return (
                <div key={student.playerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {student.playerName?.[0] || 'S'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{student.playerName}</div>
                      <div className="text-sm text-gray-500">
                        ตำแหน่ง: ({Math.round(student.x || 0)}, {Math.round(student.y || 0)})
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{totalScore} แต้ม</div>
                    <div className="text-sm text-gray-500">{answered}/{allQuestions.length} ข้อ</div>
                  </div>
                </div>
              );
            })}
            {students.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                รอนักเรียนเข้าร่วม...
              </div>
            )}
          </div>
        </div>

        {/* Question Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">สถิติคำถาม</h2>
          <div className="space-y-4">
            {allQuestions.map(question => {
              const { totalAnswered, correctAnswers } = getQuestionStats(question.id);
              const correctPercentage = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
              
              return (
                <div key={question.id} className="border rounded-lg p-4">
                  <div className="font-medium text-gray-800 mb-2">{question.text}</div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">ตอบแล้ว: {totalAnswered}/{students.length}</span>
                    <span className="text-sm text-gray-600">ถูก: {correctPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${students.length > 0 ? (totalAnswered / students.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${correctPercentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Student Progress */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">ความคืบหน้าของนักเรียนแต่ละคน</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">นักเรียน</th>
                <th className="text-center p-3">คะแนนรวม</th>
                {allQuestions.map(q => (
                  <th key={q.id} className="text-center p-3 min-w-[80px]">
                    {q.id.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const { totalScore, progress } = getStudentProgress(student.playerId);
                return (
                  <tr key={student.playerId} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{student.playerName}</td>
                    <td className="p-3 text-center font-bold text-green-600">{totalScore}</td>
                    {allQuestions.map(q => {
                      const answer = progress[q.id];
                      return (
                        <td key={q.id} className="p-3 text-center">
                          {answer ? (
                            <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-sm font-bold ${
                              answer.correct ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                              {answer.correct ? '✓' : '✗'}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full mx-auto bg-gray-300"></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">กิจกรรมล่าสุด</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {/* This would show real-time activities */}
          <div className="text-gray-500 text-sm">
            กิจกรรมจะแสดงที่นี่เมื่อนักเรียนตอบคำถาม...
          </div>
        </div>
      </div>
    </div>
  );
}