"use client";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
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
    const res = await Swal.fire({
      title: "ยืนยันการลบ?",
      text: "การลบนี้ไม่สามารถย้อนกลับได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
    });
    if (res.isConfirmed) {
      try {
        await axios.delete(`http://localhost:5000/api/questions/sets/${setId}`);
        await Swal.fire({ icon: "success", title: "ลบสำเร็จ", timer: 1200, showConfirmButton: false });
        fetchQuestionSets(); // รีเฟรชข้อมูล
      } catch (err) {
        console.error("Error deleting question set:", err);
        await Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ", text: err.response?.data?.error || err.message });
      }
    }
  };

  const handleEdit = (setId) => {
    router.push(`/create-new-set?edit=${setId}`);
  };

  const handleCreateRoom = async (setId) => {
    try {
      const response = await axios.post('http://localhost:5000/api/rooms', {
        questionSetId: setId,
        name: `ห้องสำหรับชุดคำถาม`,
        isActive: true
      });
      
      // Redirect ไปหน้าจัดการห้องของครู
      router.push(`/teacher-room/${response.data._id}`);
      
    } catch (err) {
      console.error("Error creating room:", err);
      await Swal.fire({
        icon: 'error',
        title: 'สร้างห้องไม่สำเร็จ',
        text: err.response?.data?.error || err.message
      });
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    await Swal.fire({ icon: 'success', title: 'ออกจากระบบสำเร็จ', timer: 1200, showConfirmButton: false });
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
    <div 
      className="min-h-screen p-8 relative overflow-hidden" 
      style={{
        background: 'linear-gradient(to bottom, #030637 0%, #180161 50%, #FF204E 100%)'
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header Section */}
      <div className="relative z-10 mb-10">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-white/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500 rounded-3xl flex items-center justify-center shadow-2xl">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-pink-500 rounded-full border-3 border-white animate-pulse flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 bg-clip-text text-transparent mb-2">
                  แดชบอร์ดครู
                </h1>
                <p className="text-pink-200 text-xl font-medium flex items-center space-x-2">
                  <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>จัดการแบบทดสอบและการเรียนรู้</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="group relative bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-red-500/25 transform hover:scale-105 flex items-center space-x-3"
            >
              <svg className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-lg">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="relative z-10 grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-10">
        <div className="group bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-2xl rounded-2xl p-6 border border-white/10 shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-4xl font-bold text-white mb-2">{questionSets.length}</h3>
              <p className="text-blue-200 font-semibold text-lg">ชุดคำถามทั้งหมด</p>
              <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mt-2"></div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-2xl rounded-2xl p-6 border border-white/10 shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-4xl font-bold text-white mb-2">156</h3>
              <p className="text-purple-200 font-semibold text-lg">นักเรียนที่เข้าร่วม</p>
              <div className="w-12 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mt-2"></div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-pink-500/20 to-red-500/20 backdrop-blur-2xl rounded-2xl p-6 border border-white/10 shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-4xl font-bold text-white mb-2">87%</h3>
              <p className="text-pink-200 font-semibold text-lg">คะแนนเฉลี่ย</p>
              <div className="w-12 h-1 bg-gradient-to-r from-pink-400 to-red-400 rounded-full mt-2"></div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-2xl rounded-2xl p-6 border border-white/10 shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-4xl font-bold text-white mb-2">24</h3>
              <p className="text-red-200 font-semibold text-lg">การทดสอบวันนี้</p>
              <div className="w-12 h-1 bg-gradient-to-r from-red-400 to-orange-400 rounded-full mt-2"></div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Question Set Button */}
      <div className="relative z-10 mb-10">
        <div className="flex justify-center">
          <button
            onClick={() => router.push('/create-new-set')}
            className="group relative bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 hover:from-pink-500 hover:via-purple-600 hover:to-blue-600 text-white font-bold py-6 px-12 rounded-3xl transition-all duration-300 shadow-2xl hover:shadow-pink-500/25 transform hover:scale-110 flex items-center space-x-6"
          >
            <div className="bg-white/20 p-4 rounded-2xl group-hover:bg-white/30 group-hover:rotate-180 transition-all duration-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold">สร้างชุดคำถามใหม่</div>
              <div className="text-pink-100">เริ่มต้นสร้างแบบทดสอบ</div>
            </div>
            <div className="absolute -top-3 -right-3 bg-pink-500 text-white text-sm font-bold rounded-full w-12 h-12 flex items-center justify-center animate-bounce shadow-xl">
              NEW!
            </div>
            
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-pink-600/50 to-purple-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
          </button>
        </div>
      </div>

      {/* Question Sets Section */}
      <div className="relative z-10">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">ชุดคำถามของฉัน</h2>
                  <p className="text-pink-100 text-lg">จัดการและแก้ไขชุดคำถามทั้งหมด</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{questionSets.length}</div>
                <div className="text-pink-200">ชุดคำถาม</div>
              </div>
            </div>
          </div>

          {questionSets.length === 0 ? (
            <div className="p-16 text-center">
              <div className="relative mb-8">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-16 h-16 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-pink-500/5 rounded-full blur-2xl animate-pulse"></div>
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">ยังไม่มีชุดคำถาม</h3>
              <p className="text-pink-200 text-xl mb-8 max-w-md mx-auto">เริ่มต้นสร้างชุดคำถามแรกของคุณและเปิดประสบการณ์การเรียนรู้ใหม่!</p>
              <button
                onClick={() => router.push('/create-new-set')}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-4 px-10 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
              >
                เริ่มสร้างเลย →
              </button>
            </div>
          ) : (
            <div className="p-8">
              <div className="grid gap-6">
                {questionSets.map((set, index) => (
                  <div key={set._id} className="group relative bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-2xl">
                            {index + 1}
                          </div>
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white group-hover:text-blue-300 transition-colors mb-2">{set.title}</h3>
                          <p className="text-blue-200 text-lg mb-2">{set.description || "ไม่มีรายละเอียด"}</p>
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-2 text-blue-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>สร้างเมื่อ {new Date(set.createdAt).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => handleEdit(set._id)}
                          className="group/btn bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                        >
                          <svg className="w-5 h-5 group-hover/btn:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>แก้ไข</span>
                        </button>
                        <button
                          onClick={() => handleCreateRoom(set._id)}
                          className="group/btn bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                        >
                          <svg className="w-5 h-5 group-hover/btn:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>สร้างห้อง</span>
                        </button>
                        <button
                          onClick={() => handleDelete(set._id)}
                          className="group/btn bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                        >
                          <svg className="w-5 h-5 group-hover/btn:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>ลบ</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Hover Effect Background */}
                    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}