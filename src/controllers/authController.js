const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'hospitalink-secret', 
    { expiresIn: '7d' }
  );
};

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateNIK = (nik) => {
  // NIK must be exactly 16 digits
  const nikRegex = /^\d{16}$/;
  return nikRegex.test(nik);
};

const validatePhone = (phone) => {
  // Indonesian phone number format
  const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
  return phoneRegex.test(phone);
};

const validatePassword = (password) => {
  // At least 6 characters
  return password && password.length >= 6;
};

const registerPatient = async (req, res) => {
  try {
    const { email, password, fullName, phone, nik, gender, dateOfBirth, fingerprintData } = req.body;

    // ========================================
    // INPUT VALIDATION
    // ========================================
    
    // Required fields validation
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and fullName are required',
        required_fields: ['email', 'password', 'fullName']
      });
    }

    // Email validation
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    // Password validation
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        field: 'password'
      });
    }

    // Full name validation
    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be between 2 and 100 characters',
        field: 'fullName'
      });
    }

    // NIK validation (if provided)
    if (nik && !validateNIK(nik)) {
      return res.status(400).json({
        success: false,
        message: 'NIK must be exactly 16 digits',
        field: 'nik',
        example: '1234567890123456'
      });
    }

    // Phone validation (if provided)
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Indonesian phone number',
        field: 'phone',
        examples: ['081234567890', '62812345678901', '+628123456789']
      });
    }

    // Gender validation (if provided)
    if (gender && !['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be either MALE or FEMALE',
        field: 'gender',
        allowed_values: ['MALE', 'FEMALE']
      });
    }

    // Date of birth validation (if provided)
    if (dateOfBirth) {
      const dobDate = new Date(dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid date of birth',
          field: 'dateOfBirth',
          format: 'YYYY-MM-DD'
        });
      }

      // Check if age is reasonable (not in future, not too old)
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      if (dobDate > today) {
        return res.status(400).json({
          success: false,
          message: 'Date of birth cannot be in the future',
          field: 'dateOfBirth'
        });
      }
      if (age > 150) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid date of birth',
          field: 'dateOfBirth'
        });
      }
    }

    // ========================================
    // CHECK EXISTING USER
    // ========================================
    const whereConditions = [{ email }];
    if (nik) {
      whereConditions.push({ nik });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: whereConditions }
    });

    if (existingUser) {
      const conflictField = existingUser.email === email ? 'email' : 'nik';
      return res.status(409).json({
        success: false,
        message: `User with this ${conflictField} already exists`,
        conflict_field: conflictField,
        existing_value: conflictField === 'email' ? email : nik
      });
    }

    // ========================================
    // CREATE USER
    // ========================================
    
    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = {
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      fullName: fullName.trim(),
      role: 'USER',
      isActive: true,
      qrCode: `QR_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    };

    // Add optional fields only if provided
    if (phone) userData.phone = phone.trim();
    if (nik) userData.nik = nik.trim();
    if (gender) userData.gender = gender.toUpperCase();
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth);
    if (fingerprintData) userData.fingerprintData = fingerprintData;

    const user = await prisma.user.create({
      data: userData,
    });

    // ========================================
    // GENERATE TOKEN & RESPONSE
    // ========================================
    
    const token = generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    console.log('✅ User created successfully:', {
      email: user.email,
      fingerprintData: user.fingerprintData, // Debug log
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { 
        token, 
        user: userWithoutPassword, // Pastikan fingerprintData included
        qrCode: user.qrCode
      },
    });

  } catch (error) {
    console.error('Register error:', error);

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `User with this ${field} already exists`,
        field: field,
        error_code: 'DUPLICATE_VALUE'
      });
    }

    if (error.code === 'P2000') {
      // Value too long for column
      const field = error.meta?.column_name || 'field';
      let message = `${field} is too long`;
      let maxLength = 'allowed length';

      // Specific field handling
      if (field === 'nik') {
        message = 'NIK must be exactly 16 digits';
        maxLength = '16 characters';
      } else if (field === 'email') {
        message = 'Email address is too long';
        maxLength = '100 characters';
      } else if (field === 'fullName') {
        message = 'Full name is too long';
        maxLength = '100 characters';
      } else if (field === 'phone') {
        message = 'Phone number is too long';
        maxLength = '20 characters';
      }

      return res.status(400).json({
        success: false,
        message: message,
        field: field,
        max_length: maxLength,
        error_code: 'VALUE_TOO_LONG'
      });
    }

    // General server error
    res.status(500).json({
      success: false,
      message: 'Registration failed due to server error',
      error_code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};

const loginMobile = async (req, res) => {
  try {
    const { email, password, nik, fingerprintData } = req.body;

    // ========================================
    // FINGERPRINT LOGIN
    // ========================================
    if (fingerprintData) {
      console.log('🔍 Attempting fingerprint login with:', fingerprintData);

      if (typeof fingerprintData !== 'string' || fingerprintData.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid fingerprint data is required',
          field: 'fingerprintData'
        });
      }

      const user = await prisma.user.findFirst({
        where: { fingerprintData: fingerprintData.trim() }
      });

      console.log('🔍 Found user with fingerprint:', user ? user.email : 'NOT FOUND');

      if (!user) {
        // Check if any users have fingerprint data for debugging
        const usersWithFingerprint = await prisma.user.findMany({
          where: { 
            fingerprintData: { not: null } 
          },
          select: {
            id: true,
            email: true,
            fingerprintData: true
          }
        });
        
        console.log('🔍 All users with fingerprint data:', usersWithFingerprint);

        return res.status(401).json({
          success: false,
          message: 'Fingerprint not recognized. Please register your fingerprint or use email/NIK login',
          login_alternatives: ['email + password', 'nik + password'],
          debug_info: process.env.NODE_ENV === 'development' ? {
            provided_fingerprint: fingerprintData,
            users_with_fingerprint: usersWithFingerprint.length
          } : undefined
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support',
          contact_support: true
        });
      }

      const token = generateToken(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      const { password: _, ...userWithoutPassword } = user;

      console.log('✅ Fingerprint login successful for:', user.email);

      return res.json({
        success: true,
        message: 'Fingerprint login successful',
        data: { 
          token, 
          user: userWithoutPassword,
          loginMethod: 'fingerprint'
        },
      });
    }

    // ========================================
    // EMAIL/NIK + PASSWORD LOGIN
    // ========================================
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for email/NIK login',
        field: 'password'
      });
    }

    if (!email && !nik) {
      return res.status(400).json({
        success: false,
        message: 'Email, NIK, or fingerprint is required',
        required_fields: ['email OR nik OR fingerprintData']
      });
    }

    // Validate NIK format if provided
    if (nik && !validateNIK(nik)) {
      return res.status(400).json({
        success: false,
        message: 'NIK must be exactly 16 digits',
        field: 'nik'
      });
    }

    // Validate email format if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    const whereConditions = [];
    if (email) whereConditions.push({ email: email.toLowerCase().trim() });
    if (nik) whereConditions.push({ nik: nik.trim() });

    const user = await prisma.user.findFirst({
      where: { OR: whereConditions }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email/NIK and password',
        hint: 'Make sure you are using the correct email or NIK you registered with'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support',
        contact_support: true
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your password',
        hint: 'Password is case-sensitive'
      });
    }

    const token = generateToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { 
        token, 
        user: userWithoutPassword,
        loginMethod: email ? 'email' : 'nik'
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to server error',
      error_code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};

const loginWeb = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        required_fields: ['email', 'password']
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient permissions',
        note: 'Web access is restricted to hospital staff only',
        contact_admin: 'Please contact your administrator for web access'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator',
        contact_admin: true
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        hint: 'Please check your email and password'
      });
    }

    const token = generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Web login successful',
      data: { 
        token, 
        user: userWithoutPassword,
        loginMethod: 'web',
        platform: 'web'
      },
    });

  } catch (error) {
    console.error('Web login error:', error);
    res.status(500).json({
      success: false,
      message: 'Web login failed due to server error',
      error_code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};

// Tambah method untuk debug fingerprint:

const getUserByFingerprint = async (req, res) => {
  try {
    const { fingerprintData } = req.body;
    
    if (!fingerprintData) {
      return res.status(400).json({
        success: false,
        message: 'Fingerprint data required'
      });
    }

    const user = await prisma.user.findFirst({
      where: { fingerprintData: fingerprintData.trim() }
    });

    if (!user) {
      // Show all users with fingerprint for debugging
      const allFingerprintUsers = await prisma.user.findMany({
        where: { 
          fingerprintData: { not: null }
        },
        select: {
          id: true,
          email: true,
          fingerprintData: true,
          fullName: true
        }
      });

      return res.status(404).json({
        success: false,
        message: 'User with fingerprint not found',
        debug: {
          searched_fingerprint: fingerprintData,
          all_fingerprint_users: allFingerprintUsers
        }
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'User found',
      data: { user: userWithoutPassword }
    });

  } catch (error) {
    console.error('Get user by fingerprint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export method
module.exports = {
  registerPatient,
  loginMobile,
  loginWeb,
  getUserByFingerprint, // Tambah ini
};