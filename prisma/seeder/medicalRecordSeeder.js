const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const medicalRecordSeeder = async () => {
  console.log('  📋 Creating medical records...');

  // Get completed consultations, users, and doctors
  const completedConsultations = await prisma.consultation.findMany({
    where: { isCompleted: true },
    include: { user: true, doctor: true }
  });

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  const doctors = await prisma.doctor.findMany({
    take: 5 // Increase this to avoid index issues
  });

  if (users.length === 0 || doctors.length === 0) {
    console.log('  ⚠️ Not enough users or doctors to create medical records');
    return;
  }

  console.log(`  📊 Found ${users.length} users, ${doctors.length} doctors, ${completedConsultations.length} completed consultations`);

  const medicalRecords = [
    // Records with consultations - only if consultations exist
    ...completedConsultations.slice(0, Math.min(3, completedConsultations.length)).map((consultation, index) => ({
      userId: consultation.userId,
      doctorId: consultation.doctorId || doctors[0].id,
      consultationId: consultation.id,
      visitDate: consultation.createdAt,
      queueNumber: `RS00${index + 1}`,
      diagnosis: consultation.type === 'AI' ? 
        'Berdasarkan AI Analysis: ' + (consultation.aiAnalysis?.possibleConditions?.[0]?.condition || 'Flu Ringan') :
        getDiagnosisBySymptoms(consultation.symptoms),
      treatment: getTreatmentByType(consultation.type),
      symptoms: consultation.symptoms,
      vitalSigns: {
        bloodPressure: '120/80',
        temperature: '36.8',
        pulse: '78',
        weight: '65',
        height: '165'
      },
      medications: getMedicationsByDiagnosis(consultation.type),
      totalCost: consultation.type === 'AI' ? 0 : 150000,
      paymentStatus: consultation.type === 'AI' ? 'PAID' : 'PAID',
      paymentMethod: consultation.type === 'AI' ? 'CASH' : 'BPJS',
      notes: `Konsultasi ${consultation.type} - ${consultation.isCompleted ? 'Selesai' : 'Ongoing'}`
    })),

    // Additional standalone medical records
    {
      userId: users[0].id,
      doctorId: doctors[0].id,
      visitDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
      queueNumber: 'RS010',
      diagnosis: 'Diabetes Mellitus Tipe 2 terkontrol',
      treatment: 'Terapi insulin, diet rendah gula, olahraga teratur',
      symptoms: ['Sering haus', 'Sering buang air kecil', 'Lemas'],
      vitalSigns: {
        bloodPressure: '130/85',
        temperature: '36.5',
        pulse: '82',
        weight: '70',
        height: '165',
        bloodSugar: '150'
      },
      medications: [
        { name: 'Metformin', dosage: '500mg', frequency: '2x1', duration: '30 hari' },
        { name: 'Insulin', dosage: '10 unit', frequency: '1x1', duration: '30 hari' }
      ],
      followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      totalCost: 250000,
      paymentStatus: 'PAID',
      paymentMethod: 'BPJS',
      notes: 'Kontrol rutin bulanan, kondisi stabil'
    },

    {
      userId: users[1] ? users[1].id : users[0].id,
      doctorId: doctors[1] ? doctors[1].id : doctors[0].id,
      visitDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      queueNumber: 'RS011',
      diagnosis: 'Gastroenteritis Akut',
      treatment: 'Rehidrasi oral, diet BRAT, istirahat',
      symptoms: ['Diare', 'Mual', 'Muntah', 'Sakit perut'],
      vitalSigns: {
        bloodPressure: '110/70',
        temperature: '37.2',
        pulse: '88',
        weight: '58',
        height: '160'
      },
      medications: [
        { name: 'ORS', dosage: '1 sachet', frequency: '3x1', duration: '3 hari' },
        { name: 'Loperamide', dosage: '2mg', frequency: '2x1', duration: '3 hari' },
        { name: 'Domperidone', dosage: '10mg', frequency: '3x1', duration: '3 hari' }
      ],
      followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalCost: 175000,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      notes: 'Kondisi membaik, lanjutkan pengobatan'
    },

    {
      userId: users[2] ? users[2].id : users[0].id,
      doctorId: doctors[0].id, // Use safe index
      visitDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      queueNumber: 'RS012',
      diagnosis: 'Miopia Ringan',
      treatment: 'Kacamata minus, istirahat mata teratur',
      symptoms: ['Penglihatan kabur jarak jauh', 'Mata lelah', 'Sakit kepala'],
      vitalSigns: {
        bloodPressure: '115/75',
        temperature: '36.6',
        pulse: '75',
        weight: '62',
        height: '158'
      },
      medications: [
        { name: 'Vitamin A', dosage: '1 tablet', frequency: '1x1', duration: '30 hari' },
        { name: 'Lubricating Eye Drops', dosage: '1 tetes', frequency: '3x1', duration: '14 hari' }
      ],
      followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      totalCost: 300000,
      paymentStatus: 'PAID',
      paymentMethod: 'INSURANCE',
      notes: 'Resep kacamata: OD -1.25, OS -1.50'
    },

    {
      userId: users[3] ? users[3].id : users[0].id,
      doctorId: doctors[0].id, // Use safe index
      visitDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      queueNumber: 'RS013',
      diagnosis: 'Hipertensi Stadium 1',
      treatment: 'Antihipertensi, diet rendah garam, olahraga',
      symptoms: ['Sakit kepala', 'Pusing', 'Mudah lelah'],
      vitalSigns: {
        bloodPressure: '145/95',
        temperature: '36.7',
        pulse: '85',
        weight: '75',
        height: '170'
      },
      medications: [
        { name: 'Amlodipine', dosage: '5mg', frequency: '1x1', duration: '30 hari' },
        { name: 'Captopril', dosage: '25mg', frequency: '2x1', duration: '30 hari' }
      ],
      followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      totalCost: 200000,
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH',
      notes: 'Edukasi diet dan lifestyle, kontrol 2 minggu lagi'
    }
  ];

  let createdCount = 0;
  for (const record of medicalRecords) {
    try {
      await prisma.medicalRecord.create({
        data: record
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create medical record: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} medical records created`);
};

// Helper functions
function getDiagnosisBySymptoms(symptoms) {
  if (!symptoms || symptoms.length === 0) {
    return 'Pemeriksaan umum - kondisi stabil';
  }
  
  const symptomsText = symptoms.join(' ').toLowerCase();
  
  if (symptomsText.includes('demam')) {
    return 'Sindrom Demam - perlu evaluasi lebih lanjut';
  }
  if (symptomsText.includes('batuk')) {
    return 'Infeksi Saluran Pernapasan Atas';
  }
  if (symptomsText.includes('nyeri dada')) {
    return 'Nyeri Dada Non-Spesifik - perlu pemeriksaan jantung';
  }
  if (symptomsText.includes('sakit perut') || symptomsText.includes('diare')) {
    return 'Gangguan Pencernaan';
  }
  if (symptomsText.includes('sakit kepala') || symptomsText.includes('pusing')) {
    return 'Cephalgia - perlu evaluasi lebih lanjut';
  }
  
  return 'Pemeriksaan umum - kondisi stabil';
}

function getTreatmentByType(type) {
  switch (type) {
    case 'AI':
      return 'Sesuai rekomendasi AI, dirujuk ke dokter untuk evaluasi lebih lanjut';
    case 'GENERAL':
      return 'Terapi simptomatik, istirahat, kontrol jika memburuk';
    case 'SPECIALIST':
      return 'Terapi spesialis sesuai kondisi, follow up rutin';
    default:
      return 'Terapi supportif, monitoring kondisi';
  }
}

function getMedicationsByDiagnosis(type) {
  const medications = {
    'AI': [
      { name: 'Paracetamol', dosage: '500mg', frequency: '3x1', duration: '3 hari' }
    ],
    'GENERAL': [
      { name: 'Paracetamol', dosage: '500mg', frequency: '3x1', duration: '5 hari' },
      { name: 'CTM', dosage: '4mg', frequency: '3x1', duration: '3 hari' }
    ],
    'SPECIALIST': [
      { name: 'Sesuai resep dokter spesialis', dosage: '-', frequency: '-', duration: '-' }
    ]
  };
  
  return medications[type] || medications['GENERAL'];
}

module.exports = medicalRecordSeeder;