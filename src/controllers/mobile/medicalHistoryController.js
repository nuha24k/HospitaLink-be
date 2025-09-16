// Fix: HospitaLink-be/src/controllers/mobile/medicalHistoryController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get combined medical history (all types)
const getCombinedHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Getting combined medical history for user:', userId);

    // Get all types of medical history including lab results
    const [medicalRecords, consultations, queues, prescriptions, labResults] = await Promise.all([
      // Medical Records
      prisma.medicalRecord.findMany({
        where: { userId },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            }
          },
          consultation: {
            select: {
              id: true,
              type: true,
              symptoms: true,
            }
          },
        },
        orderBy: { visitDate: 'desc' }
      }),

      // Consultations 
      prisma.consultation.findMany({
        where: { userId },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            }
          },
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Queue History
      prisma.queue.findMany({
        where: { userId },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            }
          },
        },
        orderBy: { queueDate: 'desc' }
      }),

      // Prescription History
      prisma.prescription.findMany({
        where: { userId },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            }
          },
        },
        orderBy: { createdAt: 'desc' }
      }),

      // ✅ ADD: Lab Results
      prisma.labResult.findMany({
        where: { userId },
        include: {
          medicalRecord: {
            include: {
              doctor: {
                select: {
                  id: true,
                  name: true,
                  specialty: true,
                }
              }
            }
          }
        },
        orderBy: { testDate: 'desc' }
      })
    ]);

    console.log('📊 Found records:', {
      medicalRecords: medicalRecords.length,
      consultations: consultations.length,
      queues: queues.length,
      prescriptions: prescriptions.length,
      labResults: labResults.length,
    });

    res.json({
      success: true,
      message: 'Combined medical history retrieved successfully',
      data: {
        medicalRecords,
        consultations,
        queues,
        prescriptions,
        labResults, // ✅ ADD: Include lab results
        totalRecords: medicalRecords.length + consultations.length + queues.length + prescriptions.length + labResults.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting combined medical history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get combined medical history',
      error: error.message
    });
  }
};

// Get medical records only
const getMedicalRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Getting medical records for user:', userId);

    const medicalRecords = await prisma.medicalRecord.findMany({
      where: { userId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          }
        },
        consultation: {
          select: {
            id: true,
            type: true,
            symptoms: true,
          }
        },
      },
      orderBy: { visitDate: 'desc' }
    });

    console.log('📋 Found', medicalRecords.length, 'medical records');

    res.json({
      success: true,
      message: 'Medical records retrieved successfully',
      data: {
        records: medicalRecords
      }
    });

  } catch (error) {
    console.error('❌ Error getting medical records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get medical records',
      error: error.message
    });
  }
};

// ✅ ADD: Get lab results endpoint
const getLabResults = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🧪 Getting lab results for user:', userId);

    const labResults = await prisma.labResult.findMany({
      where: { userId },
      include: {
        medicalRecord: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                specialty: true,
              }
            }
          }
        }
      },
      orderBy: { testDate: 'desc' }
    });

    console.log('🧪 Found', labResults.length, 'lab results');

    res.json({
      success: true,
      message: 'Lab results retrieved successfully',
      data: {
        labResults
      }
    });

  } catch (error) {
    console.error('❌ Error getting lab results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lab results',
      error: error.message
    });
  }
};

// Get consultation history
const getConsultationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('💬 Getting consultation history for user:', userId);

    const consultations = await prisma.consultation.findMany({
      where: { userId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('💬 Found', consultations.length, 'consultations');

    res.json({
      success: true,
      message: 'Consultation history retrieved successfully',
      data: {
        consultations
      }
    });

  } catch (error) {
    console.error('❌ Error getting consultation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consultation history',
      error: error.message
    });
  }
};

// Get queue history
const getQueueHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔢 Getting queue history for user:', userId);

    const queues = await prisma.queue.findMany({
      where: { userId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          }
        },
      },
      orderBy: { queueDate: 'desc' }
    });

    console.log('🔢 Found', queues.length, 'queues');

    res.json({
      success: true,
      message: 'Queue history retrieved successfully',
      data: {
        queues
      }
    });

  } catch (error) {
    console.error('❌ Error getting queue history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue history',
      error: error.message
    });
  }
};

// Get prescription history
const getPrescriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('💊 Getting prescription history for user:', userId);

    const prescriptions = await prisma.prescription.findMany({
      where: { userId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('💊 Found', prescriptions.length, 'prescriptions');

    res.json({
      success: true,
      message: 'Prescription history retrieved successfully',
      data: {
        prescriptions
      }
    });

  } catch (error) {
    console.error('❌ Error getting prescription history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prescription history',
      error: error.message
    });
  }
};

module.exports = {
  getCombinedHistory,
  getMedicalRecords,
  getLabResults, // ✅ ADD: Export lab results function
  getConsultationHistory,
  getQueueHistory,
  getPrescriptionHistory
};