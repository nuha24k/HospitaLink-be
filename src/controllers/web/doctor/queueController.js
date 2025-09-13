const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getTodayQueueWeb = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const whereCondition = {
      queueDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (currentDoctor.specialty !== 'Dokter Umum') {
      whereCondition.doctorId = currentDoctor.id;
    }

    const queues = await prisma.queue.findMany({
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
            name: true,
            specialty: true,
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
      orderBy: {
        position: 'asc',
      },
    });

    const currentQueue = queues.find(q => q.status === 'IN_PROGRESS');
    const waitingQueues = queues.filter(q => q.status === 'WAITING');
    const completedQueues = queues.filter(q => q.status === 'COMPLETED');

    res.json({
      success: true,
      message: 'Today\'s queue retrieved successfully',
      data: {
        total: queues.length,
        current: currentQueue || null,
        waiting: waitingQueues,
        completed: completedQueues,
        summary: {
          waiting: waitingQueues.length,
          completed: completedQueues.length,
          total: queues.length,
        },
        doctorInfo: {
          name: currentDoctor.name,
          specialty: currentDoctor.specialty,
          isOnDuty: currentDoctor.isOnDuty,
        },
      },
    });
  } catch (error) {
    console.error('Get today queue web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue',
    });
  }
};

const getActiveQueue = async (req, res) => {
  try {
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const activeQueue = await prisma.queue.findFirst({
      where: {
        doctorId: currentDoctor.id,
        status: 'IN_PROGRESS',
      },
      include: {
        user: {
          select: {
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        consultation: {
          select: {
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
            recommendation: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Active queue retrieved successfully',
      data: {
        activeQueue: activeQueue || null,
        isOnDuty: currentDoctor.isOnDuty,
      },
    });
  } catch (error) {
    console.error('Get active queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active queue',
    });
  }
};

const getWaitingQueues = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const whereCondition = {
      status: 'WAITING',
      queueDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    const waitingQueues = await prisma.queue.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
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
      orderBy: [
        { isPriority: 'desc' },
        { position: 'asc' },
      ],
    });

    res.json({
      success: true,
      message: 'Waiting queues retrieved successfully',
      data: {
        waitingQueues,
        total: waitingQueues.length,
      },
    });
  } catch (error) {
    console.error('Get waiting queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve waiting queues',
    });
  }
};

const getQueueHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const whereCondition = {
      doctorId: currentDoctor.id,
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      whereCondition.queueDate = {};
      if (startDate) whereCondition.queueDate.gte = new Date(startDate);
      if (endDate) whereCondition.queueDate.lte = new Date(endDate);
    }

    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              fullName: true,
              nik: true,
              phone: true,
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
          completedTime: 'desc',
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
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get queue history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue history',
    });
  }
};

const callNextPatientWeb = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    await prisma.queue.updateMany({
      where: {
        status: 'IN_PROGRESS',
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
        doctorId: currentDoctor.id,
      },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
      },
    });

    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    let nextQueue;

    if (currentDoctor.specialty === 'Dokter Umum') {
      nextQueue = await prisma.queue.findFirst({
        where: {
          status: 'WAITING',
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          OR: [
            { doctorId: null },
            { doctorId: currentDoctor.id },
          ],
        },
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
        orderBy: {
          position: 'asc',
        },
      });
    } else {
      nextQueue = await prisma.queue.findFirst({
        where: {
          status: 'WAITING',
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          doctorId: currentDoctor.id,
        },
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
        orderBy: {
          position: 'asc',
        },
      });
    }

    if (!nextQueue) {
      return res.json({
        success: true,
        message: 'No more patients in queue',
        data: { 
          nextPatient: null,
          hasMore: false
        },
      });
    }

    if (!nextQueue.doctorId) {
      await prisma.queue.update({
        where: { id: nextQueue.id },
        data: { doctorId: currentDoctor.id },
      });
    }

    const calledQueue = await prisma.queue.update({
      where: { id: nextQueue.id },
      data: {
        status: 'IN_PROGRESS',
        calledTime: new Date(),
        doctorId: currentDoctor.id,
      },
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
            name: true,
            specialty: true,
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
    });

    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: true },
    });

    await prisma.notification.create({
      data: {
        userId: calledQueue.userId,
        title: 'Anda Dipanggil!',
        message: `Nomor antrian ${calledQueue.queueNumber} silakan menuju ruang konsultasi ${currentDoctor.name}`,
        type: 'QUEUE',
        priority: 'HIGH',
      },
    });

    res.json({
      success: true,
      message: 'Next patient called successfully',
      data: { 
        calledPatient: calledQueue,
        queueNumber: calledQueue.queueNumber,
        assignedDoctor: {
          name: currentDoctor.name,
          specialty: currentDoctor.specialty,
        },
        hasMore: true
      },
    });

  } catch (error) {
    console.error('Call next patient web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to call next patient',
    });
  }
};

const completeConsultationWeb = async (req, res) => {
  try {
    const { queueId, notes, diagnosis, treatment, prescriptions } = req.body;

    if (!queueId) {
      return res.status(400).json({
        success: false,
        message: 'Queue ID is required',
      });
    }

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        consultation: true,
      },
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
    }

    if (queue.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Queue is not in progress',
      });
    }

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    const completedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
        notes: notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (diagnosis || treatment) {
      await prisma.medicalRecord.create({
        data: {
          userId: queue.userId,
          doctorId: currentDoctor.id,
          consultationId: queue.consultationId,
          visitDate: new Date(),
          queueNumber: queue.queueNumber,
          diagnosis: diagnosis || 'Consultation completed',
          treatment: treatment || 'Treatment provided',
          symptoms: queue.consultation?.symptoms || [],
          notes: notes,
          paymentStatus: 'PAID',
        },
      });
    }

    if (prescriptions && prescriptions.length > 0) {
      const prescriptionCode = `RX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      await prisma.prescription.create({
        data: {
          userId: queue.userId,
          doctorId: currentDoctor.id,
          consultationId: queue.consultationId,
          prescriptionCode,
          medications: prescriptions,
          instructions: notes,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    await prisma.notification.create({
      data: {
        userId: queue.userId,
        title: 'Konsultasi Selesai',
        message: 'Terima kasih telah menggunakan layanan kami. Semoga lekas sembuh!',
        type: 'QUEUE',
        priority: 'MEDIUM',
      },
    });

    res.json({
      success: true,
      message: 'Consultation completed successfully',
      data: { 
        completedQueue,
        medicalRecordCreated: !!(diagnosis || treatment),
        prescriptionCreated: !!(prescriptions && prescriptions.length > 0)
      },
    });

  } catch (error) {
    console.error('Complete consultation web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation',
    });
  }
};

const skipPatientWeb = async (req, res) => {
  try {
    const { queueId, reason } = req.body;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
    });

    if (!queue || queue.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue or not in progress',
      });
    }

    const maxPosition = await prisma.queue.aggregate({
      where: {
        queueDate: queue.queueDate,
        status: 'WAITING',
      },
      _max: {
        position: true,
      },
    });

    await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'WAITING',
        position: (maxPosition._max.position || 0) + 1,
        notes: `Skipped: ${reason || 'No reason provided'}`,
      },
    });

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    res.json({
      success: true,
      message: 'Patient skipped successfully',
    });

  } catch (error) {
    console.error('Skip patient web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to skip patient',
    });
  }
};

module.exports = {
  getTodayQueueWeb,
  getActiveQueue,
  getWaitingQueues,
  getQueueHistory,
  callNextPatientWeb,
  completeConsultationWeb,
  skipPatientWeb,
};