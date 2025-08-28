const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const notificationSeeder = async () => {
  console.log('  🔔 Creating notifications...');

  // Get users for notifications
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  if (users.length === 0) {
    console.log('  ⚠️ No users found to create notifications');
    return;
  }

  const notifications = [
    // Queue notifications
    {
      userId: users[0].id,
      title: '🎫 Nomor Antrian Dipanggil',
      message: 'Nomor antrian RS001 sedang dipanggil. Silakan menuju ruang praktik Dr. Sarah Wijaya.',
      type: 'QUEUE',
      priority: 'HIGH',
      isRead: false,
      actionUrl: '/queue/RS001',
      relatedData: {
        queueNumber: 'RS001',
        doctorName: 'Dr. Sarah Wijaya',
        roomNumber: 'Ruang 1'
      }
    },

    {
      userId: users[1].id,
      title: '⏰ Estimasi Waktu Antrian',
      message: 'Perkiraan waktu tunggu Anda: 15 menit. Nomor antrian saat ini: RS001',
      type: 'QUEUE',
      priority: 'MEDIUM',
      isRead: true,
      readAt: new Date(Date.now() - 10 * 60 * 1000),
      relatedData: {
        queueNumber: 'RS002',
        currentNumber: 'RS001',
        estimatedWait: 15
      }
    },

    // Appointment notifications
    {
      userId: users[2].id,
      title: '📅 Pengingat Janji Temu',
      message: 'Anda memiliki janji temu dengan Dr. Linda Kartika besok pukul 08:00. Jangan lupa datang 15 menit sebelumnya.',
      type: 'APPOINTMENT',
      priority: 'HIGH',
      isRead: false,
      actionUrl: '/appointments',
      relatedData: {
        appointmentId: 'apt_001',
        doctorName: 'Dr. Linda Kartika',
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        time: '08:00'
      }
    },

    {
      userId: users[3].id,
      title: '✅ Janji Temu Dikonfirmasi',
      message: 'Janji temu Anda dengan Dr. Ahmad Rahman pada tanggal 25 Desember 2024 telah dikonfirmasi.',
      type: 'APPOINTMENT',
      priority: 'MEDIUM',
      isRead: true,
      readAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      actionUrl: '/appointments',
      relatedData: {
        appointmentId: 'apt_002',
        doctorName: 'Dr. Ahmad Rahman',
        status: 'confirmed'
      }
    },

    // Lab result notifications
    {
      userId: users[0].id,
      title: '🚨 Hasil Lab Kritis',
      message: 'PENTING: Hasil pemeriksaan Troponin T Anda memerlukan perhatian segera. Silakan hubungi dokter atau datang ke IGD.',
      type: 'LAB_RESULT',
      priority: 'HIGH',
      isRead: false,
      actionUrl: '/lab-results',
      relatedData: {
        testName: 'Troponin T',
        isCritical: true,
        value: 0.8,
        normalRange: '< 0.1'
      }
    },

    {
      userId: users[1].id,
      title: '📋 Hasil Lab Tersedia',
      message: 'Hasil pemeriksaan Gula Darah Sewaktu Anda sudah tersedia. Silakan cek di aplikasi.',
      type: 'LAB_RESULT',
      priority: 'MEDIUM',
      isRead: false,
      actionUrl: '/lab-results',
      relatedData: {
        testName: 'Gula Darah Sewaktu',
        isNew: true
      }
    },

    {
      userId: users[3].id,
      title: '✅ Hasil Lab Normal',
      message: 'Hasil pemeriksaan Urine Lengkap Anda menunjukkan hasil dalam batas normal.',
      type: 'LAB_RESULT',
      priority: 'LOW',
      isRead: true,
      readAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      actionUrl: '/lab-results',
      relatedData: {
        testName: 'Urine Lengkap',
        isNormal: true
      }
    },

    // Payment notifications
    {
      userId: users[4].id,
      title: '💳 Tagihan Belum Dibayar',
      message: 'Anda memiliki tagihan sebesar Rp 200.000 untuk konsultasi dengan Dr. Sarah Wijaya. Batas pembayaran: 3 hari.',
      type: 'PAYMENT',
      priority: 'MEDIUM',
      isRead: false,
      actionUrl: '/payments',
      relatedData: {
        amount: 200000,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        doctorName: 'Dr. Sarah Wijaya'
      }
    },

    {
      userId: users[2].id,
      title: '✅ Pembayaran Berhasil',
      message: 'Pembayaran sebesar Rp 175.000 untuk konsultasi telah berhasil diproses.',
      type: 'PAYMENT',
      priority: 'LOW',
      isRead: true,
      readAt: new Date(Date.now() - 30 * 60 * 1000),
      actionUrl: '/payments',
      relatedData: {
        amount: 175000,
        status: 'paid',
        paymentMethod: 'CASH'
      }
    },

    // System notifications
    {
      userId: users[0].id,
      title: '🔄 Pembaruan Sistem',
      message: 'Aplikasi HospitalLink telah diperbarui ke versi 1.0.1. Nikmati fitur-fitur terbaru!',
      type: 'SYSTEM',
      priority: 'LOW',
      isRead: false,
      relatedData: {
        version: '1.0.1',
        features: ['Peningkatan performa', 'Bug fixes', 'UI improvements']
      }
    },

    {
      userId: users[1].id,
      title: '🎉 Selamat Datang!',
      message: 'Selamat datang di HospitalLink! Nikmati kemudahan akses layanan kesehatan di ujung jari Anda.',
      type: 'SYSTEM',
      priority: 'LOW',
      isRead: true,
      readAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      relatedData: {
        welcomeMessage: true,
        firstLogin: true
      }
    },

    // Old notifications (for testing pagination)
    {
      userId: users[0].id,
      title: '📅 Janji Temu Selesai',
      message: 'Terima kasih telah menggunakan layanan kami. Jangan lupa berikan rating untuk dokter.',
      type: 'APPOINTMENT',
      priority: 'LOW',
      isRead: true,
      readAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actionUrl: '/appointments/rate',
      relatedData: {
        appointmentId: 'apt_old_001',
        doctorName: 'Dr. Sarah Wijaya',
        canRate: true
      }
    }
  ];

  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification
    });
  }

  console.log(`  ✅ ${notifications.length} notifications created`);
};

module.exports = notificationSeeder;