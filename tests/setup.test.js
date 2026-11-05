const http = require('http');

function get(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
  });
}

async function test() {
  const status = await get('/api/auth/setup-status');
  console.log('Setup Status:', status);
  const health = await get('/api/health');
  console.log('Database Counts:', health.counts);
}

test();
