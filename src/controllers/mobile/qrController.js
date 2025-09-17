const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Generate STATIC user QR code (tidak berubah)
const generateUserQR = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nik: true,
        fullName: true,
        phone: true,
        profilePicture: true,
        email: true,
        isActive: true,
        qrCode: true // Check if already exists
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // ✅ STATIC QR: Generate once and save permanently
    let qrCodeData = user.qrCode;
    
    if (!qrCodeData) {
      // Generate static QR data (no timestamp, no expiration)
      const staticQrData = {
        type: 'HOSPITAL_PATIENT_ID',
        userId: user.id,
        nik: user.nik || null,
        fullName: user.fullName,
        phone: user.phone || null,
        hospital: 'HOSPITALINK_MEDICAL_CENTER',
        profilePicture: user.profilePicture || null,
        qrVersion: '2.0',
        isStatic: true,
        // Security hash based on user data (not timestamp)
        hash: crypto.createHash('sha256')
          .update(`${user.id}${user.nik || ''}${user.fullName}${process.env.JWT_SECRET || 'hospitalink-secret'}`)
          .digest('hex').substring(0, 16)
      };

      // Encode as simple JSON string (readable when scanned)
      qrCodeData = JSON.stringify(staticQrData);

      // Save to database permanently
      await prisma.user.update({
        where: { id: userId },
        data: { 
          qrCode: qrCodeData,
          updatedAt: new Date()
        }
      });

      console.log('🆕 Generated new static QR for user:', user.fullName);
    } else {
      console.log('♻️ Using existing static QR for user:', user.fullName);
    }

    res.json({
      success: true,
      message: 'QR code retrieved successfully',
      data: {
        qrCodeData, // ✅ Direct JSON string (readable when scanned)
        userInfo: {
          fullName: user.fullName,
          nik: user.nik,
          phone: user.phone,
          profilePicture: user.profilePicture
        },
        isStatic: true,
        neverExpires: true,
        canBePrinted: true
      }
    });

  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get current user QR (always return existing static QR)
const getUserQR = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nik: true,
        fullName: true,
        phone: true,
        profilePicture: true,
        qrCode: true,
        updatedAt: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // ✅ If no QR exists, generate one
    if (!user.qrCode) {
      console.log('No existing QR found, generating new one...');
      return generateUserQR(req, res);
    }

    res.json({
      success: true,
      message: 'User QR retrieved successfully',
      data: {
        qrCodeData: user.qrCode, // ✅ Direct JSON string
        userInfo: {
          fullName: user.fullName,
          nik: user.nik,
          phone: user.phone,
          profilePicture: user.profilePicture
        },
        generatedAt: user.updatedAt,
        isStatic: true,
        fromDatabase: true
      }
    });

  } catch (error) {
    console.error('Error getting user QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user QR',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Validate static QR code
const validateQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    // ✅ Parse JSON directly (no base64 decoding needed)
    let decodedData;
    try {
      decodedData = JSON.parse(qrData);
    } catch (e) {
      console.warn('Invalid QR format:', e.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Validate QR structure
    const requiredFields = ['userId', 'type'];
    const missingFields = requiredFields.filter(field => !decodedData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid QR code data: missing ${missingFields.join(', ')}`
      });
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decodedData.userId },
      select: {
        id: true,
        nik: true,
        fullName: true,
        phone: true,
        profilePicture: true,
        isActive: true,
        qrCode: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // ✅ Verify QR matches database
    if (user.qrCode !== qrData) {
      console.warn('QR data mismatch for user:', user.id);
      return res.status(400).json({
        success: false,
        message: 'QR code verification failed'
      });
    }

    // Verify hash for additional security
    if (decodedData.hash) {
      const expectedHash = crypto.createHash('sha256')
        .update(`${user.id}${user.nik || ''}${user.fullName}${process.env.JWT_SECRET || 'hospitalink-secret'}`)
        .digest('hex').substring(0, 16);

      if (decodedData.hash !== expectedHash) {
        console.warn('QR hash mismatch for user:', user.id);
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code signature'
        });
      }
    }

    console.log('✅ QR validation successful for:', user.fullName);

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'QR_VALIDATED',
          resource: 'QR_CODE',
          details: `Static QR code validated successfully`,
          ipAddress: req.ip || 'unknown'
        }
      });
    } catch (auditError) {
      console.warn('Could not create audit log:', auditError.message);
    }

    res.json({
      success: true,
      message: 'QR code is valid',
      data: {
        valid: true,
        user: {
          id: user.id,
          nik: user.nik,
          fullName: user.fullName,
          phone: user.phone,
          profilePicture: user.profilePicture
        },
        requiresFaceVerification: !!user.profilePicture,
        isStatic: true,
        validatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error validating QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Keep other methods unchanged...
const handleQRScan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { qrData, action, location } = req.body;

    if (!qrData || !action) {
      return res.status(400).json({
        success: false,
        message: 'QR data and action are required'
      });
    }

    console.log('QR Scan Action:', { userId, action, location });

    // Handle different QR scan actions
    switch (action) {
      case 'PRINT_QUEUE':
        return await handlePrintQueueQR(userId, qrData, location, res);
      case 'CHECK_IN':
        return await handleCheckInQR(userId, qrData, location, res);
      case 'SCHEDULE_INFO':
        return await handleScheduleInfoQR(userId, qrData, res);
      default:
        return res.status(400).json({
          success: false,
          message: 'Unknown QR action'
        });
    }

  } catch (error) {
    console.error('Error handling QR scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process QR scan',
      error: error.message
    });
  }
};

// Helper functions remain the same...
const handlePrintQueueQR = async (userId, qrData, location, res) => {
  // Implementation remains the same
};

const handleCheckInQR = async (userId, qrData, location, res) => {
  // Implementation remains the same
};

const handleScheduleInfoQR = async (userId, qrData, res) => {
  // Implementation remains the same
};

const generateQueueNumber = async (specialty = 'GENERAL') => {
  const prefix = specialty.substring(0, 1).toUpperCase();
  const today = new Date().toISOString().split('T')[0];
  
  const count = await prisma.queue.count({
    where: {
      queueDate: {
        gte: new Date(today),
        lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });

  return `${prefix}${(count + 1).toString().padStart(3, '0')}`;
};

const getNextPosition = async (specialty) => {
  const today = new Date().toISOString().split('T')[0];
  
  const count = await prisma.queue.count({
    where: {
      queueDate: {
        gte: new Date(today),
        lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
      },
      status: {
        in: ['WAITING', 'CALLED', 'IN_PROGRESS']
      }
    }
  });

  return count + 1;
};

const generateConfirmationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  generateUserQR,
  getUserQR,
  validateQR,
  handleQRScan
};