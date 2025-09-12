const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const prescriptionSeeder = async () => {
  console.log('  💊 Creating prescriptions...');

  // Get completed consultations and users
  const completedConsultations = await prisma.consultation.findMany({
    where: { isCompleted: true },
    include: { user: true, doctor: true },
    take: 5
  });

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  const doctors = await prisma.doctor.findMany({
    take: 3
  });

  const appointments = await prisma.appointment.findMany({
    where: { status: 'COMPLETED' },
    take: 2
  });

  if (users.length === 0 || doctors.length === 0) {
    console.log('  ⚠️ Not enough users or doctors to create prescriptions');
    return;
  }

  console.log(`  📊 Found ${users.length} users, ${doctors.length} doctors, ${completedConsultations.length} consultations`);

  const prescriptions = [];

  // Generate unique prescription codes
  const generatePrescriptionCode = (index) => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `RX${date}${String(index + 1).padStart(3, '0')}`;
  };

  // Prescriptions from completed consultations
  completedConsultations.forEach((consultation, index) => {
    if (consultation.doctorId) {
      prescriptions.push({
        userId: consultation.userId,
        doctorId: consultation.doctorId,
        consultationId: consultation.id,
        prescriptionCode: generatePrescriptionCode(index),
        medications: [
          {
            name: 'Paracetamol',
            strength: '500mg',
            form: 'Tablet',
            quantity: 10,
            frequency: '3x sehari',
            duration: '3 hari',
            instructions: 'Sesudah makan',
            price: 5000
          },
          {
            name: 'Antacid',
            strength: '200mg',
            form: 'Tablet',
            quantity: 6,
            frequency: '2x sehari',
            duration: '3 hari',
            instructions: 'Sebelum makan',
            price: 3000
          }
        ],
        instructions: 'Obat diminum teratur sesuai anjuran. Jika keluhan memburuk segera konsultasi kembali.',
        totalAmount: 80000,
        paymentStatus: index % 2 === 0 ? 'PAID' : 'PENDING',
        paymentMethod: index % 2 === 0 ? 'CASH' : 'BPJS',
        isPaid: index % 2 === 0,
        isDispensed: index % 2 === 0,
        dispensedAt: index % 2 === 0 ? new Date() : null,
        dispensedBy: index % 2 === 0 ? 'Apt. Sarah' : null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    }
  });

  // Additional standalone prescriptions
  if (users.length >= 1 && doctors.length >= 1) {
    prescriptions.push({
      userId: users[0].id,
      doctorId: doctors[0].id,
      appointmentId: appointments[0]?.id,
      prescriptionCode: generatePrescriptionCode(10),
      medications: [
        {
          name: 'Metformin',
          strength: '500mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '2x sehari',
          duration: '30 hari',
          instructions: 'Sesudah makan pagi dan malam',
          price: 45000
        },
        {
          name: 'Glibenclamide',
          strength: '5mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1x sehari',
          duration: '30 hari',
          instructions: 'Sebelum makan pagi',
          price: 25000
        }
      ],
      instructions: 'Obat diabetes harus diminum teratur. Kontrol gula darah secara berkala. Jaga pola makan.',
      totalAmount: 70000,
      pharmacyNotes: 'Pasien diabetes tipe 2, edukasi cara minum obat',
      paymentStatus: 'PAID',
      paymentMethod: 'BPJS',
      isPaid: true,
      isDispensed: true,
      dispensedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      dispensedBy: 'Apt. Rina',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  }

  if (users.length >= 2 && doctors.length >= 1) {
    prescriptions.push({
      userId: users[1].id,
      doctorId: doctors[0].id,
      prescriptionCode: generatePrescriptionCode(11),
      medications: [
        {
          name: 'Amoxicillin',
          strength: '500mg',
          form: 'Kapsul',
          quantity: 21,
          frequency: '3x sehari',
          duration: '7 hari',
          instructions: 'Sesudah makan, habiskan antibiotik',
          price: 35000
        },
        {
          name: 'Dextromethorphan',
          strength: '15mg/5ml',
          form: 'Sirup',
          quantity: 1,
          frequency: '3x sehari 1 sendok teh',
          duration: '5 hari',
          instructions: 'Untuk meredakan batuk',
          price: 15000
        }
      ],
      instructions: 'Antibiotik harus dihabiskan meski sudah merasa sembuh. Jangan putus di tengah jalan.',
      totalAmount: 50000,
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH',
      isPaid: false,
      isDispensed: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  // High-value prescription (pending payment)
  if (users.length >= 3 && doctors.length >= 2) {
    prescriptions.push({
      userId: users[2].id,
      doctorId: doctors[1].id,
      prescriptionCode: generatePrescriptionCode(12),
      medications: [
        {
          name: 'Amlodipine',
          strength: '10mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1x sehari',
          duration: '30 hari',
          instructions: 'Pagi hari setelah sarapan',
          price: 55000
        },
        {
          name: 'Captopril',
          strength: '25mg',
          form: 'Tablet',
          quantity: 60,
          frequency: '2x sehari',
          duration: '30 hari',
          instructions: 'Pagi dan malam sebelum makan',
          price: 40000
        },
        {
          name: 'Simvastatin',
          strength: '20mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1x sehari',
          duration: '30 hari',
          instructions: 'Malam hari sebelum tidur',
          price: 75000
        }
      ],
      instructions: 'Obat hipertensi dan kolesterol harus diminum teratur seumur hidup. Kontrol tekanan darah dan kolesterol secara berkala.',
      totalAmount: 170000,
      pharmacyNotes: 'Pasien hipertensi + dislipidemia, edukasi penting tentang kepatuhan minum obat',
      paymentStatus: 'PENDING',
      paymentMethod: 'INSURANCE',
      isPaid: false,
      isDispensed: false,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    });
  }

  let createdCount = 0;
  for (const prescription of prescriptions) {
    try {
      await prisma.prescription.create({
        data: prescription
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create prescription: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} prescriptions created`);
};

module.exports = prescriptionSeeder;