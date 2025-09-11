const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Take queue (user)
const takeQueue = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if user already has queue today
    const existingQueue = await prisma.queue.findFirst({
      where: {
        userId,
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['WAITING', 'CALLED', 'IN_PROGRESS'],
        },
      },
    });

    if (existingQueue) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active queue today',
        data: { existingQueue },
      });
    }

    // Get hospital config for queue settings
    const hospitalConfig = await prisma.hospitalConfig.findUnique({
      where: { id: 'hospital' },
    });

    const queuePrefix = hospitalConfig?.queuePrefix || 'A';
    const maxQueue = hospitalConfig?.maxQueuePerDay || 100;

    // Get current queue count for today
    const queueCount = await prisma.queue.count({
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (queueCount >= maxQueue) {
      return res.status(400).json({
        success: false,
        message: 'Queue is full for today. Please try again tomorrow',
        maxQueue,
      });
    }

    // Get next position
    const lastQueue = await prisma.queue.findFirst({
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        position: 'desc',
      },
    });

    const nextPosition = (lastQueue?.position || 0) + 1;
    const queueNumber = `${queuePrefix}${nextPosition.toString().padStart(3, '0')}`;

    // Auto-assign available general doctor
    const availableDoctor = await prisma.doctor.findFirst({
      where: {
        specialty: 'Dokter Umum',
        isAvailable: true,
        isOnDuty: false,
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // FIFO for fairness
      },
    });

    // Calculate estimated wait time
    const waitingCount = await prisma.queue.count({
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: 'WAITING',
      },
    });

    const estimatedWaitTime = waitingCount * (hospitalConfig?.queueCallInterval || 5);

    // Create queue
    const queue = await prisma.queue.create({
      data: {
        userId,
        doctorId: availableDoctor?.id || null, // Auto-assign if available
        queueNumber,
        position: nextPosition,
        queueDate: today,
        estimatedWaitTime,
        status: 'WAITING',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            name: true,
            specialty: true,
          },
        },
      },
    });

    // Create notification
    const doctorInfo = availableDoctor 
      ? `dengan ${availableDoctor.name} (${availableDoctor.specialty})`
      : 'dokter akan ditentukan kemudian';

    await prisma.notification.create({
      data: {
        userId,
        title: 'Antrian Berhasil Diambil',
        message: `Nomor antrian Anda: ${queueNumber}. Konsultasi ${doctorInfo}. Estimasi waktu tunggu: ${estimatedWaitTime} menit`,
        type: 'QUEUE',
        priority: 'MEDIUM',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Queue taken successfully',
      data: { 
        queue,
        estimatedWaitTime: `${estimatedWaitTime} menit`,
        position: nextPosition,
        assignedDoctor: availableDoctor ? {
          name: availableDoctor.name,
          specialty: availableDoctor.specialty,
        } : null,
      },
    });

  } catch (error) {
    console.error('Take queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to take queue',
    });
  }
};

// Get user's current queue
const getMyQueue = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queue = await prisma.queue.findFirst({
      where: {
        userId,
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!queue) {
      return res.json({
        success: true,
        message: 'No queue found for today',
        data: { queue: null },
      });
    }

    // Calculate current position in waiting list
    if (queue.status === 'WAITING') {
      const waitingAhead = await prisma.queue.count({
        where: {
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          status: 'WAITING',
          position: {
            lt: queue.position,
          },
        },
      });

      queue.waitingAhead = waitingAhead;
    }

    res.json({
      success: true,
      message: 'Queue retrieved successfully',
      data: { queue },
    });

  } catch (error) {
    console.error('Get my queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue',
    });
  }
};

// Get queue status by ID
const getQueueStatus = async (req, res) => {
  try {
    const { queueId } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
    }

    // Check if user owns this queue
    if (queue.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get current serving number
    const currentServing = await prisma.queue.findFirst({
      where: {
        queueDate: queue.queueDate,
        status: 'IN_PROGRESS',
      },
      select: {
        queueNumber: true,
        position: true,
      },
    });

    res.json({
      success: true,
      message: 'Queue status retrieved successfully',
      data: { 
        queue,
        currentServing,
      },
    });

  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue status',
    });
  }
};

// Cancel queue
const cancelQueue = async (req, res) => {
  try {
    const { queueId } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
    }

    // Check if user owns this queue
    if (queue.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if queue can be cancelled
    if (!['WAITING', 'CALLED'].includes(queue.status)) {
      return res.status(400).json({
        success: false,
        message: 'Queue cannot be cancelled at this stage',
        currentStatus: queue.status,
      });
    }

    // Cancel queue
    const cancelledQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'CANCELLED',
        completedTime: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: queue.userId,
        title: 'Antrian Dibatalkan',
        message: `Antrian ${queue.queueNumber} telah dibatalkan`,
        type: 'QUEUE',
        priority: 'MEDIUM',
      },
    });

    res.json({
      success: true,
      message: 'Queue cancelled successfully',
      data: { cancelledQueue },
    });

  } catch (error) {
    console.error('Cancel queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel queue',
    });
  }
};

// Get today's all queues (Admin only)
const getTodayQueues = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queues = await prisma.queue.findMany({
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    const summary = {
      total: queues.length,
      waiting: queues.filter(q => q.status === 'WAITING').length,
      inProgress: queues.filter(q => q.status === 'IN_PROGRESS').length,
      completed: queues.filter(q => q.status === 'COMPLETED').length,
      cancelled: queues.filter(q => q.status === 'CANCELLED').length,
    };

    res.json({
      success: true,
      message: 'Today\'s queues retrieved successfully',
      data: { 
        queues,
        summary,
      },
    });

  } catch (error) {
    console.error('Get today queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queues',
    });
  }
};

module.exports = {
  takeQueue,
  getMyQueue,
  getQueueStatus,
  cancelQueue,
  getTodayQueues,
};