const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to calculate total prescription cost
const calculatePrescriptionTotal = (medications) => {
  return medications.reduce((total, med) => {
    const quantity = parseInt(med.quantity) || 1;
    const price = parseFloat(med.pricePerUnit) || 0;
    return total + (quantity * price);
  }, 0);
};

// Search medications for prescription - FIXED for MySQL
const searchMedications = async (req, res) => {
  try {
    const { q: query, category, limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query minimal 2 karakter'
      });
    }
    
    // For MySQL, we use simple contains without mode
    const whereCondition = {
      isActive: true,
      OR: [
        { genericName: { contains: query } },
        { brandName: { contains: query } },
        { medicationCode: { contains: query } }
      ]
    };
    
    if (category) {
      whereCondition.category = category;
    }
    
    const medications = await prisma.medication.findMany({
      where: whereCondition,
      select: {
        id: true,
        medicationCode: true,
        genericName: true,
        brandName: true,
        category: true,
        dosageForm: true,
        strength: true,
        unit: true,
        pricePerUnit: true,
        stock: true,
        indications: true,
        dosageInstructions: true,
        requiresPrescription: true,
        isControlled: true
      },
      orderBy: [
        { genericName: 'asc' }
      ],
      take: parseInt(limit)
    });
    
    res.json({
      success: true,
      message: 'Medications found',
      data: {
        medications,
        query,
        total: medications.length
      }
    });
    
  } catch (error) {
    console.error('Search medications error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mencari obat'
    });
  }
};

// Get medication categories
const getMedicationCategories = async (req, res) => {
  try {
    const categories = await prisma.medication.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        id: true
      },
      orderBy: {
        category: 'asc'
      }
    });
    
    res.json({
      success: true,
      message: 'Categories retrieved',
      data: categories.map(cat => ({
        category: cat.category,
        count: cat._count.id
      }))
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat kategori obat'
    });
  }
};

// Get medication detail
const getMedicationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const medication = await prisma.medication.findFirst({
      where: {
        id,
        isActive: true
      }
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Obat tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Medication detail retrieved',
      data: medication
    });
    
  } catch (error) {
    console.error('Get medication detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat detail obat'
    });
  }
};

const createPrescription = async (req, res) => {
  try {
    const { 
      userId, 
      consultationId, 
      appointmentId, 
      medications, 
      instructions
    } = req.body;

    if (!userId || !medications || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID dan obat harus diisi',
      });
    }

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    // Validate medications and get current prices
    const medicationIds = medications.map(med => med.medicationId);
    const validMedications = await prisma.medication.findMany({
      where: {
        id: { in: medicationIds },
        isActive: true
      }
    });

    if (validMedications.length !== medications.length) {
      return res.status(400).json({
        success: false,
        message: 'Beberapa obat tidak valid atau tidak aktif'
      });
    }

    // Check stock availability
    for (const med of medications) {
      const dbMed = validMedications.find(m => m.id === med.medicationId);
      if (dbMed.stock < parseInt(med.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Stok ${dbMed.genericName} tidak mencukupi. Tersedia: ${dbMed.stock}`
        });
      }
    }

    // Prepare medications data with current prices
    const medicationsData = medications.map(med => {
      const dbMed = validMedications.find(m => m.id === med.medicationId);
      return {
        medicationId: med.medicationId,
        medicationCode: dbMed.medicationCode,
        genericName: dbMed.genericName,
        brandName: dbMed.brandName,
        dosageForm: dbMed.dosageForm,
        strength: dbMed.strength,
        unit: dbMed.unit,
        quantity: parseInt(med.quantity),
        pricePerUnit: parseFloat(dbMed.pricePerUnit),
        totalPrice: parseInt(med.quantity) * parseFloat(dbMed.pricePerUnit),
        dosageInstructions: med.dosageInstructions || dbMed.dosageInstructions,
        frequency: med.frequency || '',
        duration: med.duration || '',
        notes: med.notes || ''
      };
    });

    // Calculate total amount
    const totalAmount = calculatePrescriptionTotal(medicationsData);

    const prescriptionCode = `RX${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const prescription = await prisma.prescription.create({
      data: {
        userId,
        doctorId: currentDoctor.id,
        consultationId: consultationId || null,
        appointmentId: appointmentId || null,
        prescriptionCode,
        medications: medicationsData,
        instructions: instructions || '',
        totalAmount,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
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

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Resep Digital Tersedia',
        message: `Resep dari Dr. ${currentDoctor.name} sudah siap. Kode: ${prescriptionCode}. Total: Rp ${totalAmount.toLocaleString('id-ID')}`,
        type: 'SYSTEM',
        priority: 'MEDIUM',
        actionUrl: `/prescription/${prescription.id}`
      },
    });

    res.json({
      success: true,
      message: 'Resep berhasil dibuat',
      data: {
        prescription,
        summary: {
          medicationCount: medicationsData.length,
          totalAmount,
          prescriptionCode
        }
      }
    });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat resep',
    });
  }
};

const getTodayPrescriptions = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
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
        consultation: {
          select: {
            type: true,
            severity: true
          }
        }
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
      totalValue: prescriptions.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0)
    };

    res.json({
      success: true,
      message: 'Resep hari ini berhasil dimuat',
      data: {
        prescriptions,
        summary,
      },
    });
  } catch (error) {
    console.error('Get today prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat resep hari ini',
    });
  }
};

const getPrescriptionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, status } = req.query;
    const skip = (page - 1) * limit;

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereCondition = {
      doctorId: currentDoctor.id,
      createdAt: {
        lt: today,
      },
    };

    // Add date range filter
    if (startDate || endDate) {
      if (startDate) {
        const startDateTime = new Date(startDate);
        whereCondition.createdAt.gte = startDateTime;
        delete whereCondition.createdAt.lt; // Remove today filter if date range specified
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereCondition.createdAt.lte = endDateTime;
      }
    }

    // Add status filter
    if (status) {
      if (status === 'paid') {
        whereCondition.isPaid = true;
      } else if (status === 'pending') {
        whereCondition.isPaid = false;
      } else if (status === 'dispensed') {
        whereCondition.isDispensed = true;
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

    const summary = {
      total: prescriptions.length,
      paid: prescriptions.filter(p => p.isPaid).length,
      dispensed: prescriptions.filter(p => p.isDispensed).length,
      pending: prescriptions.filter(p => !p.isPaid).length,
      totalValue: prescriptions.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0)
    };

    res.json({
      success: true,
      message: 'Riwayat resep berhasil dimuat',
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
      message: 'Gagal memuat riwayat resep',
    });
  }
};

const getPrescriptionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
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
        doctor: {
          select: {
            name: true,
            specialty: true,
            licenseNumber: true
          }
        }
      },
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Resep tidak ditemukan',
      });
    }

    res.json({
      success: true,
      message: 'Detail resep berhasil dimuat',
      data: prescription,
    });
  } catch (error) {
    console.error('Get prescription detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat detail resep',
    });
  }
};

module.exports = {
  searchMedications,
  getMedicationCategories,
  getMedicationDetail,
  createPrescription,
  getTodayPrescriptions,
  getPrescriptionHistory,
  getPrescriptionDetail,
};