// Update: HospitaLink-be/src/app.js - Fix CORS settings
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const app = express();
const prisma = new PrismaClient();

// ⚠️ FIX CORS - More permissive for development
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'ngrok-skip-browser-warning'],
}));

// Add preflight handling
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

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
const queueRoutes = require('./routes/mobile/queueRoute');
const consultationRoutes = require('./routes/mobile/consultationRoute');
const MobileConsultationRoutes = require('./routes/mobile/consultationRoute');
const transactionRoutes = require('./routes/transactionRoute');
const mobileTransactionRoutes = require('./routes/mobile/transactionRoute');

// Import web routes
const webDoctorRoutes = require('./routes/web/doctor');
const webAdminRoutes = require('./routes/web/admin');

// Import mobile routes
const mobileDashboardRoutes = require('./routes/mobile/dashboardRoute');
const mobileNotificationRoutes = require('./routes/mobile/notificationRoute');
const medicalHistoryRoutes = require('./routes/mobile/medicalHistoryRoute');
const qrRoutes = require('./routes/mobile/qrRoute');
const prescriptionRoutes = require('./routes/mobile/prescriptionRoute');
const transactionController = require('./controllers/transactionController');
const directConsultationRoutes = require('./routes/mobile/directConsultationRoute');

// API Routes (Mobile) - Add transaction routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/mobile/consultations', MobileConsultationRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/dashboard', mobileDashboardRoutes); 
app.use('/api/notifications', mobileNotificationRoutes);
app.use('/api/mobile/medical-history', medicalHistoryRoutes);
app.use('/api/mobile/prescriptions', prescriptionRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/mobile/direct-consultation', directConsultationRoutes);

// Transaction routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/mobile/transactions', mobileTransactionRoutes);

// Legacy routes for backward compatibility
app.use('/api/medical-records', medicalHistoryRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// web hooks midtrans
app.post('/api/midtrans/notification', transactionController.handleMidtransNotification);
app.post('/api/transactions/midtrans/notification', transactionController.handleMidtransNotification);
app.post('/api/mobile/transactions/midtrans/notification', transactionController.handleMidtransNotification);

// Web Routes (Dashboard) - Add logging
app.use('/api/web/doctor', (req, res, next) => {
  console.log('🩺 Doctor route hit:', req.method, req.path);
  next();
}, webDoctorRoutes);

app.use('/api/web/admin', (req, res, next) => {
  console.log('👨‍💼 Admin route hit:', req.method, req.path);
  next();
}, webAdminRoutes);

// API info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'HospitalLink API v1.0',
    endpoints: {
      health: '/health',
      mobile: {
        auth: '/api/auth',
        users: '/api/users',
        consultations: '/api/consultations',
        queues: '/api/queues',
        medicalHistory: '/api/mobile/medical-history',
        prescriptions: '/api/mobile/prescriptions',
        dashboard: '/api/dashboard',
        notifications: '/api/notifications',
        qr: '/api/qr',
      },
      web: {
        doctor: '/api/web/doctor',
        admin: '/api/web/admin',
      }
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 Route not found:', req.method, req.originalUrl);
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