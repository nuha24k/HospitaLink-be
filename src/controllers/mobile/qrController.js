const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Generate secure QR data for user
const generateUserQR = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data with better error handling
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nik: true,
        fullName: true,
        phone: true,
        profilePicture: true,
        email: true,
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

    const timestamp = Date.now();
    const qrData = {
      type: 'HOSPITAL_QUEUE_REQUEST',
      userId: user.id,
      nik: user.nik || null, // Handle null NIK
      fullName: user.fullName,
      phone: user.phone || null, // Handle null phone
      timestamp: timestamp,
      hospital: 'RS_MITRA_KELUARGA',
      profilePicture: user.profilePicture || null, // Handle null profile picture
      qrVersion: '1.0',
      // Add security hash
      hash: crypto.createHash('md5')
        .update(`${user.id}${timestamp}${process.env.JWT_SECRET || 'fallback-secret'}`)
        .digest('hex')
    };

    // Encode QR data
    const qrCodeData = Buffer.from(JSON.stringify(qrData)).toString('base64');

    // Try to update user's QR code in database
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          qrCode: qrCodeData,
          updatedAt: new Date()
        }
      });
    } catch (updateError) {
      console.warn('⚠️ Warning: Could not update QR code in database:', updateError.message);
      // Continue anyway - QR still works without DB storage
    }

    console.log('🔍 Generated QR for user:', user.fullName);

    res.json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCodeData,
        userInfo: {
          fullName: user.fullName,
          nik: user.nik,
          phone: user.phone,
          profilePicture: user.profilePicture
        },
        timestamp,
        expiresIn: 5 * 60 * 1000, // 5 minutes
        securityEnabled: true
      }
    });

  } catch (error) {
    console.error('❌ Error generating QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get current user QR data with better handling
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

    // Check if QR exists and is recent (within 10 minutes)
    const qrAge = user.updatedAt ? Date.now() - new Date(user.updatedAt).getTime() : Infinity;
    const needsRefresh = !user.qrCode || qrAge > (10 * 60 * 1000);

    if (needsRefresh) {
      // Generate new QR
      console.log('🔄 QR needs refresh, generating new one...');
      return generateUserQR(req, res);
    }

    // Validate existing QR data
    let isQRValid = true;
    try {
      const decodedQR = JSON.parse(Buffer.from(user.qrCode, 'base64').toString());
      const qrTimestamp = decodedQR.timestamp;
      const qrAge = Date.now() - qrTimestamp;
      
      // QR is too old (more than 1 hour)
      if (qrAge > (60 * 60 * 1000)) {
        isQRValid = false;
      }
    } catch (e) {
      console.warn('⚠️ Invalid QR format in database, generating new one...');
      isQRValid = false;
    }

    if (!isQRValid) {
      return generateUserQR(req, res);
    }

    res.json({
      success: true,
      message: 'User QR retrieved successfully',
      data: {
        qrCodeData: user.qrCode,
        userInfo: {
          fullName: user.fullName,
          nik: user.nik,
          phone: user.phone,
          profilePicture: user.profilePicture
        },
        generatedAt: user.updatedAt,
        isValid: true,
        fromCache: true
      }
    });

  } catch (error) {
    console.error('❌ Error getting user QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user QR',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Enhanced validate QR with better security
const validateQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    // Decode QR data with error handling
    let decodedData;
    try {
      const decodedString = Buffer.from(qrData, 'base64').toString();
      decodedData = JSON.parse(decodedString);
    } catch (e) {
      console.warn('⚠️ Invalid QR format:', e.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Validate QR structure
    const requiredFields = ['userId', 'timestamp', 'type'];
    const missingFields = requiredFields.filter(field => !decodedData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid QR code data: missing ${missingFields.join(', ')}`
      });
    }

    // Check timestamp (QR should be used within 5 minutes)
    const qrAge = Date.now() - decodedData.timestamp;
    if (qrAge > (5 * 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: 'QR code has expired',
        data: { 
          expired: true,
          ageMinutes: Math.floor(qrAge / (60 * 1000))
        }
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

    // Verify hash for security (if available)
    if (decodedData.hash) {
      const expectedHash = crypto.createHash('md5')
        .update(`${user.id}${decodedData.timestamp}${process.env.JWT_SECRET || 'fallback-secret'}`)
        .digest('hex');

      if (decodedData.hash !== expectedHash) {
        console.warn('⚠️ QR hash mismatch for user:', user.id);
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code signature'
        });
      }
    }

    // Log successful validation
    console.log('✅ QR validation successful for:', user.fullName);

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'QR_VALIDATED',
          resource: 'QR_CODE',
          details: `QR code validated successfully`,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        }
      });
    } catch (auditError) {
      console.warn('⚠️ Could not create audit log:', auditError.message);
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
        qrAge: Math.floor(qrAge / 1000), // in seconds
        validatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error validating QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Handle QR scan actions (for scanning machine QRs, etc.)
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

    console.log('📱 QR Scan Action:', { userId, action, location, qrData: qrData.substring(0, 50) + '...' });

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
    console.error('❌ Error handling QR scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process QR scan',
      error: error.message
    });
  }
};

// Handle printing queue from machine QR
const handlePrintQueueQR = async (userId, qrData, location, res) => {
  try {
    // Validate machine QR format
    if (!qrData.startsWith('PRINT_MACHINE:')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid print machine QR code'
      });
    }

    // Extract machine info
    const machineInfo = qrData.replace('PRINT_MACHINE:', '');
    const machineData = JSON.parse(machineInfo);

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, nik: true, phone: true }
    });

    // Generate queue number
    const queueNumber = await generateQueueNumber(machineData.specialty);

    // Create queue record
    const queue = await prisma.queue.create({
      data: {
        userId: userId,
        queueNumber: queueNumber,
        queueType: 'WALK_IN',
        status: 'WAITING',
        position: await getNextPosition(machineData.specialty),
        queueDate: new Date(),
        notes: `Generated from machine scan at ${location || 'Hospital'}`
      }
    });

    console.log('🖨️ Queue printed:', queueNumber, 'for user:', user?.fullName);

    res.json({
      success: true,
      message: 'Queue number generated successfully',
      data: {
        action: 'PRINT_QUEUE',
        queueNumber: queueNumber,
        position: queue.position,
        machineLocation: location,
        specialty: machineData.specialty,
        estimatedWaitTime: queue.position * 15, // 15 min per queue
        printSuccess: true,
        instructions: 'Silakan tunggu nomor antrean Anda dipanggil'
      }
    });

  } catch (error) {
    console.error('❌ Error printing queue:', error);
    throw error;
  }
};

// Handle check-in QR
const handleCheckInQR = async (userId, qrData, location, res) => {
  try {
    // Validate check-in QR
    if (!qrData.startsWith('CHECKIN:')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check-in QR code'
      });
    }

    // Update user check-in status
    const checkInTime = new Date();
    
    // Log check-in activity
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'QR_CHECKIN',
        resource: 'QUEUE',
        details: `User checked in via QR at ${location}`,
        timestamp: checkInTime
      }
    });

    res.json({
      success: true,
      message: 'Check-in successful',
      data: {
        action: 'CHECK_IN',
        checkInTime: checkInTime,
        location: location,
        confirmationCode: generateConfirmationCode()
      }
    });

  } catch (error) {
    console.error('❌ Error checking in:', error);
    throw error;
  }
};

// Handle schedule info QR
const handleScheduleInfoQR = async (userId, qrData, res) => {
  try {
    // Parse schedule QR
    const scheduleInfo = JSON.parse(qrData.replace('SCHEDULE:', ''));

    res.json({
      success: true,
      message: 'Schedule information retrieved',
      data: {
        action: 'SCHEDULE_INFO',
        schedule: scheduleInfo,
        currentTime: new Date(),
        isActive: scheduleInfo.isActive
      }
    });

  } catch (error) {
    console.error('❌ Error getting schedule info:', error);
    throw error;
  }
};

// Helper functions
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