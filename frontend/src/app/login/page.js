'use client';

import { useState } from "react";
import axios from "axios";

export default function Login() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [role, setRole] = useState("student");

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/login", { username, password, role });
      alert("ล็อกอินสำเร็จ! Role: " + res.data.role);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
    } catch (err) {
      alert("ล็อกอินไม่สำเร็จ: " + err.response?.data?.error);
    }
  };

  return (
    <div className="p-8">
      <h1>Login</h1>
      <input placeholder="Username" onChange={e => setUser(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} />
      
      {/* เลือก role ตอน login */}
      <select onChange={e => setRole(e.target.value)} value={role}>
        <option value="teacher">Teacher</option>
        <option value="student">Student</option>
      </select>

      <button onClick={handleLogin}>Login</button>
    </div>
  );
}