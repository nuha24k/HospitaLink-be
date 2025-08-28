const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const hospitalConfigSeeder = async () => {
  console.log('  📍 Creating hospital configuration...');

  await prisma.hospitalConfig.upsert({
    where: { id: 'hospital' },
    update: {
      // Update operational settings only
      queuePrefix: 'RS',
      maxQueuePerDay: 150,
      operatingHoursStart: '07:00',
      operatingHoursEnd: '21:00',
      queueCallInterval: 3,
    },
    create: {
      id: 'hospital',
      hospitalName: 'RS Mitra Keluarga Bekasi',
      hospitalAddress: 'Jl. Ahmad Yani No. 1, Bekasi Timur, Kota Bekasi, Jawa Barat 17112',
      hospitalPhone: '021-88956000',
      hospitalEmail: 'info@mitrakeluarga-bekasi.co.id',
      hospitalWebsite: 'https://mitrakeluarga-bekasi.co.id',
      emergencyNumber: '021-88956119',
      
      // Operational Settings
      queuePrefix: 'RS',
      maxQueuePerDay: 150,
      operatingHoursStart: '07:00',
      operatingHoursEnd: '21:00',
      queueCallInterval: 3,
      
      // System Settings
      licenseNumber: 'RS.01.01.0001.00001',
      accreditationLevel: 'Paripurna',
      hospitalType: 'Rumah Sakit Umum',
      bedCapacity: 200,
      isInitialized: true,
    }
  });

  console.log('  ✅ Hospital configuration created');
};

module.exports = hospitalConfigSeeder;