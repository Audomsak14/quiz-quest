'use client';

import { useState } from "react";
import axios from "axios";

export default function Register() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");

  const handleRegister = async () => {
    try {
      await axios.post("http://localhost:5000/api/register", { username, password });
      alert("สมัครสำเร็จ!");
    } catch (err) {
      alert("สมัครไม่สำเร็จ: " + err.response?.data?.error);
    }
  };

  return (
    <div className="p-8">
      <h1>สมัครสมาชิก</h1>
      <input placeholder="Username" onChange={e => setUser(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} />
      <button onClick={handleRegister}>Register</button>
    </div>
  );
}