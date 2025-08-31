const express = require('express');
const router = express.Router();

// Health check endpoint with detailed system information
router.get('/', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    version: process.version,
    platform: process.platform
  };

  res.status(200).json(healthCheck);
});

// Database connectivity check
router.get('/db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState === 1) {
      res.status(200).json({
        status: 'OK',
        database: 'Connected',
        connection: mongoose.connection.name || 'ucn-community'
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        database: 'Disconnected',
        readyState: mongoose.connection.readyState
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      database: 'Connection failed',
      error: error.message
    });
  }
});

module.exports = router;