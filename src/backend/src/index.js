#!/usr/bin/env node

/**
 * Hsinchu Pass Safety Guardian API Server
 * Entry point for the backend application
 */

const { Application } = require('./app');

// Create and start the application
const application = new Application();
const port = process.env.PORT || 3000;

// Start the server
application.start(port);