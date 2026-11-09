'use strict';

/**
 * CABSSA Clubdesk — Catch-all Vercel Serverless Function
 * Handles all requests under /api/*
 */
const handleRequest = require('./_server.js');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
