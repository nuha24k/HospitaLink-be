const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get today's queue for doctor web
const getTodayQueueWeb = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get current doctor's profile
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            fullName: true,
            isActive: true,
          },
        },
      },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // Get queues - filter by doctor if specialist, show all if general doctor
    const whereCondition = {
      queueDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    // If specialist doctor, only show assigned queues
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

    // Categorize queues
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

// Call next patient (web version)
const callNextPatientWeb = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get current doctor
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // Complete current in-progress queue first
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

    // Set doctor as not on duty temporarily
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    // Get next waiting patient
    let nextQueue;

    if (currentDoctor.specialty === 'Dokter Umum') {
      // For general doctors: Get unassigned queue or general consultation
      nextQueue = await prisma.queue.findFirst({
        where: {
          status: 'WAITING',
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          OR: [
            { doctorId: null }, // Unassigned
            { doctorId: currentDoctor.id }, // Already assigned to this doctor
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
      // For specialist doctors: Only get assigned queues
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

    // Auto-assign doctor if not assigned
    if (!nextQueue.doctorId) {
      await prisma.queue.update({
        where: { id: nextQueue.id },
        data: { doctorId: currentDoctor.id },
      });
    }

    // Call next patient
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

    // Set doctor as on duty
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: true },
    });

    // Create notification for patient
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

// Complete consultation (web version)
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

    // Get current doctor
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    // Complete the queue
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

    // Create medical record if provided
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
          paymentStatus: 'PAID', // Assume paid for now
        },
      });
    }

    // Create digital prescription if provided
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
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    }

    // Set doctor as not on duty
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    // Create completion notification
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

// Skip patient (for web)
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

    // Move to end of queue
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

    // Set doctor as not on duty
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
  callNextPatientWeb,
  completeConsultationWeb,
  skipPatientWeb,
};