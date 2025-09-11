const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const doctorSeeder = async () => {
  console.log('  👨‍⚕️ Creating doctors...');

  // Get existing doctor users
  const drSarah = await prisma.user.findUnique({ where: { email: 'dr.sarah@hospitalink.com' } });
  const drAhmad = await prisma.user.findUnique({ where: { email: 'dr.ahmad@hospitalink.com' } });

  if (!drSarah || !drAhmad) {
    console.log('  ⚠️ Doctor users not found. Please run user seeder first.');
    return;
  }

  const doctors = [
    {
      userId: drSarah.id,
      licenseNumber: 'STR.001.2024.001',
      name: 'Dr. Sarah Wijaya, Sp.PD',
      specialty: 'Spesialis Penyakit Dalam',
      phone: '08123456788',
      email: 'dr.sarah@hospitalink.com',
      consultationFee: 250000,
      isAvailable: true,
      isOnDuty: false,
      bio: 'Dokter spesialis penyakit dalam dengan pengalaman 15 tahun.',
      schedule: {
        monday: { start: '08:00', end: '16:00', isActive: true },
        tuesday: { start: '08:00', end: '16:00', isActive: true },
        wednesday: { start: '08:00', end: '16:00', isActive: true },
        thursday: { start: '08:00', end: '16:00', isActive: true },
        friday: { start: '08:00', end: '12:00', isActive: true },
        saturday: { start: '08:00', end: '12:00', isActive: true },
        sunday: { start: '08:00', end: '12:00', isActive: false }
      }
    },
    {
      userId: drAhmad.id,
      licenseNumber: 'STR.001.2024.002',
      name: 'Dr. Ahmad Rahman',
      specialty: 'Dokter Umum',
      phone: '08123456787',
      email: 'dr.ahmad@hospitalink.com',
      consultationFee: 150000,
      isAvailable: true,
      isOnDuty: false,
      bio: 'Dokter umum dengan pengalaman 12 tahun.',
      schedule: {
        monday: { start: '08:00', end: '17:00', isActive: true },
        tuesday: { start: '08:00', end: '17:00', isActive: true },
        wednesday: { start: '08:00', end: '17:00', isActive: true },
        thursday: { start: '08:00', end: '17:00', isActive: true },
        friday: { start: '08:00', end: '13:00', isActive: true },
        saturday: { start: '08:00', end: '13:00', isActive: true },
        sunday: { start: '08:00', end: '13:00', isActive: false }
      }
    }
  ];

  let createdCount = 0;
  for (const doctor of doctors) {
    try {
      await prisma.doctor.upsert({
        where: { licenseNumber: doctor.licenseNumber },
        update: {
          isAvailable: doctor.isAvailable,
          isOnDuty: doctor.isOnDuty,
          schedule: doctor.schedule,
        },
        create: doctor,
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create doctor ${doctor.name}: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} doctors created`);
};

module.exports = doctorSeeder;