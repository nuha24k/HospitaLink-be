const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all queues with pagination and filters
const getQueues = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      status, 
      doctorId, 
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build where condition
    const whereCondition = {};

    // Date filter
    if (startDate || endDate) {
      whereCondition.queueDate = {};
      if (startDate) whereCondition.queueDate.gte = new Date(startDate);
      if (endDate) whereCondition.queueDate.lte = new Date(endDate);
    }

    // Status filter
    if (status && status !== 'ALL') {
      whereCondition.status = status;
    }

    // Doctor filter
    if (doctorId) {
      whereCondition.doctorId = doctorId;
    }

    // Search filter (patient name, queue number)
    if (search) {
      whereCondition.OR = [
        {
          queueNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          user: {
            fullName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              nik: true,
              phone: true,
              gender: true,
              dateOfBirth: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              licenseNumber: true,
            },
          },
          consultation: {
            select: {
              id: true,
              type: true,
              severity: true,
              symptoms: true,
              aiAnalysis: true,
            },
          },
        },
        orderBy: [
          { queueDate: 'desc' },
          { position: 'asc' }
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.queue.count({ where: whereCondition }),
    ]);

    // Calculate statistics
    const stats = await prisma.queue.groupBy({
      by: ['status'],
      where: whereCondition,
      _count: {
        status: true,
      },
    });

    const statsFormatted = {
      total,
      waiting: stats.find(s => s.status === 'WAITING')?._count?.status || 0,
      inProgress: stats.find(s => s.status === 'IN_PROGRESS')?._count?.status || 0,
      completed: stats.find(s => s.status === 'COMPLETED')?._count?.status || 0,
      cancelled: stats.find(s => s.status === 'CANCELLED')?._count?.status || 0,
    };

    res.json({
      success: true,
      message: 'Queues retrieved successfully',
      data: {
        queues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        statistics: statsFormatted,
      },
    });
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queues',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Call patient (WAITING -> CALLED)
const callPatient = async (req, res) => {
  try {
    const { queueId } = req.params;

    // Find the queue
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
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

    // Check if queue can be called
    if (queue.status !== 'WAITING') {
      return res.status(400).json({
        success: false,
        message: `Queue cannot be called. Current status: ${queue.status}`,
      });
    }

    // Update queue status to CALLED
    const updatedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'CALLED',
        calledTime: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: `Patient ${queue.user.fullName} (${queue.queueNumber}) has been called`,
      data: updatedQueue,
    });
  } catch (error) {
    console.error('Call patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to call patient',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Start consultation (CALLED -> IN_PROGRESS)
const startConsultation = async (req, res) => {
  try {
    const { queueId } = req.params;

    // Find the queue
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
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

    // Check if queue can be started
    if (queue.status !== 'CALLED') {
      return res.status(400).json({
        success: false,
        message: `Consultation cannot be started. Current status: ${queue.status}`,
      });
    }

    // Update queue status to IN_PROGRESS
    const updatedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    res.json({
      success: true,
      message: `Consultation started for ${queue.user.fullName} (${queue.queueNumber})`,
      data: updatedQueue,
    });
  } catch (error) {
    console.error('Start consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start consultation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Complete consultation (IN_PROGRESS -> COMPLETED)
const completeConsultation = async (req, res) => {
  try {
    const { queueId } = req.params;
    const { notes } = req.body;

    // Find the queue
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
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

    // Check if queue can be completed
    if (queue.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: `Consultation cannot be completed. Current status: ${queue.status}`,
      });
    }

    // Update queue status to COMPLETED
    const updatedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
        ...(notes && { notes: notes }),
      },
    });

    res.json({
      success: true,
      message: `Consultation completed for ${queue.user.fullName} (${queue.queueNumber})`,
      data: updatedQueue,
    });
  } catch (error) {
    console.error('Complete consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Cancel queue (Any status -> CANCELLED)
const cancelQueue = async (req, res) => {
  try {
    const { queueId } = req.params;
    const { reason } = req.body;

    // Find the queue
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
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

    // Check if queue can be cancelled
    if (queue.status === 'COMPLETED' || queue.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Queue cannot be cancelled. Current status: ${queue.status}`,
      });
    }

    // Update queue status to CANCELLED
    const updatedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'CANCELLED',
        notes: reason || 'Cancelled by admin',
      },
    });

    res.json({
      success: true,
      message: `Queue cancelled for ${queue.user.fullName} (${queue.queueNumber})`,
      data: updatedQueue,
    });
  } catch (error) {
    console.error('Cancel queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel queue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get queue by ID
const getQueueById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching queue with ID:', id);

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
            email: true,
            street: true,
            village: true,
            district: true,
            regency: true,
            province: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            licenseNumber: true,
            consultationFee: true,
            user: {
              select: {
                email: true,
                phone: true,
              }
            }
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
            recommendation: true,
            createdAt: true,
          },
        },
      },
    });

    console.log('Found queue:', queue ? 'Yes' : 'No');

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
    }

    // Try to get medical records separately with error handling
    let medicalRecords = [];
    try {
      medicalRecords = await prisma.medicalRecord.findMany({
        where: { queueId: id },
        select: {
          id: true,
          diagnosis: true,
          treatment: true,
          symptoms: true,
          notes: true,
          visitDate: true,
          paymentStatus: true,
        },
        orderBy: {
          visitDate: 'desc'
        }
      });
      console.log('Medical records found:', medicalRecords.length);
    } catch (medicalError) {
      console.log('Medical records error (non-critical):', medicalError.message);
    }

    // Try to get prescriptions separately with error handling
    let prescriptions = [];
    try {
      prescriptions = await prisma.prescription.findMany({
        where: { queueId: id },
        select: {
          id: true,
          prescriptionCode: true,
          medications: true,
          instructions: true,
          status: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      console.log('Prescriptions found:', prescriptions.length);
    } catch (prescriptionError) {
      console.log('Prescriptions error (non-critical):', prescriptionError.message);
    }

    // Combine data
    const queueWithRelations = {
      ...queue,
      medicalRecords,
      prescriptions,
    };

    res.json({
      success: true,
      message: 'Queue retrieved successfully',
      data: queueWithRelations,
    });

  } catch (error) {
    console.error('Get queue by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get queue history (completed queues)
const getQueueHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      doctorId, 
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // FIXED: Only show COMPLETED queues for history
    const whereCondition = {
      status: 'COMPLETED', // This is the key fix
    };

    // Date filter
    if (startDate || endDate) {
      whereCondition.queueDate = {};
      if (startDate) whereCondition.queueDate.gte = new Date(startDate);
      if (endDate) whereCondition.queueDate.lte = new Date(endDate);
    }

    // Doctor filter
    if (doctorId) {
      whereCondition.doctorId = doctorId;
    }

    // Search filter
    if (search) {
      whereCondition.OR = [
        {
          queueNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          user: {
            fullName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              nik: true,
              phone: true,
              gender: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
          consultation: {
            select: {
              type: true,
              severity: true,
              symptoms: true,
            },
          },
        },
        orderBy: {
          completedTime: 'desc', // Order by completion time
        },
        skip,
        take: parseInt(limit),
      }),
      prisma.queue.count({ where: whereCondition }),
    ]);

    res.json({
      success: true,
      message: 'Queue history retrieved successfully',
      data: {
        queues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get queue history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get today's queues summary
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
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
          },
        },
        doctor: {
          select: {
            name: true,
            specialty: true,
          },
        },
        consultation: {
          select: {
            type: true,
            severity: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { position: 'asc' }
      ],
    });

    const summary = {
      total: queues.length,
      waiting: queues.filter(q => q.status === 'WAITING').length,
      inProgress: queues.filter(q => q.status === 'IN_PROGRESS').length,
      completed: queues.filter(q => q.status === 'COMPLETED').length,
      cancelled: queues.filter(q => q.status === 'CANCELLED').length,
    };

    const byDoctor = await prisma.queue.groupBy({
      by: ['doctorId'],
      where: {
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        id: true,
      },
    });

    const doctorStats = await Promise.all(
      byDoctor.map(async (stat) => {
        if (!stat.doctorId) return null;
        
        const doctor = await prisma.doctor.findUnique({
          where: { id: stat.doctorId },
          select: {
            name: true,
            specialty: true,
          },
        });

        return {
          doctorId: stat.doctorId,
          doctorName: doctor?.name,
          specialty: doctor?.specialty,
          queueCount: stat._count.id,
        };
      })
    );

    res.json({
      success: true,
      message: "Today's queues retrieved successfully",
      data: {
        queues,
        summary,
        doctorStats: doctorStats.filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Get today queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve today queues',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get queue analytics
const getQueueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const whereCondition = {};
    
    if (startDate || endDate) {
      whereCondition.queueDate = {};
      if (startDate) whereCondition.queueDate.gte = new Date(startDate);
      if (endDate) whereCondition.queueDate.lte = new Date(endDate);
    }

    // Queue status distribution
    const statusStats = await prisma.queue.groupBy({
      by: ['status'],
      where: whereCondition,
      _count: {
        status: true,
      },
    });

    // Queue by specialty
    const specialtyStats = await prisma.queue.groupBy({
      by: ['doctorId'],
      where: whereCondition,
      _count: {
        id: true,
      },
    });

    const specialtyData = await Promise.all(
      specialtyStats.map(async (stat) => {
        if (!stat.doctorId) return { specialty: 'Dokter Umum', count: stat._count.id };
        
        const doctor = await prisma.doctor.findUnique({
          where: { id: stat.doctorId },
          select: { specialty: true },
        });

        return {
          specialty: doctor?.specialty || 'Unknown',
          count: stat._count.id,
        };
      })
    );

    // Average waiting time (for completed queues)
    const completedQueues = await prisma.queue.findMany({
      where: {
        ...whereCondition,
        status: 'COMPLETED',
        calledTime: { not: null },
        completedTime: { not: null },
      },
      select: {
        calledTime: true,
        completedTime: true,
        createdAt: true,
      },
    });

    const avgWaitingTime = completedQueues.length > 0 
      ? completedQueues.reduce((acc, queue) => {
          const waitTime = new Date(queue.calledTime).getTime() - new Date(queue.createdAt).getTime();
          return acc + waitTime;
        }, 0) / completedQueues.length / (1000 * 60) // Convert to minutes
      : 0;

    const avgConsultationTime = completedQueues.length > 0
      ? completedQueues.reduce((acc, queue) => {
          const consultTime = new Date(queue.completedTime).getTime() - new Date(queue.calledTime).getTime();
          return acc + consultTime;
        }, 0) / completedQueues.length / (1000 * 60) // Convert to minutes
      : 0;

    res.json({
      success: true,
      message: 'Queue analytics retrieved successfully',
      data: {
        statusDistribution: statusStats,
        specialtyDistribution: specialtyData,
        averageWaitingTime: Math.round(avgWaitingTime),
        averageConsultationTime: Math.round(avgConsultationTime),
        totalQueues: statusStats.reduce((acc, stat) => acc + stat._count.status, 0),
      },
    });
  } catch (error) {
    console.error('Get queue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getQueues,
  getQueueById,
  getQueueHistory,
  getTodayQueues,
  getQueueAnalytics,
  callPatient,
  startConsultation,
  completeConsultation,
  cancelQueue,
};