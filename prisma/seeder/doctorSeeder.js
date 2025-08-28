const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const doctorSeeder = async () => {
  console.log('  👨‍⚕️ Creating doctors...');

  const doctors = [
    {
      licenseNumber: 'STR.001.2024.001',
      name: 'Dr. Sarah Wijaya, Sp.PD',
      specialty: 'Spesialis Penyakit Dalam',
      phone: '08123456788',
      email: 'dr.sarah@hospitalink.com',
      consultationFee: 250000,
      isAvailable: true,
      bio: 'Dokter spesialis penyakit dalam dengan pengalaman 15 tahun. Alumni FK UI dan memiliki keahlian khusus dalam penanganan diabetes dan hipertensi.',
      schedule: {
        monday: { start: '08:00', end: '16:00' },
        tuesday: { start: '08:00', end: '16:00' },
        wednesday: { start: '08:00', end: '16:00' },
        thursday: { start: '08:00', end: '16:00' },
        friday: { start: '08:00', end: '12:00' },
        saturday: { start: '08:00', end: '12:00' },
        sunday: null
      }
    },
    {
      licenseNumber: 'STR.001.2024.002',
      name: 'Dr. Ahmad Rahman, Sp.A',
      specialty: 'Spesialis Anak',
      phone: '08123456787',
      email: 'dr.ahmad@hospitalink.com',
      consultationFee: 275000,
      isAvailable: true,
      bio: 'Dokter spesialis anak dengan pengalaman 12 tahun. Menangani berbagai kasus kesehatan anak dari bayi hingga remaja.',
      schedule: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '13:00' },
        saturday: { start: '09:00', end: '13:00' },
        sunday: null
      }
    },
    {
      licenseNumber: 'STR.001.2024.003',
      name: 'Dr. Maya Sari, Sp.OG',
      specialty: 'Spesialis Obstetri dan Ginekologi',
      phone: '08123456786',
      email: 'dr.maya@hospitalink.com',
      consultationFee: 300000,
      isAvailable: true,
      bio: 'Dokter spesialis kandungan dan kebidanan dengan pengalaman 18 tahun. Ahli dalam penanganan kehamilan berisiko tinggi.',
      schedule: {
        monday: { start: '08:00', end: '15:00' },
        tuesday: { start: '08:00', end: '15:00' },
        wednesday: { start: '08:00', end: '15:00' },
        thursday: { start: '08:00', end: '15:00' },
        friday: { start: '08:00', end: '12:00' },
        saturday: null,
        sunday: null
      }
    },
    {
      licenseNumber: 'STR.001.2024.004',
      name: 'Dr. Budi Setiawan, Sp.JP',
      specialty: 'Spesialis Jantung dan Pembuluh Darah',
      phone: '08123456785',
      email: 'dr.budi@hospitalink.com',
      consultationFee: 350000,
      isAvailable: true,
      bio: 'Dokter spesialis jantung dengan pengalaman 20 tahun. Menangani berbagai penyakit kardiovaskular dan tindakan invasif.',
      schedule: {
        monday: { start: '07:00', end: '14:00' },
        tuesday: { start: '07:00', end: '14:00' },
        wednesday: { start: '07:00', end: '14:00' },
        thursday: { start: '07:00', end: '14:00' },
        friday: { start: '07:00', end: '11:00' },
        saturday: null,
        sunday: null
      }
    },
    {
      licenseNumber: 'STR.001.2024.005',
      name: 'Dr. Linda Kartika, Sp.M',
      specialty: 'Spesialis Mata',
      phone: '08123456784',
      email: 'dr.linda@hospitalink.com',
      consultationFee: 225000,
      isAvailable: true,
      bio: 'Dokter spesialis mata dengan pengalaman 10 tahun. Ahli dalam penanganan katarak, glaukoma, dan bedah refraktif.',
      schedule: {
        monday: { start: '10:00', end: '18:00' },
        tuesday: { start: '10:00', end: '18:00' },
        wednesday: { start: '10:00', end: '18:00' },
        thursday: { start: '10:00', end: '18:00' },
        friday: { start: '10:00', end: '14:00' },
        saturday: { start: '10:00', end: '14:00' },
        sunday: null
      }
    }
  ];

  for (const doctor of doctors) {
    await prisma.doctor.upsert({
      where: { licenseNumber: doctor.licenseNumber },
      update: {},
      create: doctor,
    });
  }

  console.log(`  ✅ ${doctors.length} doctors created`);
};

module.exports = doctorSeeder;