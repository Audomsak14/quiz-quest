"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { FiEdit, FiTrash2, FiPlus } from "react-icons/fi";

export default function TeacherDashboard() {
  const router = useRouter();
  const [questionSets, setQuestionSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuestionSets();
  }, []);

  const fetchQuestionSets = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/questions/sets");
      setQuestionSets(res.data);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse text-center">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ดครู</h1>
        <p className="text-gray-600 mt-2">จัดการชุดคำถามและการทดสอบ</p>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="text-2xl font-semibold text-gray-800">
          {questionSets.length} ชุดคำถาม
        </div>
        <p className="text-gray-600">ที่สร้างไว้ทั้งหมด</p>
      </div>

      {/* Action Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/create-new-set")}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <FiPlus className="w-5 h-5" />
          สร้างชุดคำถามใหม่
        </button>
      </div>

      {/* Question Sets Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ชื่อชุดคำถาม
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                จำนวนคำถาม
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                วันที่สร้าง
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questionSets.map((set) => (
              <tr key={set._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{set.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{set.questions.length} คำถาม</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(set.createdAt).toLocaleDateString('th-TH')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(set._id)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    <FiEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(set._id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
