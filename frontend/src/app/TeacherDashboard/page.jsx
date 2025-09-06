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
      <div className="min-h-screen p-8 bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E]">
        <div className="animate-pulse text-white text-lg font-bold bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          กำลังโหลด...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E]">
      {/* Header - combined background */}
      <div className="mb-8 flex flex-col items-start space-y-2 bg-white/90 backdrop-blur-sm px-8 py-5 rounded-2xl drop-shadow-[0_4px_16px_rgba(97,12,159,0.10)]">
        <h1 className="text-4xl font-bold text-[#610C9F] drop-shadow-[0_4px_8px_rgba(97,12,159,0.5)]">
          แดชบอร์ดครู
        </h1>
        <p className="text-xl text-[#940B92] font-semibold drop-shadow-[0_4px_8px_rgba(148,11,146,0.5)]">
          จัดการชุดคำถามและการทดสอบ
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] p-8 mb-8 transform hover:scale-[1.02] transition-all duration-300">
        <div className="text-3xl font-bold bg-gradient-to-r from-[#610C9F] to-[#940B92] text-transparent bg-clip-text">
          {questionSets.length} ชุดคำถาม
        </div>
        <p className="text-lg text-[#DA0C81] mt-2">ที่สร้างไว้ทั้งหมด</p>
      </div>

      {/* Action Button */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/create-new-set")}
          className="bg-gradient-to-r from-[#610C9F] to-[#940B92] text-white px-8 py-4 rounded-xl 
                    hover:from-[#940B92] hover:to-[#DA0C81] transition-all duration-300 
                    flex items-center gap-3 font-bold shadow-[0_4px_16px_rgba(97,12,159,0.3)]
                    transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <FiPlus className="w-6 h-6" />
          สร้างชุดคำถามใหม่
        </button>
      </div>

      {/* Question Sets Table */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(97,12,159,0.2)] overflow-hidden">
        <table className="min-w-full divide-y divide-[#F5F3FF]">
          <thead className="bg-gradient-to-r from-[#610C9F] to-[#940B92]">
            <tr>
              <th className="px-8 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                ชื่อชุดคำถาม
              </th>
              <th className="px-8 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                จำนวนคำถาม
              </th>
              <th className="px-8 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                วันที่สร้าง
              </th>
              <th className="px-8 py-4 text-right text-sm font-bold text-white uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/80 divide-y divide-[#F5F3FF]">
            {questionSets.map((set) => (
              <tr key={set._id} className="hover:bg-[#F5F3FF]/50 transition-colors duration-200">
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-base font-semibold text-[#610C9F]">{set.title}</div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-base text-[#940B92]">{set.questions.length} คำถาม</div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-base text-[#DA0C81]">
                    {new Date(set.createdAt).toLocaleDateString('th-TH')}
                  </div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => handleEdit(set._id)}
                      className="text-[#610C9F] hover:text-[#940B92] p-2 rounded-lg hover:bg-[#F5F3FF] transition-all"
                      title="แก้ไข"
                    >
                      <FiEdit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(set._id)}
                      className="text-[#DA0C81] hover:text-[#E95793] p-2 rounded-lg hover:bg-[#FFF1F6] transition-all"
                      title="ลบ"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
