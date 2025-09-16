const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    // Parse medications JSON and add calculated fields
    const enrichedPrescriptions = prescriptions.map(prescription => {
      let medications = [];
      try {
        medications = JSON.parse(prescription.medications || '[]');
      } catch (e) {
        console.warn('Failed to parse medications JSON:', e);
      }

      return {
        ...prescription,
        medications,
        isNew: isNewPrescription(prescription.createdAt),
        canPay: prescription.paymentStatus === 'PENDING' && !prescription.isPaid,
      };
    });

    console.log('💊 Found', prescriptions.length, 'prescriptions');

    res.json({
      success: true,
      message: 'Prescription history retrieved successfully',
      data: {
        prescriptions: enrichedPrescriptions
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

// Get prescription detail
const getPrescriptionDetail = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const userId = req.user.id;

    console.log('📄 Getting prescription detail:', prescriptionId);

    const prescription = await prisma.prescription.findFirst({
      where: { 
        id: prescriptionId,
        userId: userId 
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          }
        },
      }
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Parse medications and enrich with medication details
    let medications = [];
    try {
      medications = JSON.parse(prescription.medications || '[]');
      
      // Enrich with medication details from database
      for (let med of medications) {
        const medicationDetail = await prisma.medication.findUnique({
          where: { id: med.medicationId }
        });
        
        if (medicationDetail) {
          med.medicationDetails = {
            genericName: medicationDetail.genericName,
            brandName: medicationDetail.brandName,
            category: medicationDetail.category,
            manufacturer: medicationDetail.manufacturer,
            sideEffects: medicationDetail.sideEffects,
            contraindications: medicationDetail.contraindications,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse medications JSON:', e);
    }

    const enrichedPrescription = {
      ...prescription,
      medications,
      isNew: isNewPrescription(prescription.createdAt),
      canPay: prescription.paymentStatus === 'PENDING' && !prescription.isPaid,
    };

    res.json({
      success: true,
      message: 'Prescription detail retrieved successfully',
      data: enrichedPrescription
    });

  } catch (error) {
    console.error('❌ Error getting prescription detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prescription detail',
      error: error.message
    });
  }
};

// Pay for prescription
const payPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { paymentMethod } = req.body;
    const userId = req.user.id;

    console.log('💳 Processing payment for prescription:', prescriptionId);

    // Verify prescription ownership and status
    const prescription = await prisma.prescription.findFirst({
      where: { 
        id: prescriptionId,
        userId: userId,
        paymentStatus: 'PENDING'
      }
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found or already paid'
      });
    }

    // Update prescription payment status
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: paymentMethod.toUpperCase(),
        isPaid: true,
        updatedAt: new Date()
      }
    });

    // Create payment notification
    await prisma.notification.create({
      data: {
        userId: userId,
        title: 'Pembayaran Resep Berhasil',
        message: `Pembayaran resep ${prescription.prescriptionCode} sebesar Rp ${prescription.totalAmount} berhasil diproses.`,
        type: 'PAYMENT',
        priority: 'MEDIUM',
        relatedData: JSON.stringify({
          prescriptionId: prescriptionId,
          prescriptionCode: prescription.prescriptionCode,
          amount: prescription.totalAmount,
          paymentMethod: paymentMethod
        })
      }
    });

    // Create medication reminder notification
    await prisma.notification.create({
      data: {
        userId: userId,
        title: 'Obat Siap Diambil',
        message: `Resep ${prescription.prescriptionCode} telah dibayar. Silakan ambil obat di farmasi dalam 2x24 jam.`,
        type: 'SYSTEM',
        priority: 'HIGH',
        relatedData: JSON.stringify({
          prescriptionId: prescriptionId,
          prescriptionCode: prescription.prescriptionCode,
          action: 'pickup_medication'
        })
      }
    });

    console.log('✅ Payment processed successfully');

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        prescriptionId: prescriptionId,
        paymentStatus: 'PAID',
        paymentMethod: paymentMethod,
        paidAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
};

// Get lab results
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

// Mark lab result as read
const markLabResultAsRead = async (req, res) => {
  try {
    const { labResultId } = req.params;
    const userId = req.user.id;

    await prisma.labResult.updateMany({
      where: { 
        id: labResultId,
        userId: userId 
      },
      data: { 
        isNew: false,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Lab result marked as read'
    });

  } catch (error) {
    console.error('❌ Error marking lab result as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark lab result as read',
      error: error.message
    });
  }
};

// Helper function
const isNewPrescription = (createdAt) => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffInHours = (now - created) / (1000 * 60 * 60);
  return diffInHours < 24;
};

module.exports = {
  getPrescriptionHistory,
  getPrescriptionDetail,
  payPrescription,
  getLabResults,
  markLabResultAsRead
};