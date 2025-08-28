const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();

// Multer config for profile picture upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profiles/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalUsers = await prisma.user.count();

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          limit,
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user by ID (Admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        nik: true,
        gender: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        nik: true,
        gender: true,
        dateOfBirth: true,
        street: true,
        village: true,
        district: true,
        regency: true,
        province: true,
        qrCode: true,
        fingerprintData: true,
        profilePicture: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { phone, gender, street, village, district, regency, province } = req.body;
    const userId = req.user.id;

    // Build update data object
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (gender !== undefined) updateData.gender = gender.toUpperCase();
    if (street !== undefined) updateData.street = street;
    if (village !== undefined) updateData.village = village;
    if (district !== undefined) updateData.district = district;
    if (regency !== undefined) updateData.regency = regency;
    if (province !== undefined) updateData.province = province;

    // Add profile picture if uploaded
    if (req.file) {
      updateData.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        nik: true,
        gender: true,
        dateOfBirth: true,
        street: true,
        village: true,
        district: true,
        regency: true,
        province: true,
        qrCode: true,
        fingerprintData: true,
        profilePicture: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Change email
const changeEmail = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!newEmail || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New email and current password are required',
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    // Update email
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        email: newEmail.toLowerCase(),
        emailVerified: false, // Reset email verification
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerified: true,
      },
    });

    res.json({
      success: true,
      message: 'Email updated successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    if (!newPassword.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) {
      return res.status(400).json({
        success: false,
        message: 'New password must contain at least one lowercase letter, one uppercase letter, and one number',
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Register fingerprint
const registerFingerprint = async (req, res) => {
  try {
    const { fingerprintData } = req.body;
    const userId = req.user.id;

    if (!fingerprintData) {
      return res.status(400).json({
        success: false,
        message: 'Fingerprint data is required',
      });
    }

    // Check if fingerprint already exists
    const existingFingerprint = await prisma.user.findFirst({
      where: { 
        fingerprintData: fingerprintData,
        id: { not: userId }
      },
    });

    if (existingFingerprint) {
      return res.status(400).json({
        success: false,
        message: 'Fingerprint already registered to another user',
      });
    }

    // Update user fingerprint
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { fingerprintData },
      select: {
        id: true,
        email: true,
        fullName: true,
        fingerprintData: true,
      },
    });

    res.json({
      success: true,
      message: 'Fingerprint registered successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Register fingerprint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getProfile,
  updateProfile,
  changeEmail,
  changePassword,
  registerFingerprint,
  upload, // Export multer upload middleware
};