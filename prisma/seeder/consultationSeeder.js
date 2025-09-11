const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const consultationSeeder = async () => {
  console.log('  💬 Creating consultations...');

  // Get users and doctors for creating consultations
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  const doctors = await prisma.doctor.findMany({
    include: {
      user: {
        select: {
          fullName: true,
          isActive: true,
        },
      },
    },
    take: 5
  });

  if (users.length === 0) {
    console.log('  ⚠️ No users found to create consultations');
    return;
  }

  if (doctors.length === 0) {
    console.log('  ⚠️ No doctors found to create consultations');
    return;
  }

  console.log(`  📊 Found ${users.length} users and ${doctors.length} doctors`);

  const consultations = [
    // AI Consultations - no doctor needed
    {
      userId: users[0].id,
      doctorId: null,
      type: 'AI',
      severity: 'MEDIUM',
      symptoms: [
        'Demam tinggi 3 hari',
        'Sakit kepala',
        'Mual dan muntah',
        'Lemas'
      ],
      aiAnalysis: {
        possibleConditions: [
          { condition: 'Demam Berdarah', probability: 0.7 },
          { condition: 'Tifus', probability: 0.3 }
        ],
        urgencyLevel: 'HIGH',
        recommendations: [
          'Segera periksakan ke dokter',
          'Banyak minum air putih',
          'Istirahat total'
        ]
      },
      recommendations: [
        'Konsultasi dengan dokter spesialis penyakit dalam',
        'Lakukan pemeriksaan darah lengkap',
        'Monitor suhu tubuh setiap 4 jam'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Saya demam tinggi sudah 3 hari, bagaimana ya?',
          timestamp: new Date()
        },
        {
          type: 'ai',
          message: 'Demam tinggi selama 3 hari memerlukan perhatian. Apakah ada gejala lain yang Anda rasakan?',
          timestamp: new Date()
        },
        {
          type: 'user',
          message: 'Saya juga sakit kepala dan mual',
          timestamp: new Date()
        },
        {
          type: 'ai',
          message: 'Berdasarkan gejala yang Anda sebutkan, ada kemungkinan demam berdarah. Saya sarankan segera periksakan ke dokter untuk pemeriksaan lebih lanjut.',
          timestamp: new Date()
        }
      ],
      isCompleted: true,
      rating: 4,
      feedback: 'AI analysis sangat membantu dalam memberikan panduan awal'
    },

    {
      userId: users[1].id,
      doctorId: null,
      type: 'AI',
      severity: 'LOW',
      symptoms: [
        'Batuk kering',
        'Hidung tersumbat',
        'Bersin-bersin'
      ],
      aiAnalysis: {
        possibleConditions: [
          { condition: 'Flu Biasa', probability: 0.8 },
          { condition: 'Alergi', probability: 0.2 }
        ],
        urgencyLevel: 'LOW',
        recommendations: [
          'Istirahat yang cukup',
          'Minum air hangat',
          'Konsumsi vitamin C'
        ]
      },
      recommendations: [
        'Istirahat yang cukup',
        'Perbanyak minum air putih hangat',
        'Konsumsi vitamin C',
        'Jika tidak membaik dalam 3 hari, konsultasi ke dokter'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Saya batuk dan pilek, tapi tidak demam',
          timestamp: new Date()
        },
        {
          type: 'ai',
          message: 'Sepertinya Anda mengalami flu ringan. Berapa lama gejala ini sudah berlangsung?',
          timestamp: new Date()
        },
        {
          type: 'user',
          message: 'Baru 2 hari ini',
          timestamp: new Date()
        },
        {
          type: 'ai',
          message: 'Untuk flu ringan seperti ini, istirahat yang cukup dan minum air hangat biasanya cukup membantu. Monitor kondisi Anda, jika tidak membaik dalam 3 hari sebaiknya konsultasi ke dokter.',
          timestamp: new Date()
        }
      ],
      isCompleted: true,
      rating: 5,
      feedback: 'Sangat praktis untuk konsultasi gejala ringan'
    }
  ];

  // Add doctor consultations only if doctors are available
  if (doctors.length >= 1) {
    consultations.push({
      userId: users[2] ? users[2].id : users[0].id,
      doctorId: doctors[0].id,
      type: 'GENERAL',
      severity: 'MEDIUM',
      symptoms: [
        'Nyeri dada',
        'Sesak napas',
        'Jantung berdebar'
      ],
      recommendations: [
        'Lakukan EKG',
        'Pemeriksaan tekanan darah',
        'Kurangi aktivitas berat',
        'Kontrol kembali 1 minggu'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Dok, saya merasa nyeri dada dan sesak napas',
          timestamp: new Date(Date.now() - 60 * 60 * 1000)
        },
        {
          type: 'doctor',
          message: 'Baik, mari kita periksa lebih lanjut. Kapan gejala ini mulai muncul?',
          timestamp: new Date(Date.now() - 55 * 60 * 1000)
        },
        {
          type: 'user',
          message: 'Sejak kemarin pagi, terutama saat beraktivitas',
          timestamp: new Date(Date.now() - 50 * 60 * 1000)
        },
        {
          type: 'doctor',
          message: 'Saya akan lakukan pemeriksaan fisik dan EKG untuk memastikan kondisi jantung Anda. Sementara ini, hindari aktivitas berat dulu ya.',
          timestamp: new Date(Date.now() - 45 * 60 * 1000)
        }
      ],
      isCompleted: true,
      rating: 5,
      feedback: 'Dokter sangat membantu dan penjelasan jelas'
    });
  }

  if (doctors.length >= 2) {
    consultations.push({
      userId: users[3] ? users[3].id : users[1].id,
      doctorId: doctors[1].id,
      type: 'GENERAL',
      severity: 'MEDIUM',
      symptoms: [
        'Sakit perut',
        'Diare',
        'Mual',
        'Lemas'
      ],
      recommendations: [
        'Diet BRAT (Banana, Rice, Apple, Toast)',
        'Perbanyak minum air putih',
        'Istirahat cukup',
        'Obat anti diare jika diperlukan'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Dok, perut saya sakit dan diare sejak kemarin',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          type: 'doctor',
          message: 'Berapa kali diare dalam sehari? Apakah ada darah atau lendir?',
          timestamp: new Date(Date.now() - 110 * 60 * 1000)
        },
        {
          type: 'user',
          message: 'Sekitar 5-6 kali, tidak ada darah tapi agak berlendir',
          timestamp: new Date(Date.now() - 100 * 60 * 1000)
        },
        {
          type: 'doctor',
          message: 'Kemungkinan gastroenteritis. Saya berikan obat dan anjuran diet. Penting untuk mencegah dehidrasi.',
          timestamp: new Date(Date.now() - 90 * 60 * 1000)
        }
      ],
      isCompleted: true,
      rating: 4,
      feedback: 'Penanganan cepat dan efektif'
    });
  }

  // Add ongoing consultation if we have enough users
  if (users.length >= 4 && doctors.length >= 1) {
    consultations.push({
      userId: users[4] ? users[4].id : users[0].id,
      doctorId: doctors[0].id,
      type: 'GENERAL',
      severity: 'LOW',
      symptoms: [
        'Sakit kepala ringan',
        'Pusing',
        'Mata lelah'
      ],
      recommendations: [],
      chatHistory: [
        {
          type: 'user',
          message: 'Dok, saya sering sakit kepala dan pusing belakangan ini',
          timestamp: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
          type: 'doctor',
          message: 'Baik, mari kita identifikasi penyebabnya. Apakah Anda sering bekerja di depan komputer?',
          timestamp: new Date(Date.now() - 25 * 60 * 1000)
        },
        {
          type: 'user',
          message: 'Iya dok, hampir 8 jam sehari',
          timestamp: new Date(Date.now() - 20 * 60 * 1000)
        }
      ],
      isCompleted: false // Still ongoing
    });
  }

  // Add one more AI consultation for variety
  if (users.length >= 3) {
    consultations.push({
      userId: users[2].id,
      doctorId: null,
      type: 'AI',
      severity: 'HIGH',
      symptoms: [
        'Nyeri dada hebat',
        'Sesak napas berat',
        'Keringat dingin',
        'Mual'
      ],
      aiAnalysis: {
        possibleConditions: [
          { condition: 'Serangan Jantung', probability: 0.8 },
          { condition: 'Angina Pektoris', probability: 0.2 }
        ],
        urgencyLevel: 'CRITICAL',
        recommendations: [
          'SEGERA KE IGD/RUMAH SAKIT',
          'Jangan menunda pengobatan',
          'Hubungi ambulans jika perlu'
        ]
      },
      recommendations: [
        'EMERGENCY: Segera ke IGD terdekat',
        'Jangan berkendara sendiri',
        'Hubungi keluarga',
        'Siapkan riwayat penyakit'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Tolong! Dada saya sakit sekali, sesak napas!',
          timestamp: new Date()
        },
        {
          type: 'ai',
          message: 'INI ADALAH KONDISI DARURAT! Berdasarkan gejala Anda, segera ke IGD rumah sakit terdekat. Jangan tunda!',
          timestamp: new Date()
        }
      ],
      isCompleted: true,
      rating: 5,
      feedback: 'AI langsung memberikan alert emergency yang sangat membantu'
    });
  }

  let createdCount = 0;
  for (const consultation of consultations) {
    try {
      await prisma.consultation.create({
        data: consultation
      });
      createdCount++;
    } catch (error) {
      console.log(`  ⚠️ Failed to create consultation: ${error.message}`);
    }
  }

  console.log(`  ✅ ${createdCount} consultations created`);
};

module.exports = consultationSeeder;