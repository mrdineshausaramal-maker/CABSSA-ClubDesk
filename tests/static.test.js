const http = require('http');

const files = [
  '/',
  '/logo.png',
  '/js/config.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/modules/dashboard.js',
  '/js/modules/members.js',
  '/js/modules/domains.js',
  '/js/modules/events.js',
  '/js/modules/attendance.js',
  '/js/modules/meetings.js',
  '/js/modules/tasks.js',
  '/js/modules/reports.js',
  '/js/modules/activity.js',
  '/js/modules/settings.js',
  '/js/app.js'
];

let checked = 0;
files.forEach(p => {
  http.get('http://localhost:3000' + p, res => {
    console.log(p.padEnd(30), '-> Status:', res.statusCode, 'Content-Type:', res.headers['content-type']);
    checked++;
    if (checked === files.length) {
      console.log('\nAll static files successfully served by Node engine!');
    }
  });
});
