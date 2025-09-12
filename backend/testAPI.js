const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAPI() {
  console.log('🔥 Starting API tests...\n');
  
  try {
    // Test 1: สมัครสมาชิก
    console.log('📝 Test 1: สมัครสมาชิก');
    const registerData = {
      username: 'testuser123',
      email: 'test@example.com',
      password: '123456'
    };
    
    console.log('Sending register data:', registerData);
    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
    console.log('✅ สมัครสมาชิกสำเร็จ:', registerResponse.data);
    console.log('');

    // Test 2: Login เป็น Student
    console.log('🎓 Test 2: Login เป็น Student');
    const loginStudentData = {
      username: 'testuser123',
      password: '123456',
      role: 'student'
    };
    
    console.log('Sending login data:', loginStudentData);
    const loginStudentResponse = await axios.post(`${API_URL}/auth/login`, loginStudentData);
    console.log('✅ Login เป็น Student สำเร็จ:', loginStudentResponse.data);
    console.log('');

    // Test 3: Login เป็น Teacher
    console.log('👨‍🏫 Test 3: Login เป็น Teacher');
    const loginTeacherData = {
      username: 'testuser123',
      password: '123456',
      role: 'teacher'
    };
    
    console.log('Sending login data:', loginTeacherData);
    const loginTeacherResponse = await axios.post(`${API_URL}/auth/login`, loginTeacherData);
    console.log('✅ Login เป็น Teacher สำเร็จ:', loginTeacherResponse.data);
    console.log('');

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('URL:', error.config?.url);
      console.error('Method:', error.config?.method?.toUpperCase());
    } else if (error.request) {
      console.error('❌ Network Error: No response received');
      console.error('Request:', error.request);
    } else {
      console.error('❌ Error:', error.message);
    }
    console.error('\n🔧 Make sure the server is running on http://localhost:5000');
  }
}

testAPI();