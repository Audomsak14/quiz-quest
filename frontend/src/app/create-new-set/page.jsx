"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { FiSave, FiX, FiPlus } from "react-icons/fi";

function CreateNewSetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", choices: ["", "", "", ""], correct: 0 }]);
  const [scorePerQuestion, setScorePerQuestion] = useState(1);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState("/map1.png"); // default map

  useEffect(() => {
    if (editId) {
      fetchQuestionSet();
    }
  }, [editId]);

  const fetchQuestionSet = async () => {
    try {
  const res = await axios.get(`http://localhost:5000/api/questions/sets/${editId}`);
      setTitle(res.data.title);
      // map กลับเป็นรูปแบบที่ใช้ในฟอร์ม จากสคีม backend (question, options, correctAnswer, points)
      setQuestions(
        (res.data.questions || []).map((q) => ({
          text: q.question,
          choices: q.options || ["", "", "", ""],
          correct:
            (q.options || []).findIndex((opt) => opt === q.correctAnswer) ?? 0,
        }))
      );
      // กรณี backend เก็บคะแนนต่อข้อในแต่ละคำถาม ใช้ค่าของข้อแรกเป็นค่าเริ่มต้น
      setScorePerQuestion(res.data.questions?.[0]?.points ?? 1);
      setTimePerQuestion(res.data.timeLimit ?? 30);
      setSelectedMap(res.data.map || "/map1.png");
    } catch (err) {
      console.error("Error fetching question set:", err);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", choices: ["", "", "", ""], correct: 0 }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    if (field === "choice") {
      const [choiceIndex, choiceValue] = value;
      newQuestions[index].choices[choiceIndex] = choiceValue;
    } else {
      newQuestions[index][field] = value;
    }
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    if (!title) {
      alert("กรุณาใส่ชื่อชุดคำถาม");
      return;
    }

    if (questions.some(q => !q.text || q.choices.some(c => !c))) {
      alert("กรุณากรอกคำถามและตัวเลือกให้ครบ");
      return;
    }

    // เตรียมข้อมูลให้ตรงกับ schema backend
    const questionsForBackend = questions.map((q) => ({
      question: q.text,
      type: "multiple-choice",
      options: q.choices,
      correctAnswer: q.choices[q.correct],
      points: scorePerQuestion,
    }));

    // ระบุผู้สร้างจาก localStorage ถ้ามี ไม่งั้นใช้ 'anonymous'
    let createdBy = "anonymous";
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const user = JSON.parse(rawUser);
        createdBy = user?.username || user?.email || user?._id || "anonymous";
      }
    } catch {}

    setIsLoading(true);
    try {
      const payload = {
        title,
        description: "",
        questions: questionsForBackend,
        timeLimit: timePerQuestion,
        createdBy,
        // ฟิลด์ที่ UI ใช้ ซึ่ง backend จะไม่รู้จัก (strict) แต่ไม่กระทบการบันทึก
        map: selectedMap,
      };

      if (editId) {
        await axios.put(
          `http://localhost:5000/api/questions/sets/${editId}`,
          payload
        );
      } else {
        await axios.post("http://localhost:5000/api/questions/sets", payload);
      }
      router.push("/TeacherDashboard");
    } catch (err) {
      console.error("Error saving question set:", err);
      const backendMsg = err?.response?.data?.error || err?.response?.data?.message;
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล" + (backendMsg ? `: ${backendMsg}` : ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030637] via-[#180161] to-[#FF204E] p-8 relative overflow-hidden">
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-r from-pink-500/15 to-purple-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 right-10 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-10 left-1/3 w-72 h-72 bg-gradient-to-r from-purple-500/15 to-pink-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-20 right-1/3 w-60 h-60 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-pink-400/60 rounded-full animate-bounce delay-300"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-blue-400/60 rounded-full animate-bounce delay-700"></div>
        <div className="absolute top-1/2 left-3/4 w-2 h-2 bg-purple-400/60 rounded-full animate-bounce delay-1000"></div>
      </div>

      {/* Enhanced Header with gradient border */}
      <div className="relative mb-10">
        <div className="bg-gradient-to-br from-pink-500/15 via-purple-500/15 to-blue-500/15 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-white/30 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                <svg className="w-8 h-8 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white drop-shadow-2xl">
                  {editId ? "✨ แก้ไขชุดคำถาม" : "🎯 สร้างชุดคำถามใหม่"}
                </h1>
                <p className="text-pink-200 mt-2 drop-shadow-lg">ออกแบบและสร้างแบบทดสอบที่น่าสนใจ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Back Button */}
              <button
                onClick={() => router.push('/TeacherDashboard')}
                className="flex items-center gap-3 text-white hover:text-pink-300 transition-colors duration-300 group bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/20 hover:border-pink-300/50 shadow-xl hover:shadow-pink-500/25"
              >
                <div className="p-2 rounded-full bg-white/10 group-hover:bg-pink-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
                <span className="font-medium">ย้อนกลับ</span>
              </button>
              
              {/* Progress indicator */}
              <div className="flex flex-col items-end gap-2">
                <div className="text-sm text-blue-200 drop-shadow">ความคืบหน้า</div>
                <div className="flex gap-1">
                  <div className={`w-3 h-3 rounded-full ${title ? 'bg-green-400' : 'bg-white/20'} transition-colors duration-300`}></div>
                  <div className={`w-3 h-3 rounded-full ${questions.some(q => q.text) ? 'bg-green-400' : 'bg-white/20'} transition-colors duration-300`}></div>
                  <div className={`w-3 h-3 rounded-full ${questions.every(q => q.text && q.choices.every(c => c)) ? 'bg-green-400' : 'bg-white/20'} transition-colors duration-300`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex gap-8">
        {/* Enhanced Sidebar: รายการข้อคำถาม */}
        <div className="w-80 min-w-[280px]">
          <div className="sticky top-24 space-y-6">
            {/* Enhanced ปุ่มเพิ่มคำถามใหม่ */}
            <div className="group">
              <button
                onClick={handleAddQuestion}
                className="w-full py-5 border-2 border-dashed border-pink-400/40 rounded-3xl text-pink-200 hover:border-purple-400/60 hover:text-white transition-all duration-500 flex items-center justify-center gap-3 font-bold text-lg shadow-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-2xl hover:scale-105 transform relative overflow-hidden"
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000"></div>
                
                <div className="relative flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
                    <FiPlus className="w-5 h-5 text-white" />
                  </div>
                  เพิ่มคำถามใหม่
                </div>
              </button>
            </div>
            
            {/* Enhanced Question List */}
            <div className="bg-gradient-to-br from-blue-500/15 via-purple-500/15 to-pink-500/15 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 border border-white/30 relative overflow-hidden">
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-400 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg text-white drop-shadow-lg">ข้อคำถามทั้งหมด</h3>
                  <div className="ml-auto bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-1 rounded-full text-sm text-pink-200 backdrop-blur-sm border border-white/20">
                    {questions.length} ข้อ
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto scrollbar-hide">
                  {questions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedQuestionIndex(idx)}
                      className={`group relative w-full text-left px-5 py-4 rounded-2xl border font-bold transition-all duration-500 transform hover:scale-[1.02] ${
                        selectedQuestionIndex === idx 
                          ? 'bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-blue-500/30 text-white border-pink-400/60 shadow-2xl scale-[1.02]' 
                          : 'bg-white/5 text-pink-200 border-white/20 hover:bg-white/10 hover:text-white backdrop-blur-sm hover:border-white/40'
                      }`}
                    >
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                            selectedQuestionIndex === idx 
                              ? 'bg-gradient-to-br from-pink-400 to-purple-400 shadow-lg' 
                              : 'bg-white/10 group-hover:bg-white/20'
                          }`}>
                            <span className="text-sm font-bold">{idx + 1}</span>
                          </div>
                          <span>ข้อที่ {idx + 1}</span>
                        </div>
                        
                        <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                          q.text && q.choices.every(c => c) ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-yellow-400/60'
                        }`}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Continue with the rest of the form... */}
        <div className="flex-1">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl p-10 border border-white/30">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-400 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <label className="text-xl font-bold text-white drop-shadow-lg">
                  ชื่อชุดคำถาม
                </label>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-5 border border-white/20 rounded-2xl text-white font-semibold bg-white/10 backdrop-blur-sm placeholder-pink-200 focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all duration-500 shadow-xl"
                placeholder="ใส่ชื่อชุดคำถามที่น่าสนใจ..."
              />
            </div>

            {/* Question details would continue here... */}
            {questions[selectedQuestionIndex] && (
              <div className="mb-8 p-6 border border-white/20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white drop-shadow">คำถามที่ {selectedQuestionIndex + 1}</h3>
                  <button
                    onClick={() => handleRemoveQuestion(selectedQuestionIndex)}
                    className="text-red-300 hover:text-red-100 transition-colors p-2 rounded-lg hover:bg-red-500/20"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <textarea
                    value={questions[selectedQuestionIndex].text}
                    onChange={(e) => handleQuestionChange(selectedQuestionIndex, "text", e.target.value)}
                    className="w-full p-4 border border-white/20 rounded-xl text-white font-semibold bg-white/10 backdrop-blur-sm placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
                    placeholder="ใส่คำถาม"
                    rows={3}
                  />
                </div>

                <div className="space-y-4">
                  {questions[selectedQuestionIndex].choices.map((choice, cIndex) => (
                    <div key={cIndex} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                      <input
                        type="radio"
                        name={`correct-${selectedQuestionIndex}`}
                        checked={questions[selectedQuestionIndex].correct === cIndex}
                        onChange={() => handleQuestionChange(selectedQuestionIndex, "correct", cIndex)}
                        className="w-5 h-5 text-pink-500 focus:ring-pink-400"
                      />
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => 
                          handleQuestionChange(selectedQuestionIndex, "choice", [cIndex, e.target.value])
                        }
                        className="flex-1 p-3 border border-white/20 rounded-xl text-white font-semibold bg-white/10 backdrop-blur-sm placeholder-purple-200 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300"
                        placeholder={`ตัวเลือกที่ ${cIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                onClick={() => router.push("/TeacherDashboard")}
                className="px-8 py-3 border border-white/30 rounded-xl hover:bg-white/10 text-pink-200 hover:text-white font-bold backdrop-blur-sm transition-all duration-300 transform hover:scale-105"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-8 py-3 rounded-xl transition-all duration-300 disabled:from-gray-500 disabled:to-gray-600 flex items-center gap-2 font-bold shadow-lg transform hover:scale-105 border border-white/20"
              >
                <FiSave className="w-5 h-5" />
                {isLoading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-64 min-w-[200px]">
          <div className="sticky top-24 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 flex flex-col gap-6 border border-white/20">
            <div className="mb-6">
              <label className="block text-lg font-bold text-white mb-3 drop-shadow">เลือกแมพ</label>
              <select
                value={selectedMap}
                onChange={e => setSelectedMap(e.target.value)}
                className="w-full p-3 border border-white/20 rounded-xl text-white font-semibold bg-white/10 backdrop-blur-sm hover:bg-white/20 cursor-pointer mb-3 focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all duration-300"
              >
                <option value="/map1.png" className="bg-gray-800">แมพป่า (Forest)</option>
                <option value="/map2.png" className="bg-gray-800">แมพทะเล (Sea)</option>
                <option value="/map3.png" className="bg-gray-800">แมพเมือง (City)</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-bold text-purple-200 mb-3 drop-shadow">คะแนนต่อข้อ</label>
              <input
                type="number"
                min={0}
                value={scorePerQuestion || 1}
                onChange={e => setScorePerQuestion(Number(e.target.value))}
                className="w-full p-3 border border-white/20 rounded-xl text-white font-semibold bg-white/10 backdrop-blur-sm placeholder-purple-200 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300"
              />
            </div>

            <div>
              <label className="block text-lg font-bold text-blue-200 mb-3 drop-shadow">เวลาต่อข้อ (วินาที)</label>
              <input
                type="number"
                min={0}
                value={timePerQuestion || 30}
                onChange={e => setTimePerQuestion(Number(e.target.value))}
                className="w-full p-3 border border-white/20 rounded-xl text-white font-semibold bg-white/10 backdrop-blur-sm placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Hide all scrollbars */}
      <style jsx global>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Hide all scrollbars globally */
        * {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none;  /* IE and Edge */
        }
        
        *::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        /* Ensure html and body also hide scrollbars */
        html, body {
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default function CreateNewSet() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <CreateNewSetContent />
    </Suspense>
  );
}
