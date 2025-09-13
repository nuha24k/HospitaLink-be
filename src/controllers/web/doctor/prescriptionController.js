const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createPrescription = async (req, res) => {
  try {
    const { 
      userId, 
      consultationId, 
      appointmentId, 
      medications, 
      instructions,
      totalAmount 
    } = req.body;

    if (!userId || !medications || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and medications are required',
      });
    }

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const prescriptionCode = `RX${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const prescription = await prisma.prescription.create({
      data: {
        userId,
        doctorId: currentDoctor.id,
        consultationId: consultationId || null,
        appointmentId: appointmentId || null,
        prescriptionCode,
        medications,
        instructions: instructions || null,
        totalAmount: totalAmount || null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
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

    await prisma.notification.create({
      data: {
        userId,
        title: 'Resep Digital Tersedia',
        message: `Resep dari ${currentDoctor.name} sudah siap. Kode: ${prescriptionCode}`,
        type: 'PRESCRIPTION',
        priority: 'MEDIUM',
      },
    });

    res.json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription,
    });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create prescription',
    });
  }
};

const getTodayPrescriptions = async (req, res) => {
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

    const prescriptions = await prisma.prescription.findMany({
      where: {
        doctorId: currentDoctor.id,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            nik: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const summary = {
      total: prescriptions.length,
      paid: prescriptions.filter(p => p.isPaid).length,
      dispensed: prescriptions.filter(p => p.isDispensed).length,
      pending: prescriptions.filter(p => !p.isPaid).length,
    };

    res.json({
      success: true,
      message: 'Today prescriptions retrieved successfully',
      data: {
        prescriptions,
        summary,
      },
    });
  } catch (error) {
    console.error('Get today prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve prescriptions',
    });
  }
};

const getPrescriptionHistory = async (req, res) => {
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

    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereCondition = {
      doctorId: currentDoctor.id,
      createdAt: {
        lt: today, // Only prescriptions before today
      },
    };

    // Add date range if provided
    if (startDate || endDate) {
      if (startDate) {
        const startDateTime = new Date(startDate);
        whereCondition.createdAt.gte = startDateTime;
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereCondition.createdAt.lte = endDateTime;
      }
    }

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              fullName: true,
              phone: true,
              nik: true,
            },
          },
          consultation: {
            select: {
              type: true,
              severity: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: parseInt(limit),
      }),
      prisma.prescription.count({ where: whereCondition }),
    ]);

    // Calculate summary for history
    const summary = {
      total: prescriptions.length,
      paid: prescriptions.filter(p => p.isPaid).length,
      dispensed: prescriptions.filter(p => p.isDispensed).length,
      pending: prescriptions.filter(p => !p.isPaid).length,
    };

    res.json({
      success: true,
      message: 'Prescription history retrieved successfully',
      data: {
        prescriptions,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get prescription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve prescription history',
    });
  }
};

const getPrescriptionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const prescription = await prisma.prescription.findFirst({
      where: {
        id,
        doctorId: currentDoctor.id,
      },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            nik: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        consultation: {
          select: {
            type: true,
            severity: true,
            symptoms: true,
            recommendation: true,
          },
        },
        appointment: {
          select: {
            appointmentDate: true,
            type: true,
          },
        },
      },
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found',
      });
    }

    res.json({
      success: true,
      message: 'Prescription detail retrieved successfully',
      data: prescription,
    });
  } catch (error) {
    console.error('Get prescription detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve prescription detail',
    });
  }
};

module.exports = {
  createPrescription,
  getTodayPrescriptions,
  getPrescriptionHistory,
  getPrescriptionDetail,
};