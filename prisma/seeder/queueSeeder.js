const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const queueSeeder = async () => {
  console.log('  🎫 Creating queues...');

  // Get users, doctors, and consultations
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 10
  });

  const doctors = await prisma.doctor.findMany({
    take: 5 // Increase to match available doctors
  });

  const consultations = await prisma.consultation.findMany({
    where: { isCompleted: false },
    take: 2
  });

  if (users.length === 0) {
    console.log('  ⚠️ No users found to create queues');
    return;
  }

  if (doctors.length === 0) {
    console.log('  ⚠️ No doctors found to create queues');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Only create queues if we have enough data
  const availableUsers = Math.min(users.length, 9);
  const availableDoctors = doctors.length;

  const queues = [];

  // Active queues for today
  if (availableUsers >= 1 && availableDoctors >= 1) {
    queues.push({
      userId: users[0].id,
      doctorId: doctors[0].id,
      consultationId: consultations[0]?.id,
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

  if (availableUsers >= 2 && availableDoctors >= 1) {
    queues.push({
      userId: users[1].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS002',
      status: 'WAITING',
      position: 2,
      estimatedWaitTime: 15,
      checkInTime: new Date(Date.now() - 20 * 60 * 1000),
      queueDate: today
    });
  }

  if (availableUsers >= 3 && availableDoctors >= 1) {
    queues.push({
      userId: users[2].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS003',
      status: 'WAITING',
      position: 3,
      estimatedWaitTime: 30,
      checkInTime: new Date(Date.now() - 10 * 60 * 1000),
      queueDate: today
    });
  }

  if (availableUsers >= 4 && availableDoctors >= 2) {
    queues.push({
      userId: users[3].id,
      doctorId: doctors[1].id,
      queueNumber: 'RS004',
      status: 'WAITING',
      position: 1,
      estimatedWaitTime: 5,
      checkInTime: new Date(Date.now() - 5 * 60 * 1000),
      queueDate: today,
      isPriority: true,
      notes: 'Ibu hamil'
    });
  }

  if (availableUsers >= 5 && availableDoctors >= 2) {
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
  if (availableUsers >= 6 && availableDoctors >= 1) {
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

  if (availableUsers >= 7 && availableDoctors >= 2) {
    queues.push({
      userId: users[6].id,
      doctorId: doctors[1].id,
      queueNumber: 'RS007',
      status: 'COMPLETED',
      position: 1,
      checkInTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      calledTime: new Date(Date.now() - 150 * 60 * 1000),
      completedTime: new Date(Date.now() - 120 * 60 * 1000),
      queueDate: today
    });
  }

  // Cancelled queue - use available doctor or fallback to first doctor
  if (availableUsers >= 8) {
    const doctorForCancelled = availableDoctors >= 3 ? doctors[2].id : doctors[0].id;
    queues.push({
      userId: users[7].id,
      doctorId: doctorForCancelled,
      queueNumber: 'RS008',
      status: 'CANCELLED',
      position: 2,
      checkInTime: new Date(Date.now() - 45 * 60 * 1000),
      queueDate: today,
      notes: 'Pasien tidak datang setelah dipanggil 3x'
    });
  }

  // Yesterday's completed queues (for history)
  if (availableUsers >= 9 && availableDoctors >= 1) {
    queues.push({
      userId: users[8].id,
      doctorId: doctors[0].id,
      queueNumber: 'RS009',
      status: 'COMPLETED',
      position: 1,
      checkInTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      calledTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      completedTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      queueDate: yesterday
    });
  }

  // Create queues
  for (const queue of queues) {
    await prisma.queue.create({
      data: queue
    });
  }

  console.log(`  ✅ ${queues.length} queues created`);
};

module.exports = queueSeeder;