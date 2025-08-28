const { PrismaClient } = require('@prisma/client');

// Import all seeders
const userSeeder = require('./seeder/userSeeder');
const hospitalConfigSeeder = require('./seeder/hospitalConfigSeeder');
const doctorSeeder = require('./seeder/doctorSeeder');
const consultationSeeder = require('./seeder/consultationSeeder');
const queueSeeder = require('./seeder/queueSeeder');
const appointmentSeeder = require('./seeder/appointmentSeeder');
const medicalRecordSeeder = require('./seeder/medicalRecordSeeder');
const labResultSeeder = require('./seeder/labResultSeeder');
const notificationSeeder = require('./seeder/notificationSeeder');
const systemConfigSeeder = require('./seeder/systemConfigSeeder');
const familyMemberSeeder = require('./seeder/familyMemberSeeder');

const prisma = new PrismaClient();

const main = async () => {
  console.log('🏥 Starting HospitalLink Database Seeding...\n');
  
  try {
    // 1. System Configuration (Must be first)
    console.log('📋 Seeding System Configurations...');
    await systemConfigSeeder();
    console.log('✅ System Configurations seeded successfully!\n');

    // 2. Hospital Configuration (Must be early)
    console.log('🏥 Seeding Hospital Configuration...');
    await hospitalConfigSeeder();
    console.log('✅ Hospital Configuration seeded successfully!\n');

    // 3. Users (Foundation for all other data)
    console.log('👥 Seeding Users...');
    await userSeeder();
    console.log('✅ Users seeded successfully!\n');

    // 4. Doctors (Independent of users)
    console.log('👨‍⚕️ Seeding Doctors...');
    await doctorSeeder();
    console.log('✅ Doctors seeded successfully!\n');

    // 5. Family Members (Depends on users)
    console.log('👨‍👩‍👧‍👦 Seeding Family Members...');
    await familyMemberSeeder();
    console.log('✅ Family Members seeded successfully!\n');

    // 6. Consultations (Depends on users and doctors)
    console.log('💬 Seeding Consultations...');
    await consultationSeeder();
    console.log('✅ Consultations seeded successfully!\n');

    // 7. Queues (Depends on users, doctors, consultations)
    console.log('🎫 Seeding Queues...');
    await queueSeeder();
    console.log('✅ Queues seeded successfully!\n');

    // 8. Appointments (Depends on users and doctors)
    console.log('📅 Seeding Appointments...');
    await appointmentSeeder();
    console.log('✅ Appointments seeded successfully!\n');

    // 9. Medical Records (Depends on users, doctors, consultations)
    console.log('📋 Seeding Medical Records...');
    await medicalRecordSeeder();
    console.log('✅ Medical Records seeded successfully!\n');

    // 10. Lab Results (Depends on users and medical records)
    console.log('🔬 Seeding Lab Results...');
    await labResultSeeder();
    console.log('✅ Lab Results seeded successfully!\n');

    // 11. Notifications (Depends on users)
    console.log('🔔 Seeding Notifications...');
    await notificationSeeder();
    console.log('✅ Notifications seeded successfully!\n');

    console.log('🎉 All seeding completed successfully!');
    console.log('📊 Database is ready for development!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();