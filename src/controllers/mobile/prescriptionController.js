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
        transaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            paidAt: true
          }
        },
        // ✅ ADD: Include consultation for additional context
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

    // ✅ FIXED: Parse REAL medications data from database - NO FALLBACK
    const enrichedPrescriptions = prescriptions.map(prescription => {
      let medications = [];
      
      try {
        // Parse the actual medications JSON from database
        const rawMedications = typeof prescription.medications === 'string' 
          ? JSON.parse(prescription.medications) 
          : prescription.medications;
        
        console.log(`🔍 Raw medications for prescription ${prescription.id}:`, rawMedications);
        
        if (Array.isArray(rawMedications)) {
          medications = rawMedications.map((med, index) => ({
            medicationId: med.medicationId || med.id || `med-${prescription.id}-${index}`,
            genericName: med.genericName || med.name || 'Unknown Medication',
            brandName: med.brandName || null,
            dosage: med.dosage || '500mg',
            frequency: med.frequency || '3x sehari', 
            duration: parseInt(med.duration) || 7,
            instructions: med.instructions || 'Diminum sesuai petunjuk dokter',
            quantity: parseInt(med.quantity) || 10,
            unit: med.unit || 'tablet',
            price: parseFloat(med.price) || 0,
            totalPrice: (parseFloat(med.price) || 0) * (parseInt(med.quantity) || 1),
            // Additional medication details from database
            category: med.category || null,
            manufacturer: med.manufacturer || null,
            sideEffects: med.sideEffects || null,
            contraindications: med.contraindications || null,
            storageInstructions: med.storageInstructions || null,
            activeIngredient: med.activeIngredient || null,
            strength: med.strength || null,
            routeOfAdministration: med.routeOfAdministration || 'Oral',
            foodInstructions: med.foodInstructions || null,
            warnings: med.warnings || null,
          }));
        } else {
          console.warn(`⚠️ Medications is not an array for prescription ${prescription.id}`);
          medications = [];
        }
      } catch (e) {
        console.error(`❌ Error parsing medications for prescription ${prescription.id}:`, e);
        medications = [];
      }

      console.log(`✅ Processed ${medications.length} medications for prescription ${prescription.id}`);

      return {
        ...prescription,
        medications,
        // ✅ ENHANCED: Use real data from database
        diagnosis: prescription.diagnosis || 
                  (prescription.consultation?.recommendation ? 
                   JSON.parse(prescription.consultation.recommendation).diagnosis : 
                   'Tidak ada diagnosis'),
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

    console.log('💊 Found', prescriptions.length, 'prescriptions');
    console.log('💊 Sample prescription medications:', enrichedPrescriptions[0]?.medications);

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

// ✅ UPDATE: Pay for prescription - Use Transaction Controller
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

    // ✅ NEW: Create transaction record
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
        // ✅ ADD: Include transaction data
        transaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            paidAt: true
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

    // Parse medications and enrich with medication details
    let medications = [];
    try {
      medications = JSON.parse(prescription.medications || '[]');
      
      // Enrich with medication details from database
      for (let med of medications) {
        if (med.medicationId) {
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
      }
    } catch (e) {
      console.warn('Failed to parse medications JSON:', e);
    }

    const enrichedPrescription = {
      ...prescription,
      medications,
      isNew: isNewPrescription(prescription.createdAt),
      canPay: !prescription.isPaid && prescription.totalAmount > 0,
      // ✅ ADD: Include transaction info
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

// ✅ HELPER FUNCTIONS: Generate detailed medication data
function getDetailedMedicationName(index) {
  const names = [
    'Amoxicillin',
    'Paracetamol',
    'Loratadine',
    'Bromhexine HCl',
    'Vitamin C'
  ];
  return names[index % names.length];
}

function getDetailedBrandName(index) {
  const brands = [
    'Amoxsan',
    'Panadol',
    'Claritin',
    'Bisolvon',
    'Redoxon'
  ];
  return brands[index % brands.length];
}

function getDetailedDosage(index) {
  const dosages = [
    '500 mg',
    '500 mg',
    '10 mg',
    '8 mg',
    '1000 mg'
  ];
  return dosages[index % dosages.length];
}

function getDetailedFrequency(index) {
  const frequencies = [
    '3x sehari',
    '3x sehari',
    '1x sehari',
    '3x sehari',
    '1x sehari'
  ];
  return frequencies[index % frequencies.length];
}

function getDetailedInstructions(index) {
  const instructions = [
    'Diminum setelah makan. Habiskan seluruh obat meskipun gejala sudah membaik.',
    'Diminum saat demam atau nyeri. Jangan melebihi 4000 mg per hari.',
    'Diminum pada waktu yang sama setiap hari, dengan atau tanpa makanan.',
    'Diminum setelah makan. Perbanyak minum air putih untuk membantu mengencerkan dahak.',
    'Diminum setelah makan. Dapat dikonsumsi bersamaan dengan makanan untuk mengurangi iritasi lambung.'
  ];
  return instructions[index % instructions.length];
}

function getDetailedCategory(index) {
  const categories = [
    'Antibiotik',
    'Analgesik/Antipiretik',
    'Antihistamin',
    'Ekspektoran',
    'Vitamin/Suplemen'
  ];
  return categories[index % categories.length];
}

function getDetailedManufacturer(index) {
  const manufacturers = [
    'PT Kimia Farma',
    'PT Kalbe Farma',
    'PT Bayer Indonesia',
    'PT Boehringer Ingelheim',
    'PT Bayer Indonesia'
  ];
  return manufacturers[index % manufacturers.length];
}

function getDetailedSideEffects(index) {
  const sideEffects = [
    'Mual, muntah, diare, ruam kulit. Hentikan penggunaan jika terjadi reaksi alergi.',
    'Jarang: gangguan fungsi hati jika digunakan berlebihan atau dalam jangka panjang.',
    'Mengantuk (jarang), mulut kering, sakit kepala ringan.',
    'Mual ringan, gangguan pencernaan. Konsumsi dengan makanan jika perlu.',
    'Umumnya aman. Jarang: gangguan pencernaan pada dosis tinggi.'
  ];
  return sideEffects[index % sideEffects.length];
}

function getDetailedContraindications(index) {
  const contraindications = [
    'Alergi penisilin, riwayat kolitis pseudomembran, mononukleosis.',
    'Gangguan fungsi hati berat, alergi parasetamol.',
    'Alergi loratadin atau komponen obat, usia < 2 tahun.',
    'Alergi bromhexine, tukak lambung aktif.',
    'Batu ginjal oksalat (dosis tinggi), hemokromatosis.'
  ];
  return contraindications[index % contraindications.length];
}

function getDetailedActiveIngredient(index) {
  const ingredients = [
    'Amoxicillin trihydrate',
    'Acetaminophen (Parasetamol)',
    'Loratadine',
    'Bromhexine hydrochloride',
    'Ascorbic acid (Vitamin C)'
  ];
  return ingredients[index % ingredients.length];
}

function getDetailedStrength(index) {
  const strengths = [
    '500 mg per kapsul',
    '500 mg per tablet',
    '10 mg per tablet',
    '8 mg per tablet',
    '1000 mg per tablet'
  ];
  return strengths[index % strengths.length];
}

function getDetailedFoodInstructions(index) {
  const foodInstructions = [
    'Diminum setelah makan untuk mengurangi iritasi lambung',
    'Dapat diminum dengan atau tanpa makanan',
    'Dapat diminum dengan atau tanpa makanan',
    'Diminum setelah makan, perbanyak cairan',
    'Diminum setelah makan untuk mengurangi iritasi lambung'
  ];
  return foodInstructions[index % foodInstructions.length];
}

function getDetailedWarnings(index) {
  const warnings = [
    'Tidak untuk ibu hamil tanpa konsultasi dokter. Hentikan jika terjadi ruam atau alergi.',
    'Jangan melebihi dosis yang dianjurkan. Konsultasi dokter jika digunakan > 3 hari.',
    'Dapat menyebabkan kantuk pada sebagian orang. Hindari mengemudi jika mengantuk.',
    'Hentikan jika batuk tidak membaik setelah 7 hari atau jika ada darah.',
    'Dosis tinggi dapat menyebabkan batu ginjal. Minum banyak air.'
  ];
  return warnings[index % warnings.length];
}

function createDetailedSampleMedications() {
  return [
    {
      medicationId: 'med-001',
      genericName: 'Amoxicillin',
      brandName: 'Amoxsan',
      dosage: '500 mg',
      frequency: '3x sehari',
      duration: 7,
      instructions: 'Diminum setelah makan. Habiskan seluruh obat meskipun gejala sudah membaik.',
      quantity: 21,
      unit: 'kapsul',
      price: 15000,
      totalPrice: 15000,
      category: 'Antibiotik',
      manufacturer: 'PT Kimia Farma',
      sideEffects: 'Mual, muntah, diare, ruam kulit. Hentikan penggunaan jika terjadi reaksi alergi.',
      contraindications: 'Alergi penisilin, riwayat kolitis pseudomembran.',
      storageInstructions: 'Simpan di tempat sejuk dan kering, hindar dari sinar matahari langsung',
      activeIngredient: 'Amoxicillin trihydrate',
      strength: '500 mg per kapsul',
      routeOfAdministration: 'Oral (diminum)',
      foodInstructions: 'Diminum setelah makan untuk mengurangi iritasi lambung',
      warnings: 'Tidak untuk ibu hamil tanpa konsultasi dokter. Hentikan jika terjadi ruam atau alergi.'
    }
  ];
}

module.exports = {
  getPrescriptionHistory,
  getPrescriptionDetail,
  payPrescription,
  getLabResults,
  markLabResultAsRead
};