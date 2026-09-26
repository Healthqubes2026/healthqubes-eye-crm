const http = require('http');
const fs = require('fs');

const postData = JSON.stringify({
  email: 'admin@healthqubes.in',
  password: 'NewPassword123'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const output = `STATUS: ${res.statusCode}\nBODY: ${data}\n`;
    fs.writeFileSync('login_test_result.txt', output, 'utf-8');
    console.log('Result written to login_test_result.txt');
  });
});

req.on('error', (e) => {
  const output = `ERROR: ${e.message}\n`;
  fs.writeFileSync('login_test_result.txt', output, 'utf-8');
  console.log('Error result written to login_test_result.txt');
});

req.write(postData);
req.end();