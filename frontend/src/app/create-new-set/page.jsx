"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { FiSave, FiX, FiPlus } from "react-icons/fi";

export default function CreateNewSet() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", choices: ["", "", "", ""], correct: 0 }]);
  const [scorePerQuestion, setScorePerQuestion] = useState(1);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  useEffect(() => {
    if (editId) {
      fetchQuestionSet();
    }
  }, [editId]);

  const fetchQuestionSet = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/questions/sets/${editId}`);
      setTitle(res.data.title);
      setQuestions(res.data.questions);
      setScorePerQuestion(res.data.scorePerQuestion);
      setTimePerQuestion(res.data.timePerQuestion);
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

    setIsLoading(true);
    try {
      if (editId) {
        await axios.put(`http://localhost:5000/api/questions/sets/${editId}`, {
          title,
          questions,
          scorePerQuestion,
          timePerQuestion
        });
      } else {
        await axios.post("http://localhost:5000/api/questions/sets", {
          title,
          questions,
          scorePerQuestion,
          timePerQuestion
        });
      }
      router.push("/TeacherDashboard");
    } catch (err) {
      console.error("Error saving question set:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8" style={{
      background: 'linear-gradient(to bottom, #030637 0%, #180161 50%, #FF204E 100%)'
    }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#610C9F] drop-shadow-lg bg-white/80 px-4 py-2 rounded-xl">
          {editId ? "แก้ไขชุดคำถาม" : "สร้างชุดคำถามใหม่"}
        </h1>
        
      </div>
      <div className="flex gap-8">
        {/* Sidebar: รายการข้อคำถาม */}
        <div className="w-64 min-w-[200px]">
          <div className="sticky top-24">
            {/* ปุ่มเพิ่มคำถามใหม่ */}
            <div className="mb-6">
              <button
                onClick={handleAddQuestion}
                className="w-full py-4 border-2 border-dashed border-[#610C9F] rounded-lg text-[#610C9F] hover:border-[#DA0C81] hover:text-[#E95793] transition-colors flex items-center justify-center gap-2 font-bold text-lg shadow-lg bg-white/80"
              >
                <FiPlus className="w-6 h-6" />
                เพิ่มคำถามใหม่
              </button>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="font-bold mb-2 text-[#DA0C81]">ข้อคำถามทั้งหมด</div>
              <div className="flex flex-col gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedQuestionIndex(idx)}
                    className={`w-full text-left px-4 py-2 rounded-lg border font-bold transition-colors ${selectedQuestionIndex === idx ? 'bg-[#DA0C81] text-white border-[#DA0C81]' : 'bg-transparent text-[#E95793] border-[#DA0C81] hover:bg-white hover:text-[#940B92]'}`}
                  >
                    {`ข้อที่ ${idx + 1}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Main Form: แสดงรายละเอียดเฉพาะข้อที่เลือก */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
          {/* ชื่อชุดคำถาม */}
          <div className="mb-6">
            <label className="block text-base font-bold text-[#610C9F] mb-2">
              ชื่อชุดคำถาม
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-md text-[#610C9F] font-semibold bg-white placeholder-[#DA0C81]"
              placeholder="ใส่ชื่อชุดคำถาม"
            />
          </div>

          {/* แสดงรายละเอียดข้อที่เลือก */}
          {questions[selectedQuestionIndex] && (
            <div className="mb-8 p-4 border rounded-lg bg-[#F5F3FF]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#610C9F]">คำถามที่ {selectedQuestionIndex + 1}</h3>
                <button
                  onClick={() => handleRemoveQuestion(selectedQuestionIndex)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* อัพโหลดรูปภาพ */}
              <div className="mb-4">
                <label className="block text-[#940B92] font-bold mb-2">รูปภาพคำถาม (ถ้ามี)</label>
                <label htmlFor={`file-upload-${selectedQuestionIndex}`} className="flex items-center justify-center gap-2 px-6 py-3 bg-[#DA0C81] text-white rounded-lg cursor-pointer hover:bg-[#E95793] font-bold shadow mb-2 transition-colors">
                  <FiPlus className="w-5 h-5" />
                  เพิ่มไฟล์รูปภาพ
                  <input
                    id={`file-upload-${selectedQuestionIndex}`}
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          handleQuestionChange(selectedQuestionIndex, "image", ev.target.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {questions[selectedQuestionIndex].image && (
                  <div className="flex flex-col items-center my-4 gap-2">
                    <img src={questions[selectedQuestionIndex].image} alt="question" className="max-w-full h-64 object-contain rounded-lg border shadow" />
                    <button
                      type="button"
                      onClick={() => handleQuestionChange(selectedQuestionIndex, "image", null)}
                    className="px-4 py-2 bg-[#E95793] text-white rounded-lg hover:bg-[#DA0C81] font-bold"
                    >
                      ลบรูปภาพ
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <textarea
                  value={questions[selectedQuestionIndex].text}
                  onChange={(e) => handleQuestionChange(selectedQuestionIndex, "text", e.target.value)}
                  className="w-full p-2 border rounded-md text-[#940B92] font-semibold bg-white placeholder-[#DA0C81]"
                  placeholder="ใส่คำถาม"
                  rows={2}
                />
              </div>

              <div className="mb-4 flex items-center gap-2">
                {/* Object/Icon selector inline */}
                <div className="flex flex-col items-center gap-1 min-w-[110px]">
                  <select
                    value={questions[selectedQuestionIndex].icon || ""}
                    onChange={e => handleQuestionChange(selectedQuestionIndex, "icon", e.target.value)}
                    className="px-2 py-1 rounded-lg border text-[#610C9F] font-bold bg-white hover:bg-[#F5F3FF] cursor-pointer"
                  >
                    <option value="">เลือกอ็อบเจกต์</option>
                    <option value="/globe.svg">Globe</option>
                    <option value="/window.svg">Window</option>
                    <option value="/file.svg">File</option>
                  </select>
                  {questions[selectedQuestionIndex].icon && (
                    <img
                      src={questions[selectedQuestionIndex].icon}
                      alt="icon-object"
                      className="w-8 h-8 object-contain rounded border shadow mt-1"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {questions[selectedQuestionIndex].choices.map((choice, cIndex) => (
                  <div key={cIndex} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`correct-${selectedQuestionIndex}`}
                      checked={questions[selectedQuestionIndex].correct === cIndex}
                      onChange={() => handleQuestionChange(selectedQuestionIndex, "correct", cIndex)}
                    />
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => 
                        handleQuestionChange(selectedQuestionIndex, "choice", [cIndex, e.target.value])
                      }
                      className="flex-1 p-2 border rounded-md text-[#E95793] font-semibold bg-white placeholder-[#610C9F]"
                      placeholder={`ตัวเลือกที่ ${cIndex + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ปุ่มบันทึก */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => router.push("/TeacherDashboard")}
              className="px-6 py-2 border rounded-lg hover:bg-[#F5F3FF] text-[#DA0C81] font-bold"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-[#610C9F] text-white px-6 py-2 rounded-lg hover:bg-[#940B92] transition-colors disabled:bg-[#DA0C81] flex items-center gap-2 font-bold"
            >
              <FiSave className="w-5 h-5" />
              {isLoading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
        {/* Right Sidebar: ปรับแต่งคะแนนและเวลา */}
        <div className="w-64 min-w-[200px]">
          <div className="sticky top-24 bg-white rounded-lg shadow p-6 flex flex-col gap-6">
            {/* กำหนดจำนวนข้อในชุดคำถาม (moved here) */}
            <div className="mb-2 bg-white/80 rounded-lg shadow p-4 flex flex-col gap-2">
              <div className="font-bold text-[#610C9F] mb-1">กำหนดจำนวนข้อในชุดคำถาม</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg font-bold border transition-colors ${questions.length === 5 ? 'bg-[#DA0C81] text-white border-[#DA0C81]' : 'bg-white text-[#610C9F] border-[#610C9F] hover:bg-[#F5F3FF]'}`}
                  onClick={() => setQuestions(Array(5).fill().map((_, i) => questions[i] || { text: '', choices: ['', '', '', ''], correct: 0 }))}
                >
                  5 ข้อ
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg font-bold border transition-colors ${questions.length === 10 ? 'bg-[#DA0C81] text-white border-[#DA0C81]' : 'bg-white text-[#610C9F] border-[#610C9F] hover:bg-[#F5F3FF]'}`}
                  onClick={() => setQuestions(Array(10).fill().map((_, i) => questions[i] || { text: '', choices: ['', '', '', ''], correct: 0 }))}
                >
                  10 ข้อ
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg font-bold border transition-colors ${questions.length !== 5 && questions.length !== 10 ? 'bg-[#DA0C81] text-white border-[#DA0C81]' : 'bg-white text-[#610C9F] border-[#610C9F] hover:bg-[#F5F3FF]'}`}
                  onClick={() => {}} // ไม่จำกัดจำนวน
                >
                  กำหนดเอง
                </button>
              </div>
              <div className="text-sm text-[#940B92] mt-1">ขณะนี้: {questions.length} ข้อ</div>
            </div>
            {/* คะแนนต่อข้อ */}
            <div>
              <label className="block text-base font-bold text-[#940B92] mb-2">คะแนนต่อข้อ</label>
              <input
                type="number"
                min={0}
                value={scorePerQuestion || 1}
                onChange={e => setScorePerQuestion(Number(e.target.value))}
                className="w-full p-2 border rounded-md text-[#940B92] font-semibold bg-white placeholder-[#DA0C81]"
              />
            </div>
            {/* เวลาต่อข้อ */}
            <div>
              <label className="block text-base font-bold text-[#E95793] mb-2">เวลาต่อข้อ (วินาที)</label>
              <input
                type="number"
                min={0}
                value={timePerQuestion || 30}
                onChange={e => setTimePerQuestion(Number(e.target.value))}
                className="w-full p-2 border rounded-md text-[#E95793] font-semibold bg-white placeholder-[#610C9F]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
