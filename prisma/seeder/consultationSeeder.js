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
    take: 3
  });

  if (users.length === 0 || doctors.length === 0) {
    console.log('  ⚠️ Not enough users or doctors to create consultations');
    return;
  }

  const consultations = [
    // AI Consultations
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
        }
      ],
      isCompleted: true,
      rating: 4
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
        }
      ],
      isCompleted: true,
      rating: 5
    },

    // Doctor Consultations
    {
      userId: users[2].id,
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
        'Kurangi aktivitas berat'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Dok, saya merasa nyeri dada dan sesak napas',
          timestamp: new Date()
        },
        {
          type: 'doctor',
          message: 'Baik, mari kita periksa lebih lanjut. Kapan gejala ini mulai muncul?',
          timestamp: new Date()
        }
      ],
      isCompleted: true,
      rating: 5,
      feedback: 'Dokter sangat membantu dan penjelasan jelas'
    },

    {
      userId: users[3].id,
      doctorId: doctors[1].id,
      type: 'SPECIALIST',
      severity: 'HIGH',
      symptoms: [
        'Demam tinggi pada anak',
        'Anak rewel',
        'Tidak mau makan',
        'Muntah'
      ],
      recommendations: [
        'Rawat inap observasi',
        'Infus untuk mencegah dehidrasi',
        'Pemeriksaan darah lengkap'
      ],
      isCompleted: true,
      rating: 5,
      feedback: 'Penanganan cepat dan tepat untuk anak saya'
    },

    // Ongoing consultation
    {
      userId: users[4].id,
      doctorId: doctors[2].id,
      type: 'GENERAL',
      severity: 'MEDIUM',
      symptoms: [
        'Sakit perut',
        'Diare',
        'Mual'
      ],
      chatHistory: [
        {
          type: 'user',
          message: 'Dok, perut saya sakit dan diare sejak kemarin',
          timestamp: new Date()
        }
      ],
      isCompleted: false
    }
  ];

  for (const consultation of consultations) {
    await prisma.consultation.create({
      data: consultation
    });
  }

  console.log(`  ✅ ${consultations.length} consultations created`);
};

module.exports = consultationSeeder;