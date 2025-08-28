// prisma/seeder/userSeeder.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const userSeeder = async () => {
  console.log('  👤 Creating users...');

  const users = [
    // Admin Users
    {
      email: 'admin@hospitalink.com',
      password: 'admin123',
      role: 'ADMIN',
      fullName: 'Dr. Administrator',
      nik: '3201010101010001',
      phone: '08123456789',
      gender: 'MALE',
      qrCode: 'ADMIN_001',
      emailVerified: true,
      street: 'Jl. Admin No. 1',
      village: 'Kelurahan Admin',
      district: 'Kecamatan Admin',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },
    
    // Doctor Users
    {
      email: 'dr.sarah@hospitalink.com',
      password: 'doctor123',
      role: 'DOCTOR',
      fullName: 'Dr. Sarah Wijaya, Sp.PD',
      nik: '3201010101010002',
      phone: '08123456788',
      gender: 'FEMALE',
      qrCode: 'DOCTOR_001',
      emailVerified: true,
      street: 'Jl. Dokter No. 2',
      village: 'Kelurahan Medis',
      district: 'Kecamatan Sehat',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },
    
    {
      email: 'dr.ahmad@hospitalink.com',
      password: 'doctor123',
      role: 'DOCTOR',
      fullName: 'Dr. Ahmad Rahman, Sp.A',
      nik: '3201010101010003',
      phone: '08123456787',
      gender: 'MALE',
      qrCode: 'DOCTOR_002',
      emailVerified: true,
      street: 'Jl. Dokter No. 3',
      village: 'Kelurahan Medis',
      district: 'Kecamatan Sehat',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    // Regular Users/Patients
    {
      email: 'budi.santoso@email.com',
      password: 'password123',
      role: 'USER',
      fullName: 'Budi Santoso',
      nik: '3201123456789001',
      phone: '08123456701',
      gender: 'MALE',
      dateOfBirth: new Date('1985-05-15'),
      qrCode: 'USER_001',
      street: 'Jl. Mawar No. 15',
      village: 'Bekasi Jaya',
      district: 'Bekasi Timur',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    {
      email: 'siti.nurhaliza@email.com',
      password: 'password123',
      role: 'USER',
      fullName: 'Siti Nurhaliza',
      nik: '3201123456789002',
      phone: '08123456702',
      gender: 'FEMALE',
      dateOfBirth: new Date('1990-08-20'),
      qrCode: 'USER_002',
      street: 'Jl. Melati No. 20',
      village: 'Bekasi Indah',
      district: 'Bekasi Timur',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    {
      email: 'andi.wijaya@email.com',
      password: 'password123',
      role: 'USER',
      fullName: 'Andi Wijaya',
      nik: '3201123456789003',
      phone: '08123456703',
      gender: 'MALE',
      dateOfBirth: new Date('1988-12-10'),
      qrCode: 'USER_003',
      street: 'Jl. Anggrek No. 25',
      village: 'Bekasi Timur',
      district: 'Bekasi Timur',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    {
      email: 'lisa.permata@email.com',
      password: 'password123',
      role: 'USER',
      fullName: 'Lisa Permata',
      nik: '3201123456789004',
      phone: '08123456704',
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-03-25'),
      qrCode: 'USER_004',
      street: 'Jl. Dahlia No. 30',
      village: 'Bekasi Selatan',
      district: 'Bekasi Selatan',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    {
      email: 'rudi.hartono@email.com',
      password: 'password123',
      role: 'USER',
      fullName: 'Rudi Hartono',
      nik: '3201123456789005',
      phone: '08123456705',
      gender: 'MALE',
      dateOfBirth: new Date('1982-07-08'),
      qrCode: 'USER_005',
      street: 'Jl. Kenanga No. 12',
      village: 'Bekasi Utara',
      district: 'Bekasi Utara',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    },

    // Your personal accounts
    {
      email: 'sofwannuhaalfaruq@gmail.com',
      password: 'password123',
      role: 'ADMIN',
      fullName: 'Sofwan Nuha Al Faruq',
      nik: '3201123456789099',
      phone: '08123456799',
      gender: 'MALE',
      qrCode: 'DEV_001',
      emailVerified: true,
      street: 'Jl. Developer No. 1',
      village: 'Kelurahan Dev',
      district: 'Kecamatan Code',
      regency: 'Kota Bekasi',
      province: 'Jawa Barat'
    }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        password: hashedPassword,
      },
    });
  }

  console.log(`  ✅ ${users.length} users created`);
};

module.exports = userSeeder;