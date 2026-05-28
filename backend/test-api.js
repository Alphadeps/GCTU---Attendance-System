/**
 * Test API to check lecturer assignments in production
 */

const axios = require('axios');

const API_URL = 'https://class-attendance-backend-o80x.onrender.com/api';

async function test() {
  try {
    console.log('🔍 Testing production API...\n');

    // 1. Login as lecturer
    console.log('1. Logging in as Godfred Fokuo...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'Godfred Fokuo',
      password: 'gctuLecturer123!'
    });
    
    const token = loginRes.data.accessToken;
    console.log('✅ Logged in successfully\n');

    // 2. Get lecturer's classes
    console.log('2. Fetching lecturer classes...');
    const classesRes = await axios.get(`${API_URL}/lecturer/my-classes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Found ${classesRes.data.length} class assignments:`);
    classesRes.data.forEach(c => {
      console.log(`   - ${c.classDisplayName} | ${c.courseName} (${c.courseCode})`);
    });
    console.log('');

    // 3. Get pending reports
    console.log('3. Fetching pending reports...');
    const reportsRes = await axios.get(`${API_URL}/reports/pending`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Found ${reportsRes.data.length} pending reports:`);
    reportsRes.data.forEach(r => {
      console.log(`   - ${r.course.name} | ${r.class.displayName}`);
    });
    console.log('');

    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

test();
