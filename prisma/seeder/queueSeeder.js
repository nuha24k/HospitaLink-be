const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const queueSeeder = async () => {
  console.log('  🎫 Creating queues...');

  // Get users, doctors, consultations, and appointments
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 10
  });

  const doctors = await prisma.doctor.findMany({
    take: 5
  });

  const consultations = await prisma.consultation.findMany({
    take: 5
  });

  const appointments = await prisma.appointment.findMany({
    take: 5
  });

  if (users.length === 0 || doctors.length === 0) {
    console.log('  ⚠️ Not enough users or doctors to create queues');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const queues = [];

  // Active queue with consultation link
  if (users.length >= 1 && doctors.length >= 1) {
    queues.push({
      userId: users[0].id,
      doctorId: doctors[0].id,
      consultationId: consultations[0]?.id || null,
      queueNumber: 'RS001',
      currentNumber: 'RS001',
      status: 'IN_PROGRESS',
      position: 1,
      estimatedWaitTime: 0,
      checkInTime: new Date(Date.now() - 30 * 60 * 1000),
      calledTime: new Date(Date.now() - 5 * 60 * 1000),
      queueDate: today,
      notes: 'Pasien prioritas - lansia'
    });
  }

  // Queue with appointment link
  if (users.length >= 2 && doctors.length >= 1 && appointments.length >= 1) {
    queues.push({
      userId: users[1].id,
      doctorId: doctors[0].id,
      appointmentId: appointments[0].id,
      queueNumber: 'RS002',
      status: 'WAITING',
      position: 2,
      estimatedWaitTime: 15,
      checkInTime: new Date(Date.now() - 20 * 60 * 1000),
      queueDate: today
    });
  }

  // Regular walk-in queue
  if (users.length >= 3 && doctors.length >= 1) {
    queues.push({
      userId: users[2].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS003',
      queueType: 'WALK_IN',
      status: 'WAITING',
      position: 3,
      estimatedWaitTime: 30,
      checkInTime: new Date(Date.now() - 10 * 60 * 1000),
      queueDate: today
    });
  }

  // Priority queue for pregnant patient
  if (users.length >= 4 && doctors.length >= 2) {
    queues.push({
      userId: users[3].id,
      doctorId: doctors[1].id,
      queueNumber: 'RS004',
      queueType: 'APPOINTMENT',
      status: 'WAITING',
      position: 1,
      estimatedWaitTime: 5,
      checkInTime: new Date(Date.now() - 5 * 60 * 1000),
      queueDate: today,
      isPriority: true,
      notes: 'Ibu hamil - prioritas'
    });
  }

  // More queues if data is available
  if (users.length >= 5 && doctors.length >= 2) {
    queues.push({
      userId: users[4].id,
      doctorId: doctors[1].id,
      queueNumber: 'RS005',
      status: 'WAITING',
      position: 2,
      estimatedWaitTime: 20,
      checkInTime: new Date(),
      queueDate: today
    });
  }

  // Completed queues from today
  if (users.length >= 6 && doctors.length >= 1) {
    queues.push({
      userId: users[5].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS006',
      status: 'COMPLETED',
      position: 1,
      checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      calledTime: new Date(Date.now() - 90 * 60 * 1000),
      completedTime: new Date(Date.now() - 60 * 60 * 1000),
      queueDate: today
    });
  }

  // Cancelled queue
  if (users.length >= 7) {
    const doctorId = doctors.length >= 3 ? doctors[2].id : doctors[0].id;
    queues.push({
      userId: users[6].id,
      doctorId: doctorId,
      queueNumber: 'RS007',
      status: 'CANCELLED',
      position: 2,
      checkInTime: new Date(Date.now() - 45 * 60 * 1000),
      queueDate: today,
      notes: 'Pasien tidak datang setelah dipanggil 3x'
    });
  }

  // Yesterday's completed queue (for history)
  if (users.length >= 8 && doctors.length >= 1) {
    queues.push({
      userId: users[7].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS008',
      status: 'COMPLETED',
      position: 1,
      checkInTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      calledTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      completedTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      queueDate: yesterday
    });
  }

  let createdCount = 0;
  for (const queue of queues) {
    try {
      await prisma.queue.create({
        data: queue
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create queue ${queue.queueNumber}: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} queues created`);
};

module.exports = queueSeeder;