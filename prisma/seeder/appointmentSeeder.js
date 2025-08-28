const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const appointmentSeeder = async () => {
  console.log('  📅 Creating appointments...');

  // Get users and doctors
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 8
  });

  const doctors = await prisma.doctor.findMany({
    take: 5 // Increase to match available doctors
  });

  if (users.length === 0 || doctors.length === 0) {
    console.log('  ⚠️ Not enough users or doctors to create appointments');
    return;
  }

  const appointments = [];

  // Today's appointments
  if (users.length >= 1 && doctors.length >= 1) {
    appointments.push({
      userId: users[0].id,
      doctorId: doctors[0].id,
      appointmentDate: new Date(),
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
      type: 'CONSULTATION',
      status: 'CONFIRMED',
      reason: 'Kontrol rutin diabetes',
      notes: 'Pasien rutin kontrol setiap bulan',
      reminderSent: true
    });
  }

  if (users.length >= 2 && doctors.length >= 2) {
    appointments.push({
      userId: users[1].id,
      doctorId: doctors[1].id,
      appointmentDate: new Date(),
      startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4.5 * 60 * 60 * 1000),
      type: 'CHECKUP',
      status: 'SCHEDULED',
      reason: 'Imunisasi anak',
      notes: 'Imunisasi DPT ke-3',
      reminderSent: false
    });
  }

  // Tomorrow's appointments
  if (users.length >= 3) {
    const doctorId = doctors.length >= 3 ? doctors[2].id : doctors[0].id;
    appointments.push({
      userId: users[2].id,
      doctorId: doctorId,
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8.5 * 60 * 60 * 1000),
      type: 'CONSULTATION',
      status: 'SCHEDULED',
      reason: 'Pemeriksaan mata rutin',
      notes: 'Kontrol minus mata',
      reminderSent: false
    });
  }

  if (users.length >= 4 && doctors.length >= 1) {
    appointments.push({
      userId: users[3].id,
      doctorId: doctors[0].id,
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000),
      type: 'FOLLOW_UP',
      status: 'CONFIRMED',
      reason: 'Follow up hasil lab',
      notes: 'Kontrol hasil lab minggu lalu',
      reminderSent: true
    });
  }

  // Next week appointments
  if (users.length >= 5 && doctors.length >= 2) {
    appointments.push({
      userId: users[4].id,
      doctorId: doctors[1].id,
      appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000),
      type: 'CONSULTATION',
      status: 'SCHEDULED',
      reason: 'Konsultasi tumbuh kembang anak',
      notes: 'Anak usia 2 tahun',
      reminderSent: false
    });
  }

  // Past appointments (completed)
  if (users.length >= 6 && doctors.length >= 1) {
    appointments.push({
      userId: users[5].id,
      doctorId: doctors[0].id,
      appointmentDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000),
      type: 'CONSULTATION',
      status: 'COMPLETED',
      queueNumber: 'RS009',
      reason: 'Pemeriksaan umum',
      notes: 'Pasien mengeluh demam',
      reminderSent: true,
      rating: 5,
      feedback: 'Pelayanan sangat baik dan dokter ramah'
    });
  }

  if (users.length >= 7 && doctors.length >= 2) {
    appointments.push({
      userId: users[6].id,
      doctorId: doctors[1].id,
      appointmentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 14.5 * 60 * 60 * 1000),
      type: 'CHECKUP',
      status: 'COMPLETED',
      reason: 'Vaksinasi COVID-19',
      notes: 'Vaksin dosis booster',
      reminderSent: true,
      rating: 4,
      feedback: 'Proses cepat, tidak ada efek samping'
    });
  }

  // Cancelled appointment
  if (users.length >= 8) {
    const doctorId = doctors.length >= 3 ? doctors[2].id : doctors[0].id;
    appointments.push({
      userId: users[7].id,
      doctorId: doctorId,
      appointmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 11.5 * 60 * 60 * 1000),
      type: 'CONSULTATION',
      status: 'CANCELLED',
      reason: 'Pemeriksaan mata',
      notes: 'Dibatalkan karena halangan mendadak',
      reminderSent: true
    });
  }

  for (const appointment of appointments) {
    await prisma.appointment.create({
      data: appointment
    });
  }

  console.log(`  ✅ ${appointments.length} appointments created`);
};

module.exports = appointmentSeeder;