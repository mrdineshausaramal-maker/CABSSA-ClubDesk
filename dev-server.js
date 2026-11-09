'use strict';

/**
 * CABSSA Clubdesk — Local Development Server
 * Runs HTTP server on port 3000 and serves static files + REST API
 */
const http = require('node:http');
const handleRequest = require('./api/_server.js');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`CABSSA Clubdesk — Internal Club Management System`);
  console.log(`Local Development Server running at:`);
  console.log(`- http://localhost:${PORT}`);
  console.log(`- http://127.0.0.1:${PORT}`);
  console.log(`=======================================================`);
});
