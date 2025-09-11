const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Register user (mobile only)
const registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      nik,
      phone,
      gender,
      dateOfBirth,
      street,
      village,
      district,
      regency,
      province,
      fingerprintData
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          ...(nik ? [{ nik }] : [])
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      if (existingUser.nik === nik) {
        return res.status(409).json({
          success: false,
          message: 'User with this nik already exists'
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (mobile patients only)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName,
        nik: nik || null,
        phone: phone || null,
        gender: gender ? gender.toUpperCase() : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        street: street || null,
        village: village || null,
        district: district || null,
        regency: regency || null,
        province: province || null,
        fingerprintData: fingerprintData || null,
        qrCode: `QR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        role: 'USER' // Only allow USER role for mobile registration
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        nik: true,
        phone: true,
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
        lastLogin: true
      }
    });

    // Generate token
    const token = generateToken(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Login user (mobile only)
const loginUser = async (req, res) => {
  try {
    const { email, nik, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (!email && !nik) {
      return res.status(400).json({
        success: false,
        message: 'Email or NIK is required'
      });
    }

    // Find user (only USER role for mobile)
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          {
            OR: [
              ...(email ? [{ email: email.toLowerCase() }] : []),
              ...(nik ? [{ nik }] : [])
            ]
          },
          { role: { in: ['USER', 'PATIENT'] } } // Only allow mobile users
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, token }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Fingerprint login (mobile only)
const fingerprintLogin = async (req, res) => {
  try {
    const { fingerprintData } = req.body;

    if (!fingerprintData) {
      return res.status(400).json({
        success: false,
        message: 'Fingerprint data is required'
      });
    }

    console.log('🔄 Fingerprint login attempt:', fingerprintData);

    // Find user by fingerprint (only mobile users)
    const user = await prisma.user.findFirst({
      where: { 
        fingerprintData: fingerprintData.trim(),
        role: { in: ['USER', 'PATIENT'] }, // Only allow mobile users
        isActive: true
      }
    });

    if (!user) {
      console.log('❌ Fingerprint not found or user inactive');
      return res.status(401).json({
        success: false,
        message: 'Fingerprint not recognized or account inactive'
      });
    }

    console.log('✅ User found for fingerprint:', user.email);

    // Generate token
    const token = generateToken(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Fingerprint login successful',
      data: { user: userWithoutPassword, token }
    });

  } catch (error) {
    console.error('Fingerprint login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Fingerprint verification helper (mobile only)
const fingerprintVerify = async (req, res) => {
  try {
    const { email, deviceId } = req.body;

    if (!email || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Email and device ID are required'
      });
    }

    console.log('🔄 Fingerprint verify request for:', email, 'device:', deviceId);

    // Find user by email (only mobile users)
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: { in: ['USER', 'PATIENT'] },
        isActive: true
      }
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has fingerprint data
    if (!user.fingerprintData) {
      console.log('❌ No fingerprint data for user:', email);
      return res.status(404).json({
        success: false,
        message: 'No fingerprint data found for user'
      });
    }

    console.log('✅ Found fingerprint for user:', email);

    res.json({
      success: true,
      message: 'Fingerprint data found',
      data: { 
        fingerprintData: user.fingerprintData,
        userId: user.id
      }
    });

  } catch (error) {
    console.error('Fingerprint verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  fingerprintLogin,
  fingerprintVerify,
};