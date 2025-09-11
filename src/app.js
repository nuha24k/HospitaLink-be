const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Add cookie parser
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Add cookie parser middleware

// Create upload directories if they don't exist
const uploadDirs = ['uploads', 'uploads/profiles'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HospitalLink Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Import routes
const authRoutes = require('./routes/authRoute');
const userRoutes = require('./routes/userRoute');
const queueRoutes = require('./routes/queueRoute');
const consultationRoutes = require('./routes/consultationRoute');

// Import web routes
const webDoctorRoutes = require('./routes/web/doctor');

// API Routes (Mobile)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/queues', queueRoutes);

// Web Routes (Dashboard)
app.use('/api/web/doctor', webDoctorRoutes);

// API info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'HospitalLink API v1.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      consultations: '/api/consultations',
      queues: '/api/queues',
      webDoctor: '/api/web/doctor',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = { app, prisma };