const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Generate token for web sessions
const generateWebToken = (userId, role = 'DOCTOR') => {
  return jwt.sign(
    { userId, platform: 'web', role }, 
    process.env.JWT_SECRET || 'hospitalink-secret', 
    { expiresIn: '8h' }
  );
};

// Doctor login for web dashboard
const loginDoctorWeb = async (req, res) => {
  try {
    const { nik, email, password, fingerprintData } = req.body;

    console.log('🌐 Doctor web login attempt:', { nik, email, hasFingerprint: !!fingerprintData });

    // Fingerprint login
    if (fingerprintData) {
      const user = await prisma.user.findFirst({
        where: { 
          fingerprintData: fingerprintData.trim(),
          role: 'DOCTOR',
          isActive: true
        },
        include: {
          doctorProfile: true
        }
      });

      if (!user || !user.doctorProfile) {
        return res.status(401).json({
          success: false,
          message: 'Fingerprint not recognized or doctor profile not found',
        });
      }

      const token = generateWebToken(user.id, 'DOCTOR'); // Fix: Add role parameter
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      res.cookie('doctorToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Doctor web login successful',
        data: { 
          doctor: {
            id: user.doctorProfile.id,
            name: user.doctorProfile.name,
            specialty: user.doctorProfile.specialty,
            isOnDuty: user.doctorProfile.isOnDuty,
            userId: user.id,
            role: 'DOCTOR'
          },
          loginMethod: 'fingerprint'
        },
      });
    }

    // NIK + Password login
    if (nik && password) {
      if (!/^\d{16}$/.test(nik)) {
        return res.status(400).json({
          success: false,
          message: 'NIK must be exactly 16 digits',
        });
      }

      const user = await prisma.user.findFirst({
        where: { 
          nik: nik.trim(),
          role: 'DOCTOR',
          isActive: true
        },
        include: {
          doctorProfile: true
        }
      });

      if (!user || !user.doctorProfile) {
        return res.status(401).json({
          success: false,
          message: 'Invalid NIK or doctor profile not found',
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password',
        });
      }

      const token = generateWebToken(user.id, 'DOCTOR'); // Fix: Add role parameter
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      res.cookie('doctorToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Doctor web login successful',
        data: { 
          doctor: {
            id: user.doctorProfile.id,
            name: user.doctorProfile.name,
            specialty: user.doctorProfile.specialty,
            isOnDuty: user.doctorProfile.isOnDuty,
            userId: user.id,
            role: 'DOCTOR'
          },
          loginMethod: 'nik'
        },
      });
    }

    // Email + Password login
    if (email && password) {
      const user = await prisma.user.findFirst({
        where: { 
          email: email.toLowerCase(),
          role: 'DOCTOR',
          isActive: true
        },
        include: {
          doctorProfile: true
        }
      });

      if (!user || !user.doctorProfile) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or doctor profile not found',
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password',
        });
      }

      const token = generateWebToken(user.id, 'DOCTOR'); // Fix: Add role parameter
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      res.cookie('doctorToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Doctor web login successful',
        data: { 
          doctor: {
            id: user.doctorProfile.id,
            name: user.doctorProfile.name,
            specialty: user.doctorProfile.specialty,
            isOnDuty: user.doctorProfile.isOnDuty,
            userId: user.id,
            role: 'DOCTOR'
          },
          loginMethod: 'email'
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Please provide NIK/Email and password, or fingerprint data',
    });

  } catch (error) {
    console.error('Doctor web login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message // Add error detail for debugging
    });
  }
};

// Logout doctor web
const logoutDoctorWeb = async (req, res) => {
  try {
    res.clearCookie('doctorToken');
    res.json({
      success: true,
      message: 'Doctor logged out successfully'
    });
  } catch (error) {
    console.error('Doctor logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// Get doctor dashboard data
const getDoctorDashboard = async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's queue statistics
    const queueStats = await prisma.queue.aggregate({
      where: {
        doctorId: doctor.id,
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        id: true,
      },
    });

    const completedToday = await prisma.queue.count({
      where: {
        doctorId: doctor.id,
        status: 'COMPLETED',
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const waitingToday = await prisma.queue.count({
      where: {
        doctorId: doctor.id,
        status: 'WAITING',
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Get pending online consultations
    const pendingConsultations = await prisma.consultation.count({
      where: {
        doctorId: doctor.id,
        type: 'CHAT_DOCTOR',
        isCompleted: false,
      },
    });

    // Get current patient if on duty
    let currentPatient = null;
    if (doctor.isOnDuty) {
      currentPatient = await prisma.queue.findFirst({
        where: {
          doctorId: doctor.id,
          status: 'IN_PROGRESS',
        },
        include: {
          user: {
            select: {
              fullName: true,
              nik: true,
              gender: true,
              dateOfBirth: true,
            },
          },
        },
      });
    }

    res.json({
      success: true,
      message: 'Doctor dashboard data retrieved successfully',
      data: {
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          isOnDuty: doctor.isOnDuty,
          isAvailable: doctor.isAvailable,
          role: 'DOCTOR'
        },
        stats: {
          totalToday: queueStats._count.id || 0,
          completedToday: completedToday || 0,
          waitingToday: waitingToday || 0,
          pendingConsultations: pendingConsultations || 0,
        },
        currentPatient,
      },
    });

  } catch (error) {
    console.error('Get doctor dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
    });
  }
};

module.exports = {
  loginDoctorWeb,
  logoutDoctorWeb,
  getDoctorDashboard,
};