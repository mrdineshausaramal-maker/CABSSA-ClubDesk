// End-to-End API Integration Test for CABSSA Clubdesk
const http = require('http');

async function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, text: raw });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== CABSSA CLUBDESK BACKEND AUTOMATED TESTS ===\n');

  // 1. Health check
  const health = await request('/api/health');
  console.log('1. Health Check:', health.status === 200 && health.body.status === 'HEALTHY' ? 'PASS' : 'FAIL', health.body);

  // 2. Admin Login
  const adminLogin = await request('/api/auth/login', 'POST', {
    emailOrPrn: 'admin@cabssa.internal',
    password: 'Cabssa@2026'
  });
  console.log('2. Admin Login:', adminLogin.status === 200 && adminLogin.body.user.role === 'ADMIN' ? 'PASS' : 'FAIL');
  const adminToken = adminLogin.body.token;

  // 3. Core Member Login
  const memberLogin = await request('/api/auth/login', 'POST', {
    emailOrPrn: 'member@cabssa.internal',
    password: 'Cabssa@2026'
  });
  console.log('3. Core Member Login:', memberLogin.status === 200 && memberLogin.body.user.role === 'CORE_MEMBER' ? 'PASS' : 'FAIL');
  const memberToken = memberLogin.body.token;

  // 4. Duplicate PRN rejection test
  const dupPrn = await request('/api/members', 'POST', {
    fullName: 'Duplicate PRN Test',
    email: 'newemail1@cabssa.internal',
    contactNumber: '+91 99999 11111',
    prnNumber: 'PRN202400199', // Already exists!
    rollNumber: '99CS99',
    academicYear: 'SY',
    division: 'B',
    designation: 'Core Team Member'
  }, adminToken);
  console.log('4. Duplicate PRN Rejection (Expect 409):', dupPrn.status === 409 ? 'PASS' : 'FAIL', dupPrn.body.error?.message);

  // 5. Duplicate Email rejection test
  const dupEmail = await request('/api/members', 'POST', {
    fullName: 'Duplicate Email Test',
    email: 'admin@cabssa.internal', // Already exists!
    contactNumber: '+91 99999 11111',
    prnNumber: 'PRN999999999',
    rollNumber: '99CS99',
    academicYear: 'SY',
    division: 'B',
    designation: 'Core Team Member'
  }, adminToken);
  console.log('5. Duplicate Email Rejection (Expect 409):', dupEmail.status === 409 ? 'PASS' : 'FAIL', dupEmail.body.error?.message);

  // 6. RBAC Member Creation Guard (Core member cannot create member)
  const forbiddenCreate = await request('/api/members', 'POST', {
    fullName: 'Illegal Member',
    email: 'illegal@cabssa.internal',
    contactNumber: '+91 99999 11111',
    prnNumber: 'PRN20268888',
    rollNumber: '88CS88',
    academicYear: 'SY',
    division: 'A',
    designation: 'Core Team Member'
  }, memberToken);
  console.log('6. RBAC Guard on Member Creation (Expect 403):', forbiddenCreate.status === 403 ? 'PASS' : 'FAIL');

  // 7. Successful Real Member Creation by Admin
  const testPrn = 'PRN' + Date.now().toString().slice(-8);
  const newMemberRes = await request('/api/members', 'POST', {
    fullName: 'Tanvi Deshmukh',
    email: `tanvi.${Date.now()}@cabssa.internal`,
    contactNumber: '+91 98220 44556',
    prnNumber: testPrn,
    rollNumber: '24CS61',
    academicYear: 'SY',
    division: 'B',
    designation: 'Core Team Member',
    domainId: '11111111-1111-1111-1111-111111111101',
    personalVehicle: true
  }, adminToken);
  console.log('7. Real Member Creation by Admin (Expect 201):', newMemberRes.status === 201 ? 'PASS' : 'FAIL', newMemberRes.body.data?.member_id);
  const createdMemberId = newMemberRes.body.data?.id;

  // 8. Verify Member Retrieval & Persistence
  const getMember = await request(`/api/members/${createdMemberId}`);
  console.log('8. Verify Member Exists & Matches Details:', getMember.status === 200 && getMember.body.data?.prn_number === testPrn ? 'PASS' : 'FAIL');

  // 9. Update Member Profile
  const updateMember = await request(`/api/members/${createdMemberId}`, 'PUT', {
    contactNumber: '+91 98220 99999',
    personalVehicle: false
  }, adminToken);
  console.log('9. Update Member Profile:', updateMember.status === 200 && updateMember.body.data?.contact_number === '+91 98220 99999' ? 'PASS' : 'FAIL');

  // 10. Create Fresh Event for QR Attendance Test
  const testEventRes = await request('/api/events', 'POST', {
    title: `Automated Test Event ${Date.now()}`,
    description: 'Automated reverse QR verification test session',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '12:00',
    location: 'Lab 1',
    status: 'Upcoming'
  }, adminToken);
  const testEventId = testEventRes.body.data?.id;

  // 11. Generate Time-Limited QR Attendance Session
  const qrSession = await request('/api/attendance/qr/create', 'POST', {
    event_id: testEventId,
    validity_minutes: 30
  }, adminToken);
  console.log('10. Generate Time-Limited QR Attendance Session:', qrSession.status === 201 ? 'PASS' : 'FAIL', qrSession.body.data?.token);
  const qrToken = qrSession.body.data?.token;

  // 12. Core Member Scans QR Code
  const scanAttendance = await request('/api/attendance/qr/scan', 'POST', {
    token: qrToken
  }, memberToken);
  console.log('11. Member Scans QR & Marks Attendance (Expect 201):', scanAttendance.status === 201 ? 'PASS' : 'FAIL', scanAttendance.body.message);

  // 13. Duplicate Attendance Scan Prevention
  const dupScan = await request('/api/attendance/qr/scan', 'POST', {
    token: qrToken
  }, memberToken);
  console.log('12. Duplicate Attendance Prevention (Expect 409):', dupScan.status === 409 ? 'PASS' : 'FAIL', dupScan.body.error?.message);

  // 13. Task Status Update by Assignee
  const taskUpdate = await request('/api/tasks/55555555-5555-5555-5555-555555555501/status', 'PATCH', {
    status: 'Completed'
  }, memberToken);
  console.log('13. Member Updates Own Task Status to Completed:', taskUpdate.status === 200 && taskUpdate.body.data?.status === 'Completed' ? 'PASS' : 'FAIL');

  // 14. MoM Retrieval
  const meetings = await request('/api/meetings');
  console.log('14. Minutes of Meeting List:', meetings.status === 200 && meetings.body.data.length > 0 ? 'PASS' : 'FAIL');

  // 15. Reports Summary
  const summary = await request('/api/reports/summary');
  console.log('15. Reports & Aggregations Summary:', summary.status === 200 ? 'PASS' : 'FAIL', summary.body.data?.members);

  console.log('\n=== ALL 15 AUTOMATED INTEGRATION TESTS COMPLETED ===');
}

runTests().catch(console.error);
