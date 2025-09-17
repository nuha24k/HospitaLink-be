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
            aiAnalysis: true,
            recommendation: true,
          }
        },
        // ✅ ADD: Include related lab results
        labResults: {
          select: {
            id: true,
            testName: true,
            testType: true,
            results: true,
            isNormal: true,
            isCritical: true,
            testDate: true,
          }
        }
      },
      orderBy: { visitDate: 'desc' }
    });

    // ✅ FIXED: Use REAL data from database - NO FALLBACK
    const enrichedRecords = medicalRecords.map((record, index) => {
      
      // Parse real symptoms from database
      let symptoms = null;
      try {
        if (record.symptoms) {
          symptoms = typeof record.symptoms === 'string' ? 
            JSON.parse(record.symptoms) : record.symptoms;
        } else if (record.consultation?.symptoms) {
          symptoms = typeof record.consultation.symptoms === 'string' ? 
            JSON.parse(record.consultation.symptoms) : record.consultation.symptoms;
        }
      } catch (e) {
        console.error('Error parsing symptoms:', e);
      }

      // Parse real vital signs from database  
      let vitalSigns = null;
      try {
        if (record.vitalSigns) {
          vitalSigns = typeof record.vitalSigns === 'string' ? 
            JSON.parse(record.vitalSigns) : record.vitalSigns;
        }
      } catch (e) {
        console.error('Error parsing vital signs:', e);
      }

      // Parse real medications from database
      let medications = null;
      try {
        if (record.medications) {
          medications = typeof record.medications === 'string' ? 
            JSON.parse(record.medications) : record.medications;
        }
      } catch (e) {
        console.error('Error parsing medications:', e);
      }

      // Parse AI analysis for additional clinical data
      let aiAnalysis = null;
      try {
        if (record.consultation?.aiAnalysis) {
          aiAnalysis = typeof record.consultation.aiAnalysis === 'string' ? 
            JSON.parse(record.consultation.aiAnalysis) : record.consultation.aiAnalysis;
        }
      } catch (e) {
        console.error('Error parsing AI analysis:', e);
      }

      return {
        ...record,
        symptoms,
        vitalSigns, 
        medications,
        // ✅ ENHANCED: Use real clinical data from consultation/AI analysis
        chiefComplaint: record.chiefComplaint || 
                       (aiAnalysis?.chiefComplaint) || 
                       `Kunjungan ${record.consultation?.type || 'konsultasi'} pada ${record.visitDate.toDateString()}`,
        
        historyOfPresentIllness: record.historyOfPresentIllness || 
                                (aiAnalysis?.historyOfPresentIllness) || null,
        
        physicalExamination: record.physicalExamination || 
                            (aiAnalysis?.physicalExamination) || null,
        
        laboratoryResults: record.labResults?.length > 0 ? 
                          record.labResults.map(lab => ({
                            testName: lab.testName,
                            testType: lab.testType, 
                            results: lab.results,
                            isNormal: lab.isNormal,
                            isCritical: lab.isCritical,
                            testDate: lab.testDate
                          })) : null,
        
        differentialDiagnosis: record.differentialDiagnosis || 
                              (aiAnalysis?.differentialDiagnosis) || null,
        
        treatmentPlan: record.treatmentPlan || record.treatment || null,
        
        patientEducation: record.patientEducation || 
                         (aiAnalysis?.patientEducation) || null,
        
        followUpPlan: record.followUpPlan || 
                     (aiAnalysis?.followUpPlan) || null,
        
        prognosisAssessment: record.prognosisAssessment || 
                            (aiAnalysis?.prognosis) || null,
        
        clinicalImpression: record.clinicalImpression || 
                           (aiAnalysis?.clinicalImpression) || record.diagnosis,
      };
    });

    console.log('📋 Found', medicalRecords.length, 'medical records');
    console.log('📋 Sample record data:', {
      id: enrichedRecords[0]?.id,
      symptomsType: typeof enrichedRecords[0]?.symptoms,
      medicationsType: typeof enrichedRecords[0]?.medications,
      labResultsCount: enrichedRecords[0]?.laboratoryResults?.length || 0
    });

    res.json({
      success: true,
      message: 'Medical records retrieved successfully',
      data: {
        records: enrichedRecords
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
            },
            consultation: {
              select: {
                id: true,
                type: true,
                symptoms: true,
              }
            }
          }
        }
      },
      orderBy: { testDate: 'desc' }
    });

    // ✅ FIXED: Use REAL lab data - NO FALLBACK
    const enrichedLabResults = labResults.map((labResult, index) => {
      
      // Parse real results from database
      let results = {};
      try {
        if (labResult.results) {
          results = typeof labResult.results === 'string' ? 
            JSON.parse(labResult.results) : labResult.results;
        }
      } catch (e) {
        console.error('Error parsing lab results:', e);
        results = {};
      }

      // Parse real normal ranges from database
      let normalRange = {};
      try {
        if (labResult.normalRange) {
          normalRange = typeof labResult.normalRange === 'string' ? 
            JSON.parse(labResult.normalRange) : labResult.normalRange;
        }
      } catch (e) {
        console.error('Error parsing normal ranges:', e);
        normalRange = {};
      }

      return {
        ...labResult,
        results,
        normalRange,
        // ✅ ENHANCED: Use real metadata if available
        testDescription: labResult.testDescription || 
                        `Pemeriksaan ${labResult.testType} - ${labResult.testName}`,
        
        clinicalSignificance: labResult.clinicalSignificance || 
                             (labResult.isCritical ? 'Hasil memerlukan perhatian medis segera' : 
                              labResult.isNormal === false ? 'Hasil di luar rentang normal' : 
                              'Hasil dalam batas normal'),
        
        recommendedActions: labResult.recommendedActions || 
                           (labResult.isCritical ? 'Konsultasi dokter segera' : 
                            'Diskusikan hasil dengan dokter pada kunjungan berikutnya'),
      };
    });

    console.log('🧪 Found', labResults.length, 'lab results');
    console.log('🧪 Sample lab result:', {
      id: enrichedLabResults[0]?.id,
      resultsKeys: Object.keys(enrichedLabResults[0]?.results || {}),
      normalRangeKeys: Object.keys(enrichedLabResults[0]?.normalRange || {})
    });

    res.json({
      success: true,
      message: 'Lab results retrieved successfully',
      data: {
        labResults: enrichedLabResults
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

// ✅ HELPER FUNCTIONS: Enhance medical record data
function enhanceSymptoms(existingSymptoms, index) {
  const defaultSymptoms = [
    {
      main: 'Batuk berdahak, demam, pilek',
      duration: '3 hari',
      severity: 'Sedang',
      onset: 'Bertahap',
      quality: 'Dahak berwarna kuning kehijauan',
      associatedSymptoms: 'Sakit tenggorokan, hidung tersumbat, sakit kepala ringan',
      relievingFactors: 'Istirahat, minum air hangat',
      aggravatingFactors: 'Cuaca dingin, aktivitas berlebihan'
    },
    {
      main: 'Nyeri perut, mual, muntah',
      duration: '1 hari', 
      severity: 'Berat',
      onset: 'Mendadak',
      quality: 'Nyeri seperti ditusuk-tusuk di ulu hati',
      associatedSymptoms: 'Perut kembung, tidak nafsu makan',
      relievingFactors: 'Posisi duduk, tidak makan',
      aggravatingFactors: 'Makanan pedas, stress'
    }
  ];

  if (existingSymptoms && typeof existingSymptoms === 'object') {
    return existingSymptoms;
  }

  return defaultSymptoms[index % defaultSymptoms.length];
}

function enhanceVitalSigns(existingVitalSigns, index) {
  const defaultVitalSigns = [
    {
      temperature: '37.8°C',
      bloodPressure: '120/80 mmHg',
      heartRate: '88 bpm',
      respiratoryRate: '20/menit',
      oxygenSaturation: '98%',
      weight: '65 kg',
      height: '165 cm',
      bmi: '23.9 kg/m²',
      painScale: '3/10'
    },
    {
      temperature: '36.5°C',
      bloodPressure: '110/70 mmHg', 
      heartRate: '72 bpm',
      respiratoryRate: '18/menit',
      oxygenSaturation: '99%',
      weight: '58 kg',
      height: '160 cm',
      bmi: '22.7 kg/m²',
      painScale: '6/10'
    }
  ];

  if (existingVitalSigns && typeof existingVitalSigns === 'object') {
    return existingVitalSigns;
  }

  return defaultVitalSigns[index % defaultVitalSigns.length];
}

function enhanceMedications(existingMedications, index) {
  const defaultMedications = [
    [
      {
        name: 'Amoxicillin 500mg',
        dosage: '3x1 kapsul',
        duration: '7 hari',
        instructions: 'Setelah makan'
      },
      {
        name: 'Paracetamol 500mg',
        dosage: '3x1 tablet',
        duration: '5 hari',
        instructions: 'Saat demam/nyeri'
      }
    ],
    [
      {
        name: 'Omeprazole 20mg',
        dosage: '2x1 kapsul',
        duration: '14 hari',
        instructions: 'Sebelum makan'
      },
      {
        name: 'Domperidone 10mg',
        dosage: '3x1 tablet',
        duration: '7 hari',
        instructions: 'Sebelum makan'
      }
    ]
  ];

  if (existingMedications && Array.isArray(existingMedications)) {
    return existingMedications;
  }

  return defaultMedications[index % defaultMedications.length];
}

function getDetailedChiefComplaint(index) {
  const complaints = [
    'Pasien datang dengan keluhan batuk berdahak yang sudah berlangsung 3 hari, disertai demam dan pilek.',
    'Pasien mengeluh nyeri perut hebat di ulu hati sejak 1 hari yang lalu, disertai mual dan muntah.',
    'Pasien datang untuk kontrol rutin hipertensi dan keluhan pusing berputar.',
    'Pasien mengeluh sesak napas yang memberat, terutama saat beraktivitas.',
    'Pasien datang dengan keluhan diare berulang dan demam sejak 2 hari yang lalu.'
  ];
  return complaints[index % complaints.length];
}

function getDetailedHPI(index) {
  const hpi = [
    'Keluhan dimulai 3 hari yang lalu dengan batuk kering, kemudian berkembang menjadi batuk berdahak. Dahak berwarna kuning kehijauan. Demam naik turun hingga 38°C. Pasien juga mengeluh hidung tersumbat dan sakit tenggorokan. Tidak ada riwayat kontak dengan penderita TB. Nafsu makan menurun.',
    'Nyeri perut dimulai mendadak setelah makan makanan pedas kemarin malam. Nyeri seperti ditusuk-tusuk, menjalar ke punggung. Muntah 3x berisi sisa makanan. Tidak ada riwayat nyeri serupa sebelumnya. BAB normal, tidak ada darah.',
    'Tekanan darah terkontrol dengan obat rutin. Keluhan pusing berputar muncul 2 hari terakhir, terutama saat bangun tidur. Tidak ada gangguan pendengaran atau tinitus. Tidak ada kelemahan anggota gerak.',
    'Sesak napas progresif sejak 1 minggu terakhir. Awalnya hanya saat naik tangga, sekarang saat jalan biasa. Tidur harus dengan 2 bantal. Kaki bengkak sejak 3 hari. Riwayat hipertensi 10 tahun.',
    'Diare cair 4-5x per hari sejak 2 hari lalu. Tidak ada lendir atau darah. Demam hingga 38.5°C. Mual tapi tidak muntah. Kemungkinan setelah makan di warung. Tidak ada riwayat perjalanan.'
  ];
  return hpi[index % hpi.length];
}

function getDetailedPhysicalExam(index) {
  const physicalExam = [
    'Keadaan umum: Tampak sakit ringan, kesadaran kompos mentis. Kepala: Konjungtiva tidak anemis, sklera tidak ikterik. THT: Tenggorokan hiperemis, tonsil T1-T1 tidak hiperemis. Leher: Tidak ada pembesaran KGB. Thorax: Paru - vesikuler, ronki basah halus di kedua basal. Jantung - BJ I-II reguler, tidak ada murmur. Abdomen: Supel, bising usus normal. Ekstremitas: Tidak ada edema.',
    'Keadaan umum: Tampak kesakitan, gelisah. Vital sign dalam batas normal kecuali nadi sedikit cepat. Abdomen: Inspeksi - tidak ada distensi. Palpasi - nyeri tekan epigastrium, tidak ada massa, Murphy sign (-). Perkusi - timpani. Auskultasi - bising usus normal. Tidak ada tanda peritonitis.',
    'Keadaan umum: Baik, kesadaran kompos mentis. Tekanan darah 140/90 mmHg. Pemeriksaan neurologis: Tes Romberg (+), nistagmus (-), tidak ada defisit neurologis fokal. Otoskopi dalam batas normal bilateral.',
    'Keadaan umum: Tampak sesak, orthopnea (+). JVP meningkat 5+2 cmH2O. Thorax: Paru - ronki basah halus di kedua basal. Jantung - BJ I-II reguler, gallop (+), murmur (-). Abdomen: Hepatomegali 2 jari BAC. Ekstremitas: Edema pretibial bilateral.',
    'Keadaan umum: Tampak dehidrasi ringan, turgor kulit menurun. Mulut: Mukosa agak kering. Abdomen: Bising usus meningkat, tidak ada nyeri tekan, tidak ada hepatosplenomegali. Ekstremitas: Akral hangat, CRT < 2 detik.'
  ];
  return physicalExam[index % physicalExam.length];
}

function getDetailedLabResults(index) {
  const labResults = [
    'Darah lengkap: Hb 12.5 g/dL, Leukosit 12.000/μL (neutrofil 75%), Trombosit 350.000/μL. CRP 15 mg/L (meningkat). Urinalisis dalam batas normal.',
    'Darah lengkap dalam batas normal. SGOT 45 U/L, SGPT 52 U/L (sedikit meningkat). Amilase serum 120 U/L (normal). H. pylori rapid test: negatif.',
    'Darah lengkap, gula darah, fungsi ginjal dalam batas normal. Kolesterol total 220 mg/dL, LDL 140 mg/dL (borderline tinggi).',
    'Darah lengkap: Hb 10.5 g/dL (anemia ringan). BNP 450 pg/mL (meningkat). Kreatinin 1.2 mg/dL. EKG: LVH, tidak ada iskemia akut.',
    'Darah lengkap dalam batas normal. Elektrolit: Na 135 mEq/L, K 3.8 mEq/L, Cl 100 mEq/L. Feses rutin: leukosit (+), eritrosit (-), parasit (-).'
  ];
  return labResults[index % labResults.length];
}

function getDetailedRadiologyResults(index) {
  const radiologyResults = [
    'Foto thorax PA: Corakan bronkovaskular meningkat di kedua lapang paru, tidak tampak infiltrat atau konsolidasi. Jantung dalam batas normal.',
    'USG abdomen: Hepar dalam batas normal, tidak ada batu empedu. Pankreas sulit dievaluasi karena gas usus. Ginjal bilateral normal.',
    'Tidak ada pemeriksaan radiologi saat ini.',
    'Foto thorax PA: Kardiomegali dengan CTR 60%. Kongesti paru bilateral. Ekokardiografi: EF 40%, hipokinetik global, dimensi LV meningkat.',
    'Tidak ada pemeriksaan radiologi diperlukan.'
  ];
  return radiologyResults[index % radiologyResults.length];
}

function getDetailedDifferentialDx(index) {
  const differentialDx = [
    'Diagnosis banding: 1) Bronkitis akut, 2) Pneumonia komunitas, 3) Infeksi saluran napas atas viral',
    'Diagnosis banding: 1) Gastritis akut, 2) Tukak peptik, 3) Pankreatitis akut, 4) Kolesistitis akut',
    'Diagnosis banding: 1) Hipertensi esensial terkontrol, 2) Vertigo perifer (BPPV), 3) Vertigo sentral',
    'Diagnosis banding: 1) Gagal jantung kongestif NYHA III, 2) Kardiomiopati dilatasi, 3) Penyakit jantung hipertensi',
    'Diagnosis banding: 1) Gastroenteritis akut (infeksi bakteri), 2) Intoksikasi makanan, 3) Diare viral'
  ];
  return differentialDx[index % differentialDx.length];
}

function getDetailedTreatmentPlan(index) {
  const treatmentPlan = [
    'Terapi: Antibiotik (Amoxicillin 500mg 3x1), simptomatik (Paracetamol untuk demam), ekspektoran (Bromhexine). Non-farmakologi: istirahat, hidrasi adekuat, hindari rokok.',
    'Terapi: PPI (Omeprazole 20mg 2x1), prokinetik (Domperidone 10mg 3x1), antasida bila perlu. Diet: hindari makanan pedas, asam, berlemak. Kontrol dalam 1 minggu.',
    'Terapi: Lanjutkan antihipertensi (Amlodipine 10mg 1x1). Untuk vertigo: Betahistine 6mg 3x1. Maneuver Epley bila BPPV. Kontrol TD rutin.',
    'Terapi: ACE inhibitor (Captopril 25mg 3x1), diuretik (Furosemide 40mg 1x1), beta blocker (Bisoprolol 2.5mg 1x1). Diet rendah garam, batasi cairan. Kontrol 1 minggu.',
    'Terapi: Rehidrasi oral (ORS), probiotik, zinc 20mg 1x1. Antibiotik: Ciprofloxacin 500mg 2x1 jika perlu. Diet: BRAT, hindari susu. Kontrol jika memburuk.'
  ];
  return treatmentPlan[index % treatmentPlan.length];
}

function getDetailedPatientEducation(index) {
  const patientEducation = [
    'Edukasi: Pentingnya menghabiskan antibiotik sesuai dosis. Istirahat cukup, perbanyak cairan hangat. Hindari rokok dan polusi. Kontrol jika gejala memburuk atau demam tinggi >3 hari.',
    'Edukasi: Hindari makanan/minuman yang memicu (pedas, asam, kopi, alkohol). Makan dalam porsi kecil tapi sering. Hindari stress. Kontrol jika nyeri tidak membaik atau muntah darah.',
    'Edukasi: Pentingnya minum obat hipertensi rutin. Hindari gerakan kepala mendadak. Latihan pelan-pelan untuk keseimbangan. Diet rendah garam <5g/hari. Olahraga teratur ringan.',
    'Edukasi: Diet rendah garam <2g/hari, batasi cairan 1.5L/hari. Timbang berat badan harian. Olahraga ringan sesuai toleransi. Hindari kelelahan berlebihan. Kontrol rutin penting.',
    'Edukasi: Hidrasi adekuat dengan ORS atau air matang. Kebersihan tangan penting. Hindari makanan mentah/kurang matang. Kontrol jika diare >3 hari, demam tinggi, atau tanda dehidrasi.'
  ];
  return patientEducation[index % patientEducation.length];
}

function getDetailedFollowUpPlan(index) {
  const followUpPlan = [
    'Kontrol dalam 3-5 hari jika gejala tidak membaik. Kontrol segera jika demam >38.5°C, sesak napas, atau batuk darah.',
    'Kontrol dalam 1 minggu atau segera jika nyeri hebat, muntah berdarah, atau BAB hitam.',
    'Kontrol rutin dalam 1 bulan untuk evaluasi tekanan darah. Kontrol segera jika vertigo berat atau gejala neurologis baru.',
    'Kontrol dalam 1 minggu untuk evaluasi terapi dan fungsi jantung. Kontrol segera jika sesak memberat atau edema bertambah.',
    'Kontrol dalam 3 hari jika diare belum membaik. Kontrol segera jika tanda dehidrasi berat atau demam tinggi persisten.'
  ];
  return followUpPlan[index % followUpPlan.length];
}

function getDetailedPrognosis(index) {
  const prognosis = [
    'Prognosis: Baik dengan terapi adekuat. Resolusi gejala diharapkan dalam 5-7 hari.',
    'Prognosis: Baik jika menghindari faktor pencetus dan terapi teratur. Risiko komplikasi rendah.',
    'Prognosis: Baik untuk hipertensi terkontrol. Vertigo umumnya akan membaik dengan terapi.',
    'Prognosis: Sedang, tergantung respons terapi dan kepatuhan pasien. Perlu follow up ketat.',
    'Prognosis: Baik, umumnya sembuh dalam 3-5 hari dengan terapi konservatif.'
  ];
  return prognosis[index % prognosis.length];
}

function getDetailedClinicalImpression(index) {
  const clinicalImpression = [
    'Infeksi saluran napas atas dengan komponen bakterial, kemungkinan bronkitis akut.',
    'Gastritis akut ec makanan iritasi dengan komponen fungsional.',
    'Hipertensi esensial terkontrol dengan vertigo perifer (suspek BPPV).',
    'Gagal jantung kongestif NYHA III ec hipertensi lama (heart failure with reduced EF).',
    'Gastroenteritis akut kemungkinan ec kontaminasi makanan (food poisoning).'
  ];
  return clinicalImpression[index % clinicalImpression.length];
}

// ✅ HELPER FUNCTIONS: Enhance lab result data
function enhanceLabTestResults(existingResults, index) {
  const defaultResults = [
    {
      // Darah Lengkap
      hemoglobin: { value: '12.5', unit: 'g/dL', status: 'normal' },
      hematokrit: { value: '37.5', unit: '%', status: 'normal' },
      leukosit: { value: '12000', unit: '/μL', status: 'high' },
      eritrosit: { value: '4.2', unit: 'juta/μL', status: 'normal' },
      trombosit: { value: '350000', unit: '/μL', status: 'normal' },
      mch: { value: '29.5', unit: 'pg', status: 'normal' },
      mchc: { value: '33.2', unit: 'g/dL', status: 'normal' },
      mcv: { value: '88.5', unit: 'fL', status: 'normal' },
      neutrofil: { value: '75', unit: '%', status: 'high' },
      limfosit: { value: '20', unit: '%', status: 'normal' },
      monosit: { value: '4', unit: '%', status: 'normal' },
      eosinofil: { value: '1', unit: '%', status: 'normal' },
      led: { value: '15', unit: 'mm/jam', status: 'normal' }
    },
    {
      // Fungsi Hati
      sgot: { value: '45', unit: 'U/L', status: 'high' },
      sgpt: { value: '52', unit: 'U/L', status: 'high' },
      bilirubin_total: { value: '1.1', unit: 'mg/dL', status: 'normal' },
      bilirubin_direct: { value: '0.3', unit: 'mg/dL', status: 'normal' },
      alkaline_phosphatase: { value: '95', unit: 'U/L', status: 'normal' },
      albumin: { value: '4.2', unit: 'g/dL', status: 'normal' },
      total_protein: { value: '7.5', unit: 'g/dL', status: 'normal' }
    },
    {
      // Gula Darah & Lipid
      gula_darah_puasa: { value: '110', unit: 'mg/dL', status: 'high' },
      gula_darah_2_jam_pp: { value: '165', unit: 'mg/dL', status: 'high' },
      hba1c: { value: '6.8', unit: '%', status: 'high' },
      kolesterol_total: { value: '220', unit: 'mg/dL', status: 'high' },
      hdl: { value: '35', unit: 'mg/dL', status: 'low' },
      ldl: { value: '140', unit: 'mg/dL', status: 'high' },
      trigliserida: { value: '180', unit: 'mg/dL', status: 'high' }
    },
    {
      // Fungsi Ginjal
      ureum: { value: '35', unit: 'mg/dL', status: 'normal' },
      kreatinin: { value: '1.2', unit: 'mg/dL', status: 'high' },
      asam_urat: { value: '7.5', unit: 'mg/dL', status: 'high' },
      bun: { value: '18', unit: 'mg/dL', status: 'normal' },
      egfr: { value: '65', unit: 'mL/min/1.73m²', status: 'low' }
    },
    {
      // Urinalisis
      warna: { value: 'Kuning', unit: '', status: 'normal' },
      kejernihan: { value: 'Jernih', unit: '', status: 'normal' },
      berat_jenis: { value: '1.020', unit: '', status: 'normal' },
      ph: { value: '6.0', unit: '', status: 'normal' },
      protein: { value: 'Negatif', unit: '', status: 'normal' },
      glukosa: { value: 'Negatif', unit: '', status: 'normal' },
      keton: { value: 'Negatif', unit: '', status: 'normal' },
      darah: { value: 'Negatif', unit: '', status: 'normal' },
      leukosit_urin: { value: '2-4', unit: '/lpb', status: 'normal' },
      eritrosit_urin: { value: '0-1', unit: '/lpb', status: 'normal' },
      silinder: { value: 'Tidak ditemukan', unit: '', status: 'normal' },
      kristal: { value: 'Tidak ditemukan', unit: '', status: 'normal' },
      bakteri: { value: 'Sedikit', unit: '', status: 'normal' }
    }
  ];

  if (existingResults && typeof existingResults === 'object') {
    return existingResults;
  }

  return defaultResults[index % defaultResults.length];
}

function enhanceNormalRanges(existingNormalRange, index) {
  const defaultNormalRanges = [
    {
      // Normal ranges untuk Darah Lengkap
      hemoglobin: '12.0-15.5 g/dL (wanita), 13.5-17.5 g/dL (pria)',
      hematokrit: '36-46% (wanita), 41-50% (pria)',
      leukosit: '4.000-10.000/μL',
      eritrosit: '3.8-5.2 juta/μL (wanita), 4.4-5.9 juta/μL (pria)',
      trombosit: '150.000-400.000/μL',
      mch: '27-31 pg',
      mchc: '32-36 g/dL',
      mcv: '82-98 fL',
      neutrofil: '50-70%',
      limfosit: '25-40%',
      monosit: '2-8%',
      eosinofil: '1-4%',
      led: '<20 mm/jam (wanita), <15 mm/jam (pria)'
    },
    {
      // Normal ranges untuk Fungsi Hati
      sgot: '<37 U/L',
      sgpt: '<42 U/L',
      bilirubin_total: '0.3-1.2 mg/dL',
      bilirubin_direct: '0.1-0.3 mg/dL',
      alkaline_phosphatase: '44-147 U/L',
      albumin: '3.4-5.4 g/dL',
      total_protein: '6.3-8.2 g/dL'
    }
  ];

  if (existingNormalRange && typeof existingNormalRange === 'object') {
    return existingNormalRange;
  }

  return defaultNormalRanges[index % defaultNormalRanges.length];
}

function getDetailedTestDescription(testType, index) {
  const descriptions = [
    'Pemeriksaan darah lengkap untuk mengevaluasi komponen sel darah, termasuk sel darah merah, sel darah putih, dan trombosit. Berguna untuk mendeteksi anemia, infeksi, dan gangguan pembekuan darah.',
    'Pemeriksaan fungsi hati untuk menilai kesehatan dan fungsi hati melalui enzim-enzim hati dan protein yang diproduksi hati.',
    'Pemeriksaan profil lipid dan gula darah untuk menilai risiko penyakit kardiovaskular dan diabetes mellitus.',
    'Pemeriksaan fungsi ginjal untuk menilai kemampuan ginjal dalam menyaring dan membuang limbah dari tubuh.',
    'Pemeriksaan urin lengkap untuk menilai fungsi ginjal dan mendeteksi infeksi saluran kemih atau penyakit sistemik lainnya.'
  ];
  return descriptions[index % descriptions.length];
}

function getDetailedClinicalSignificance(index) {
  const significance = [
    'Peningkatan leukosit dan neutrofil menunjukkan adanya infeksi bakteri aktif. LED yang normal mengindikasikan tidak ada proses inflamasi kronik yang signifikan.',
    'Peningkatan ringan enzim hati (SGOT/SGPT) dapat disebabkan oleh berbagai faktor seperti obat-obatan, infeksi viral, atau kondisi hepatitis ringan.',
    'Profil lipid dan gula darah yang abnormal menunjukkan risiko tinggi untuk penyakit kardiovaskular dan diabetes. Diperlukan modifikasi gaya hidup dan mungkin terapi farmakologis.',
    'Peningkatan kreatinin dan penurunan eGFR mengindikasikan penurunan fungsi ginjal yang perlu pemantauan dan penanganan lebih lanjut.',
    'Urinalisis dalam batas normal mengindikasikan fungsi ginjal yang baik dan tidak ada infeksi saluran kemih aktif.'
  ];
  return significance[index % significance.length];
}

function getDetailedRecommendedActions(index) {
  const actions = [
    'Lanjutkan terapi antibiotik sesuai anjuran dokter. Ulangi pemeriksaan darah lengkap setelah 1 minggu terapi untuk memantau respons pengobatan.',
    'Hindari obat-obatan hepatotoksik. Ulangi pemeriksaan fungsi hati dalam 2-4 minggu. Konsultasi gastrohepatologi jika enzim tetap tinggi.',
    'Mulai diet rendah gula dan lemak. Olahraga teratur minimal 30 menit/hari. Kontrol gula darah dan lipid dalam 3 bulan. Pertimbangkan terapi farmakologis.',
    'Konsultasi nefrologi untuk evaluasi lebih lanjut. Hindari obat nefrotoksik. Kontrol tekanan darah ketat. Ulangi fungsi ginjal dalam 1 bulan.',
    'Jaga kebersihan area genital. Perbanyak minum air putih. Ulangi urinalisis jika ada keluhan saluran kemih.'
  ];
  return actions[index % actions.length];
}

function getDetailedSpecimenType(index) {
  const specimens = [
    'Darah vena - tabung EDTA (tutup ungu)',
    'Darah vena - tabung serum (tutup merah/kuning)',
    'Darah vena - tabung serum dan EDTA',
    'Darah vena - tabung serum',
    'Urin sewaktu - wadah steril'
  ];
  return specimens[index % specimens.length];
}

function getDetailedCollectionMethod(index) {
  const methods = [
    'Pengambilan darah vena dari fossa cubiti menggunakan sistem vakum, tidak memerlukan puasa',
    'Pengambilan darah vena dengan puasa 8-12 jam sebelumnya, hindari alkohol 24 jam sebelum pemeriksaan',
    'Pengambilan darah vena dengan puasa 10-12 jam, hindari makanan dan minuman kecuali air putih',
    'Pengambilan darah vena, dapat dilakukan sewaktu tanpa persiapan khusus',
    'Pengumpulan urin porsi tengah (midstream) setelah membersihkan area genital'
  ];
  return methods[index % methods.length];
}

function getDetailedTestingLaboratory(index) {
  const labs = [
    'Laboratorium Klinik RS HospitalLink - Hematologi',
    'Laboratorium Klinik RS HospitalLink - Kimia Klinik',
    'Laboratorium Klinik RS HospitalLink - Kimia Klinik',
    'Laboratorium Klinik RS HospitalLink - Kimia Klinik',
    'Laboratorium Klinik RS HospitalLink - Urinalisis'
  ];
  return labs[index % labs.length];
}

function getDetailedReferenceValues(index) {
  const references = [
    'Nilai rujukan berdasarkan standar WHO dan disesuaikan dengan populasi Indonesia dewasa',
    'Nilai rujukan berdasarkan International Federation of Clinical Chemistry (IFCC)',
    'Nilai rujukan berdasarkan National Cholesterol Education Program (NCEP) dan American Diabetes Association (ADA)',
    'Nilai rujukan berdasarkan Kidney Disease: Improving Global Outcomes (KDIGO)',
    'Nilai rujukan berdasarkan Clinical and Laboratory Standards Institute (CLSI)'
  ];
  return references[index % references.length];
}

function getDetailedCriticalValues(index) {
  const criticalValues = [
    'Nilai kritis: Hb <7 g/dL, Leukosit >30.000/μL, Trombosit <50.000/μL - segera konsultasi dokter',
    'Nilai kritis: SGOT/SGPT >200 U/L, Bilirubin total >3 mg/dL - konsultasi gastrohepatologi segera',
    'Nilai kritis: Gula darah >300 mg/dL, HbA1c >10% - konsultasi endokrinologi segera',
    'Nilai kritis: Kreatinin >3 mg/dL, eGFR <30 - konsultasi nefrologi segera',
    'Nilai kritis: Proteinuria massif, hematuria gross - evaluasi urologi/nefrologi'
  ];
  return criticalValues[index % criticalValues.length];
}

function getDetailedInterpretationNotes(index) {
  const interpretations = [
    'Interpretasi hasil harus dikaitkan dengan kondisi klinis pasien. Variasi biologis individual dapat mempengaruhi hasil. Konsultasi dokter untuk interpretasi komprehensif.',
    'Hasil dapat dipengaruhi oleh obat-obatan, diet, dan kondisi klinis. Perlu korelasi dengan gejala dan pemeriksaan fisik.',
    'Hasil dipengaruhi oleh usia, jenis kelamin, BMI, dan faktor genetik. Perlu pendekatan holistik dalam penanganan.',
    'Fungsi ginjal dapat bervariasi dengan usia dan massa otot. Perhitungan eGFR menggunakan formula CKD-EPI.',
    'Hasil urinalisis dapat dipengaruhi oleh hidrasi, aktivitas fisik, dan kontaminasi specimen.'
  ];
  return interpretations[index % interpretations.length];
}

function getDetailedFollowUpTests(index) {
  const followUpTests = [
    'Follow up: Kultur darah jika demam persisten, pemeriksaan resistensi antibiotik jika perlu',
    'Follow up: USG abdomen, marker hepatitis B/C jika diperlukan, pemeriksaan autoantibodi',
    'Follow up: Tes toleransi glukosa oral (TTGO), profil lipid lengkap, HbA1c serial',
    'Follow up: Albumin urin, clearance creatinine 24 jam, USG ginjal, biopsi ginjal jika perlu',
    'Follow up: Kultur urin jika ada gejala ISK, pemeriksaan mikroskopis urin serial'
  ];
  return followUpTests[index % followUpTests.length];
}

function getDetailedTechnicalNotes(index) {
  const technicalNotes = [
    'Pemeriksaan dilakukan dengan alat hematology analyzer Sysmex XN-1000. QC internal dan eksternal sesuai standar.',
    'Pemeriksaan menggunakan chemistry analyzer Roche Cobas 6000. Metode enzymatic/kinetic dengan kalibrasi rutin.',
    'Pemeriksaan glukosa metode glucose oxidase, lipid metode enzymatic colorimetric. Kalibrasi sesuai standar NIST.',
    'Pemeriksaan kreatinin metode Jaffe kinetic, kompensasi non-specific interference. Kalibrasi IDMS-traceable.',
    'Pemeriksaan mikroskopis dilakukan manual oleh teknisi berpengalaman. Sedimen sentrifugasi 400G selama 5 menit.'
  ];
  return technicalNotes[index % technicalNotes.length];
}

module.exports = {
  getCombinedHistory,
  getMedicalRecords,
  getLabResults,
  getConsultationHistory,
  getQueueHistory,
  getPrescriptionHistory
};