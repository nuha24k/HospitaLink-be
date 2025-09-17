const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get prescription history - FIXED JSON PARSING
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
        transaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            paidAt: true
          }
        },
        consultation: {
          select: {
            id: true,
            symptoms: true,
            aiAnalysis: true,
            recommendation: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('💊 Raw prescriptions count:', prescriptions.length);

    // ✅ FIXED: Safe JSON parsing with proper error handling
    const enrichedPrescriptions = prescriptions.map(prescription => {
      let medications = [];
      
      try {
        // ✅ FIX: Safe parsing of medications field
        let rawMedications = prescription.medications;
        
        if (typeof rawMedications === 'string') {
          try {
            rawMedications = JSON.parse(rawMedications);
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse medications JSON for prescription ${prescription.id}:`, parseError.message);
            rawMedications = [];
          }
        }
        
        if (Array.isArray(rawMedications) && rawMedications.length > 0) {
          medications = rawMedications.map((med, index) => ({
            medicationId: med.medicationId || med.id || `med-${prescription.id}-${index}`,
            genericName: med.genericName || med.name || med.medicationName || 'Unknown Medication',
            brandName: med.brandName || null,
            dosage: med.dosage || med.strength || '500mg',
            frequency: med.frequency || '3x sehari', 
            duration: parseInt(med.duration) || 7,
            instructions: med.instructions || med.dosageInstructions || 'Diminum sesuai petunjuk dokter',
            quantity: parseInt(med.quantity) || 10,
            unit: med.unit || 'tablet',
            price: parseFloat(med.price || med.pricePerUnit) || 0,
            totalPrice: parseFloat(med.totalPrice) || (parseFloat(med.price || med.pricePerUnit || 0) * parseInt(med.quantity || 1)),
            // Additional details
            category: med.category || null,
            manufacturer: med.manufacturer || null,
            sideEffects: med.sideEffects || null,
            contraindications: med.contraindications || null,
            storageInstructions: med.storageInstructions || null,
            activeIngredient: med.activeIngredient || null,
            strength: med.strength || med.dosage || null,
            routeOfAdministration: med.routeOfAdministration || 'Oral',
            foodInstructions: med.foodInstructions || null,
            warnings: med.warnings || null,
          }));
        }
      } catch (e) {
        console.error(`❌ Error processing medications for prescription ${prescription.id}:`, e);
        medications = [];
      }

      // ✅ FIX: Safe parsing of consultation recommendation
      let diagnosis = 'Tidak ada diagnosis';
      try {
        if (prescription.consultation?.recommendation) {
          if (typeof prescription.consultation.recommendation === 'string') {
            // Check if it's JSON or plain text
            if (prescription.consultation.recommendation.startsWith('{')) {
              const parsed = JSON.parse(prescription.consultation.recommendation);
              diagnosis = parsed.diagnosis || 'Tidak ada diagnosis';
            } else {
              // It's plain text, not JSON
              diagnosis = prescription.consultation.recommendation;
            }
          } else if (typeof prescription.consultation.recommendation === 'object') {
            diagnosis = prescription.consultation.recommendation.diagnosis || 'Tidak ada diagnosis';
          }
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse consultation recommendation for prescription ${prescription.id}:`, e.message);
        // Use fallback
        diagnosis = 'Tidak ada diagnosis';
      }

      console.log(`✅ Processed prescription ${prescription.id} with ${medications.length} medications`);

      return {
        ...prescription,
        medications,
        diagnosis,
        symptoms: prescription.consultation?.symptoms || null,
        clinicalFindings: prescription.clinicalFindings || null,
        labResults: prescription.labResults || null,
        allergies: prescription.allergies || null,
        medicalHistory: prescription.medicalHistory || null,
        treatmentPlan: prescription.treatmentPlan || prescription.instructions || null,
        followUpInstructions: prescription.followUpInstructions || null,
        pharmacistNotes: prescription.pharmacyNotes || null,
        isNew: isNewPrescription(prescription.createdAt),
        canPay: !prescription.isPaid && prescription.totalAmount > 0,
        paymentInfo: prescription.transaction ? {
          transactionId: prescription.transaction.id,
          status: prescription.transaction.status,
          paidAmount: prescription.transaction.amount,
          paymentMethod: prescription.transaction.paymentMethod,
          paidAt: prescription.transaction.paidAt
        } : null
      };
    });

    console.log('💊 Successfully processed', enrichedPrescriptions.length, 'prescriptions');
    console.log('💊 Sample prescription medications count:', enrichedPrescriptions[0]?.medications?.length || 0);

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

// ✅ ENHANCED: Get prescription detail with better error handling
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
        transaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            paidAt: true
          }
        },
        consultation: {
          select: {
            id: true,
            symptoms: true,
            recommendation: true
          }
        }
      }
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // ✅ FIX: Safe medication parsing
    let medications = [];
    try {
      let rawMedications = prescription.medications;
      
      if (typeof rawMedications === 'string') {
        try {
          rawMedications = JSON.parse(rawMedications);
        } catch (parseError) {
          console.warn('Failed to parse medications JSON:', parseError.message);
          rawMedications = [];
        }
      }
      
      if (Array.isArray(rawMedications)) {
        medications = rawMedications;
        
        // Enrich with medication details from database
        for (let med of medications) {
          if (med.medicationId) {
            try {
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
            } catch (dbError) {
              console.warn('Failed to fetch medication detail:', dbError.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to process medications:', e.message);
      medications = [];
    }

    const enrichedPrescription = {
      ...prescription,
      medications,
      isNew: isNewPrescription(prescription.createdAt),
      canPay: !prescription.isPaid && prescription.totalAmount > 0,
      paymentInfo: prescription.transaction ? {
        transactionId: prescription.transaction.id,
        status: prescription.transaction.status,
        paidAmount: prescription.transaction.amount,
        paymentMethod: prescription.transaction.paymentMethod,
        paidAt: prescription.transaction.paidAt
      } : null
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

// ✅ ENHANCED: Pay prescription with better validation
const payPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { paymentMethod, amount } = req.body;
    const userId = req.user.id;

    console.log('💳 Processing payment for prescription:', prescriptionId);

    // Verify prescription ownership and status
    const prescription = await prisma.prescription.findFirst({
      where: { 
        id: prescriptionId,
        userId: userId,
        isPaid: false
      }
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found or already paid'
      });
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'PRESCRIPTION_PAYMENT',
        status: 'PAID', // For MVP, assume immediate payment
        amount: amount || prescription.totalAmount || 0,
        paymentMethod: paymentMethod.toUpperCase(),
        description: `Payment for prescription ${prescription.prescriptionCode}`,
        prescriptionId,
        paidAt: new Date()
      }
    });

    // Update prescription payment status
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        totalAmount: amount || prescription.totalAmount || 0,
        updatedAt: new Date()
      }
    });

    // Create payment notification
    await prisma.notification.create({
      data: {
        userId: userId,
        title: 'Pembayaran Resep Berhasil',
        message: `Pembayaran resep ${prescription.prescriptionCode} sebesar Rp ${transaction.amount} berhasil diproses.`,
        type: 'PAYMENT',
        priority: 'MEDIUM',
        relatedData: JSON.stringify({
          prescriptionId: prescriptionId,
          transactionId: transaction.id,
          prescriptionCode: prescription.prescriptionCode,
          amount: transaction.amount,
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
          transactionId: transaction.id,
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
        transactionId: transaction.id,
        paymentStatus: 'PAID',
        paymentMethod: paymentMethod,
        amount: transaction.amount,
        paidAt: transaction.paidAt
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

// Get lab results - NO CHANGES NEEDED
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

// Mark lab result as read - NO CHANGES NEEDED
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