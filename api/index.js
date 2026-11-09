'use strict';

/**
 * CABSSA Clubdesk — Root API Vercel Serverless Function
 * Handles requests to /api
 */
const handleRequest = require('./_server.js');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
