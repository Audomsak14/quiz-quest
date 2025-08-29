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
  const [description, setDescription] = useState("");
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
      setDescription(res.data.description);
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
          description,
          questions,
          scorePerQuestion,
          timePerQuestion
        });
      } else {
        await axios.post("http://localhost:5000/api/questions/sets", {
          title,
          description,
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
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-800">
          {editId ? "แก้ไขชุดคำถาม" : "สร้างชุดคำถามใหม่"}
        </h1>
        <p className="text-lg text-blue-700 mt-2 font-semibold">กรอกรายละเอียดชุดคำถามด้านล่าง</p>
      </div>
      <div className="flex gap-8">
        {/* Sidebar: รายการข้อคำถาม */}
        <div className="w-64 min-w-[200px]">
          <div className="sticky top-24">
            <div className="mb-6">
              <button
                onClick={handleAddQuestion}
                className="w-full py-4 border-2 border-dashed border-blue-400 rounded-lg text-blue-700 hover:border-blue-600 hover:text-blue-900 transition-colors flex items-center justify-center gap-2 font-bold text-lg shadow-sm bg-white"
              >
                <FiPlus className="w-6 h-6" />
                เพิ่มคำถามใหม่
              </button>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="font-bold text-blue-800 mb-2">ข้อคำถามทั้งหมด</div>
              <div className="flex flex-col gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedQuestionIndex(idx)}
                    className={`w-full text-left px-4 py-2 rounded-lg border font-bold transition-colors ${selectedQuestionIndex === idx ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'}`}
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
            <label className="block text-base font-bold text-blue-900 mb-2">
              ชื่อชุดคำถาม
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-md text-blue-900 font-semibold bg-blue-50 placeholder-blue-400"
              placeholder="ใส่ชื่อชุดคำถาม"
            />
          </div>

          {/* คำอธิบายชุดคำถาม */}
          <div className="mb-6">
            <label className="block text-base font-bold text-blue-900 mb-2">
              คำอธิบายชุดคำถาม
            </label>
            <textarea
              value={description || ""}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2 border rounded-md text-blue-900 font-semibold bg-blue-50 placeholder-blue-400"
              placeholder="คำอธิบายชุดคำถาม"
              rows={2}
            />
          </div>

          {/* แสดงรายละเอียดข้อที่เลือก */}
          {questions[selectedQuestionIndex] && (
            <div className="mb-8 p-4 border rounded-lg bg-blue-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-blue-800">คำถามที่ {selectedQuestionIndex + 1}</h3>
                <button
                  onClick={() => handleRemoveQuestion(selectedQuestionIndex)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* อัพโหลดรูปภาพ */}
              <div className="mb-4">
                <label className="block text-blue-900 font-bold mb-2">รูปภาพคำถาม (ถ้ามี)</label>
                <input
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
                  className="mb-2"
                />
                {questions[selectedQuestionIndex].image && (
                  <div className="flex flex-col items-center my-4 gap-2">
                    <img src={questions[selectedQuestionIndex].image} alt="question" className="max-w-full h-64 object-contain rounded-lg border shadow" />
                    <button
                      type="button"
                      onClick={() => handleQuestionChange(selectedQuestionIndex, "image", null)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
                    >
                      ลบรูปภาพ
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={questions[selectedQuestionIndex].text}
                  onChange={(e) => handleQuestionChange(selectedQuestionIndex, "text", e.target.value)}
                  className="w-full p-2 border rounded-md text-blue-900 font-semibold bg-white placeholder-blue-400"
                  placeholder="ใส่คำถาม"
                />
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
                      className="flex-1 p-2 border rounded-md text-blue-900 font-semibold bg-white placeholder-blue-400"
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
              className="px-6 py-2 border rounded-lg hover:bg-blue-50 text-blue-700 font-bold"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2 font-bold"
            >
              <FiSave className="w-5 h-5" />
              {isLoading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
        {/* Right Sidebar: ปรับแต่งคะแนนและเวลา */}
        <div className="w-64 min-w-[200px]">
          <div className="sticky top-24 bg-white rounded-lg shadow p-6 flex flex-col gap-6">
            <div>
              <label className="block text-base font-bold text-blue-900 mb-2">คะแนนต่อข้อ</label>
              <input
                type="number"
                min={0}
                value={scorePerQuestion || 1}
                onChange={e => setScorePerQuestion(Number(e.target.value))}
                className="w-full p-2 border rounded-md text-blue-900 font-semibold bg-blue-50 placeholder-blue-400"
              />
            </div>
            <div>
              <label className="block text-base font-bold text-blue-900 mb-2">เวลาต่อข้อ (วินาที)</label>
              <input
                type="number"
                min={0}
                value={timePerQuestion || 30}
                onChange={e => setTimePerQuestion(Number(e.target.value))}
                className="w-full p-2 border rounded-md text-blue-900 font-semibold bg-blue-50 placeholder-blue-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
