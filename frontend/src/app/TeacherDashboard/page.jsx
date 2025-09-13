"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function TeacherDashboard() {
  const router = useRouter();
  const [questionSets, setQuestionSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuestionSets();
  }, []);

  const fetchQuestionSets = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/questions/sets");
      setQuestionSets(response.data);
    } catch (err) {
      console.error("Error fetching question sets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (setId) => {
    if (window.confirm("คุณแน่ใจหรือไม่ที่จะลบชุดคำถามนี้?")) {
      try {
        await axios.delete(`http://localhost:5000/api/questions/sets/${setId}`);
        fetchQuestionSets(); // รีเฟรชข้อมูล
      } catch (err) {
        console.error("Error deleting question set:", err);
      }
    }
  };

  const handleEdit = (setId) => {
    router.push(`/create-new-set?edit=${setId}`);
  };

  const handleLogout = () => {
    // ลบข้อมูลการเข้าสู่ระบบ
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // แจ้งเตือนและไปหน้า login
    alert('ออกจากระบบสำเร็จ');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-6">
      {/* Header with Logout Button */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">แดชบอร์ดครู</h1>
            <p className="text-gray-700 font-medium">จัดการชุดคำถามและการทดสอบ</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{questionSets.length} ชุดคำถาม</h2>
        <p className="text-gray-700 font-medium">พีสร้างไว้ทั้งหมด</p>
      </div>

      {/* Create New Question Set Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/create-new-set')}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
        >
          ➕ สร้างชุดคำถามใหม่
        </button>
      </div>

      {/* Question Sets Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
          <div className="grid grid-cols-4 gap-4 font-semibold">
            <div>ชื่อชุดคำถาม</div>
            <div>รายละเอียด</div>
            <div>วันที่สร้าง</div>
            <div>จัดการ</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {questionSets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">ยังไม่มีชุดคำถาม</p>
              <p>เริ่มต้นโดยการสร้างชุดคำถามแรกของคุณ</p>
            </div>
          ) : (
            questionSets.map((set) => (
              <div key={set._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="font-semibold text-gray-900">{set.title}</div>
                  <div className="text-gray-700">{set.description || "ไม่มีรายละเอียด"}</div>
                  <div className="text-gray-600">
                    {new Date(set.createdAt).toLocaleDateString('th-TH')}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(set._id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(set._id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}