'use strict';

/**
 * CABSSA Clubdesk — Vercel Serverless Function Adapter
 * Routes incoming serverless HTTP requests to the centralized backend request handler.
 */
const appHandler = require('../server.js');

module.exports = (req, res) => {
  return appHandler(req, res);
};
