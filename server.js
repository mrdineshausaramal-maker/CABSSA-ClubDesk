'use strict';

/**
 * CABSSA Clubdesk — Internal Club Management System
 * Production Full-Stack Server & Vercel Serverless Function
 */
const http = require('node:http');
const handleRequest = require('./api/_server.js');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`CABSSA Clubdesk — Internal Club Management System`);
    console.log(`Full-Stack Node.js Engine & REST API running at:`);
    console.log(`- http://localhost:${PORT}`);
    console.log(`- http://127.0.0.1:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = handleRequest;
