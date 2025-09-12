const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const labResultSeeder = async () => {
  console.log('  🔬 Creating lab results...');

  // Get users and some medical records
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  const medicalRecords = await prisma.medicalRecord.findMany({
    take: 5
  });

  if (users.length === 0) {
    console.log('  ⚠️ No users found to create lab results');
    return;
  }

  console.log(`  📊 Found ${users.length} users and ${medicalRecords.length} medical records`);

  const labResults = [
    // Blood test results
    {
      userId: users[0].id,
      medicalRecordId: medicalRecords.length > 0 ? medicalRecords[0].id : null, // FIXED: Safe access
      testName: 'Darah Lengkap',
      testType: 'BLOOD',
      category: 'HEMATOLOGY',
      results: {
        hemoglobin: { value: 12.5, unit: 'g/dL' },
        leukosit: { value: 8500, unit: '/μL' },
        eritrosit: { value: 4.2, unit: 'juta/μL' },
        trombosit: { value: 250000, unit: '/μL' },
        hematokrit: { value: 38, unit: '%' }
      },
      normalRange: {
        hemoglobin: { min: 12, max: 16, unit: 'g/dL' },
        leukosit: { min: 4000, max: 10000, unit: '/μL' },
        eritrosit: { min: 3.8, max: 5.2, unit: 'juta/μL' },
        trombosit: { min: 150000, max: 450000, unit: '/μL' },
        hematokrit: { min: 36, max: 46, unit: '%' }
      },
      isNormal: true,
      isCritical: false,
      doctorNotes: 'Hasil dalam batas normal',
      testDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      resultDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isNew: false
    },

    {
      userId: users[1] ? users[1].id : users[0].id, // FIXED: Safe access
      medicalRecordId: medicalRecords.length > 1 ? medicalRecords[1].id : null, // FIXED
      testName: 'Gula Darah Sewaktu',
      testType: 'BLOOD',
      category: 'CHEMISTRY',
      results: {
        glucoseRandom: { value: 180, unit: 'mg/dL' }
      },
      normalRange: {
        glucoseRandom: { min: 70, max: 140, unit: 'mg/dL' }
      },
      isNormal: false,
      isCritical: false,
      doctorNotes: 'Gula darah tinggi, perlu kontrol diet dan follow up',
      testDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      resultDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isNew: true
    },

    {
      userId: users[2] ? users[2].id : users[0].id, // FIXED
      medicalRecordId: medicalRecords.length > 2 ? medicalRecords[2].id : null, // FIXED
      testName: 'Fungsi Hati',
      testType: 'BLOOD',
      category: 'CHEMISTRY',
      results: {
        SGOT: { value: 25, unit: 'U/L' },
        SGPT: { value: 30, unit: 'U/L' },
        bilirubin: { value: 0.8, unit: 'mg/dL' }
      },
      normalRange: {
        SGOT: { min: 0, max: 40, unit: 'U/L' },
        SGPT: { min: 0, max: 40, unit: 'U/L' },
        bilirubin: { min: 0.2, max: 1.2, unit: 'mg/dL' }
      },
      isNormal: true,
      isCritical: false,
      doctorNotes: 'Fungsi hati normal',
      testDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      resultDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      isNew: false
    },

    // Urine test
    {
      userId: users[3] ? users[3].id : users[0].id, // FIXED
      medicalRecordId: medicalRecords.length > 3 ? medicalRecords[3].id : null, // FIXED
      testName: 'Urine Lengkap',
      testType: 'URINE',
      category: 'URINALYSIS',
      results: {
        protein: { value: 'Negatif', unit: '' },
        glucose: { value: 'Negatif', unit: '' },
        leukosit: { value: '2-4', unit: '/lpb' },
        eritrosit: { value: '0-1', unit: '/lpb' },
        warna: { value: 'Kuning jernih', unit: '' }
      },
      normalRange: {
        protein: { value: 'Negatif', unit: '' },
        glucose: { value: 'Negatif', unit: '' },
        leukosit: { max: 5, unit: '/lpb' },
        eritrosit: { max: 2, unit: '/lpb' }
      },
      isNormal: true,
      isCritical: false,
      doctorNotes: 'Hasil urine normal',
      testDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      resultDate: new Date(),
      isNew: true
    },

    // X-Ray result
    {
      userId: users[4] ? users[4].id : users[0].id, // FIXED
      medicalRecordId: medicalRecords.length > 4 ? medicalRecords[4].id : null, // FIXED
      testName: 'Rontgen Thorax',
      testType: 'XRAY',
      category: 'RADIOLOGY',
      results: {
        impression: 'Cor dan pulmo dalam batas normal',
        findings: [
          'Tidak tampak infiltrat pada kedua paru',
          'Jantung kesan normal',
          'Diafragma normal',
          'Tulang-tulang intak'
        ]
      },
      isNormal: true,
      isCritical: false,
      doctorNotes: 'Rontgen thorax normal, tidak ada kelainan',
      testDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      resultDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      isNew: false,
      reportUrl: '/reports/xray_thorax_001.pdf'
    },

    // Critical lab result
    {
      userId: users[0].id,
      medicalRecordId: null, // No medical record needed for emergency tests
      testName: 'Troponin T',
      testType: 'BLOOD',
      category: 'CARDIAC_MARKERS',
      results: {
        troponinT: { value: 0.8, unit: 'ng/mL' }
      },
      normalRange: {
        troponinT: { min: 0, max: 0.1, unit: 'ng/mL' }
      },
      isNormal: false,
      isCritical: true,
      doctorNotes: 'CRITICAL: Troponin T sangat tinggi, indikasi infark miokard. Segera konsultasi ke dokter spesialis jantung!',
      testDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      resultDate: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      isNew: true
    },

    // Recent COVID test
    {
      userId: users[1] ? users[1].id : users[0].id, // FIXED
      medicalRecordId: null,
      testName: 'RT-PCR COVID-19',
      testType: 'PCR',
      category: 'MOLECULAR',
      results: {
        result: 'NEGATIF',
        ctValue: { value: 'Not detected', unit: '' }
      },
      isNormal: true,
      isCritical: false,
      doctorNotes: 'Hasil negatif COVID-19',
      testDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      resultDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      isNew: true
    }
  ];

  let createdCount = 0;
  for (const labResult of labResults) {
    try {
      await prisma.labResult.create({
        data: labResult
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create lab result ${labResult.testName}: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} lab results created`);
};

module.exports = labResultSeeder;