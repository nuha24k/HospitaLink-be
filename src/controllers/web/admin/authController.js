const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Generate web token for admin
const generateWebToken = (userId, role) => {
  return jwt.sign(
    { userId, platform: 'web', role }, 
    process.env.JWT_SECRET || 'hospitalink-secret', 
    { expiresIn: '8h' }
  );
};

// Admin login for web dashboard
const loginAdmin = async (req, res) => {
  try {
    const { email, password, fingerprintData } = req.body;

    console.log('🌐 Admin web login attempt:', { email, hasFingerprint: !!fingerprintData });

    // Fingerprint login
    if (fingerprintData) {
      const user = await prisma.user.findFirst({
        where: { 
          fingerprintData: fingerprintData.trim(),
          role: 'ADMIN',
          isActive: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Fingerprint not recognized or admin not found',
        });
      }

      const token = generateWebToken(user.id, 'ADMIN');
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Admin web login successful',
        data: { 
          admin: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role
          },
          loginMethod: 'fingerprint'
        },
      });
    }

    // Email + Password login
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: 'ADMIN',
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or admin not found',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    const token = generateWebToken(user.id, 'ADMIN');
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Admin web login successful',
      data: { 
        admin: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        loginMethod: 'email'
      },
    });

  } catch (error) {
    console.error('Admin web login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Logout admin web
const logoutAdmin = async (req, res) => {
  try {
    res.clearCookie('adminToken');
    res.json({
      success: true,
      message: 'Admin logged out successfully'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// Get admin dashboard data
const getAdminDashboard = async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalUsers = await prisma.user.count({
      where: { role: { in: ['USER', 'PATIENT'] } }
    });

    const totalDoctors = await prisma.doctor.count();

    const todayQueues = await prisma.queue.count({
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const todayConsultations = await prisma.consultation.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const activeDoctors = await prisma.doctor.count({
      where: { isAvailable: true }
    });

    res.json({
      success: true,
      message: 'Admin dashboard data retrieved successfully',
      data: {
        admin: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
        },
        stats: {
          totalUsers,
          totalDoctors,
          todayQueues,
          todayConsultations,
          activeDoctors,
        },
      },
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
    });
  }
};

// Change password (new function)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Update profile (new function)
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (name) updateData.fullName = name;
    if (email) updateData.email = email.toLowerCase();

    // Check if email is already taken
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          email: email.toLowerCase(),
          id: { not: userId }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
    }

    // Update profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

module.exports = {
  loginAdmin,
  logoutAdmin,
  getAdminDashboard,
  changePassword,
  updateProfile,
};