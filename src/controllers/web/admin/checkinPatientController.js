const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @desc    Check in patient via QR code scan
 * @route   POST /api/web/admin/checkin
 * @access  Admin only
 */
const checkinPatientByQR = async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: 'QR Code is required'
      });
    }

    // Find user by QR code
    const user = await prisma.user.findUnique({
      where: { qrCode },
      include: {
        queues: {
          where: {
            queueDate: {
              equals: new Date(new Date().toDateString())
            },
            status: {
              in: ['WAITING', 'CALLED', 'IN_PROGRESS']
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pasien tidak ditemukan dengan QR code ini'
      });
    }

    // Check if user already has an active queue today
    if (user.queues.length > 0) {
      const existingQueue = user.queues[0];
      return res.status(400).json({
        success: false,
        message: 'Pasien sudah memiliki antrian aktif hari ini',
        data: {
          queueNumber: existingQueue.queueNumber,
          queueType: existingQueue.queueType,
          position: existingQueue.position,
          status: existingQueue.status
        }
      });
    }

    // Get available doctor (round-robin selection)
    const availableDoctor = await prisma.doctor.findFirst({
      where: {
        isAvailable: true,
        isOnDuty: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (!availableDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada dokter yang tersedia saat ini'
      });
    }

    // Get hospital config for queue prefix
    const hospitalConfig = await prisma.hospitalConfig.findUnique({
      where: { id: 'hospital' }
    });

    const queuePrefix = hospitalConfig?.queuePrefix || 'A';
    const today = new Date().toDateString();

    // Get last queue for today to determine next position
    const lastQueue = await prisma.queue.findFirst({
      where: {
        queueDate: {
          equals: new Date(today)
        }
      },
      orderBy: {
        position: 'desc'
      }
    });

    // Generate queue number and position
    const nextPosition = (lastQueue?.position || 0) + 1;
    const queueNumber = `${queuePrefix}${nextPosition.toString().padStart(3, '0')}`;

    // Calculate estimated wait time: +20 minutes per position before
    const baseWaitTime = 20; // minutes per patient
    const estimatedWaitTime = (nextPosition - 1) * baseWaitTime;

    // Create queue entry with APPOINTMENT type (AUTO INPUT)
    const newQueue = await prisma.queue.create({
      data: {
        userId: user.id,
        doctorId: availableDoctor.id,
        queueNumber,
        queueType: 'APPOINTMENT', // ✅ AUTO INPUT - APPOINTMENT for QR scan
        position: nextPosition,
        estimatedWaitTime,
        queueDate: new Date(today),
        checkInTime: new Date(),
        status: 'WAITING'
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            nik: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    });

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Check-in Berhasil',
        message: `Check-in berhasil! Nomor antrian: ${queueNumber}. Posisi: ${nextPosition}. Estimasi tunggu: ${estimatedWaitTime} menit. Tipe: APPOINTMENT`,
        type: 'QUEUE',
        priority: 'MEDIUM'
      }
    });

    console.log(`✅ QR Scan Check-in Success:`, {
      user: user.fullName,
      queueNumber,
      queueType: 'APPOINTMENT', // ✅ Explicitly APPOINTMENT
      position: nextPosition,
      estimatedTime: estimatedWaitTime
    });

    return res.status(201).json({
      success: true,
      message: 'Check-in berhasil dengan tipe APPOINTMENT',
      data: {
        queue: newQueue,
        estimatedTime: `${estimatedWaitTime} menit`,
        queueType: 'APPOINTMENT' // ✅ Explicitly return APPOINTMENT
      }
    });

  } catch (error) {
    console.error('❌ Checkin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get current queue status for today
 * @route   GET /api/web/admin/checkin/queue-status
 * @access  Admin only
 */
const getQueueStatus = async (req, res) => {
  try {
    const today = new Date().toDateString();

    // Get all queues for today
    const queues = await prisma.queue.findMany({
      where: {
        queueDate: {
          equals: new Date(today)
        }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            nik: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      },
      orderBy: {
        position: 'asc'
      }
    });

    // Get statistics
    const stats = {
      total: queues.length,
      waiting: queues.filter(q => q.status === 'WAITING').length,
      inProgress: queues.filter(q => q.status === 'IN_PROGRESS').length,
      completed: queues.filter(q => q.status === 'COMPLETED').length,
      cancelled: queues.filter(q => q.status === 'CANCELLED').length
    };

    return res.status(200).json({
      success: true,
      message: 'Queue status retrieved successfully',
      data: {
        queues,
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Get queue status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update queue status (call next patient)
 * @route   PATCH /api/web/admin/checkin/call-next
 * @access  Admin only
 */
const callNextPatient = async (req, res) => {
  try {
    const { doctorId } = req.body;
    const today = new Date().toDateString();

    // Get next waiting patient for specific doctor
    const nextQueue = await prisma.queue.findFirst({
      where: {
        doctorId: doctorId || undefined,
        queueDate: {
          equals: new Date(today)
        },
        status: 'WAITING'
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      },
      orderBy: {
        position: 'asc'
      }
    });

    if (!nextQueue) {
      return res.status(404).json({
        success: false,
        message: 'No waiting patients found'
      });
    }

    // Update queue status to CALLED
    const updatedQueue = await prisma.queue.update({
      where: { id: nextQueue.id },
      data: {
        status: 'CALLED',
        calledTime: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    });

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId: nextQueue.userId,
        title: 'Your Turn',
        message: `Please proceed to ${nextQueue.doctor?.name || 'doctor'} for your consultation.`,
        type: 'QUEUE',
        priority: 'HIGH'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Next patient called successfully',
      data: updatedQueue
    });

  } catch (error) {
    console.error('Call next patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  checkinPatientByQR,
  getQueueStatus,
  callNextPatient
};