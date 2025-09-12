const { PrismaClient } = require('@prisma/client');

// Import all seeders
const userSeeder = require('./seeder/userSeeder');
const hospitalConfigSeeder = require('./seeder/hospitalConfigSeeder');
const doctorSeeder = require('./seeder/doctorSeeder');
const consultationSeeder = require('./seeder/consultationSeeder');
const queueSeeder = require('./seeder/queueSeeder');
const appointmentSeeder = require('./seeder/appointmentSeeder');
const prescriptionSeeder = require('./seeder/prescriptionSeeder'); 
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

    // 7. Appointments (Depends on users and doctors)
    console.log('📅 Seeding Appointments...');
    await appointmentSeeder();
    console.log('✅ Appointments seeded successfully!\n');

    // 8. Queues (Depends on users, doctors, consultations, appointments)
    console.log('🎫 Seeding Queues...');
    await queueSeeder();
    console.log('✅ Queues seeded successfully!\n');

    // 9. Prescriptions (NEW - Depends on users, doctors, consultations, appointments)
    console.log('💊 Seeding Prescriptions...');
    await prescriptionSeeder();
    console.log('✅ Prescriptions seeded successfully!\n');

    // 10. Medical Records (Depends on users, doctors, consultations)
    console.log('📋 Seeding Medical Records...');
    await medicalRecordSeeder();
    console.log('✅ Medical Records seeded successfully!\n');

    // 11. Lab Results (Depends on users and medical records)
    console.log('🔬 Seeding Lab Results...');
    await labResultSeeder();
    console.log('✅ Lab Results seeded successfully!\n');

    // 12. Notifications (Depends on users)
    console.log('🔔 Seeding Notifications...');
    await notificationSeeder();
    console.log('✅ Notifications seeded successfully!\n');

    console.log('🎉 All seeding completed successfully!');
    console.log('📊 Database is ready for development!\n');

    // Print summary
    const summary = await getSeedingSummary();
    console.log('📈 Seeding Summary:');
    console.log(summary);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// Helper function to get seeding summary
const getSeedingSummary = async () => {
  try {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.doctor.count(),
      prisma.consultation.count(),
      prisma.appointment.count(),
      prisma.queue.count(),
      prisma.prescription.count(),
      prisma.medicalRecord.count(),
      prisma.labResult.count(),
      prisma.notification.count(),
      prisma.familyMember.count(),
    ]);

    return `
  👥 Users: ${counts[0]}
  👨‍⚕️ Doctors: ${counts[1]}
  💬 Consultations: ${counts[2]}
  📅 Appointments: ${counts[3]}
  🎫 Queues: ${counts[4]}
  💊 Prescriptions: ${counts[5]}
  📋 Medical Records: ${counts[6]}
  🔬 Lab Results: ${counts[7]}
  🔔 Notifications: ${counts[8]}
  👨‍👩‍👧‍👦 Family Members: ${counts[9]}
    `;
  } catch (error) {
    return '  ⚠️ Could not generate summary';
  }
};

main();