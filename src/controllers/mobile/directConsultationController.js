const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ FIXED: Get available doctors for direct consultation
const getAvailableDoctors = async (req, res) => {
  try {
    console.log('🩺 Getting available doctors for direct consultation...');

    // ✅ FIXED: Use correct Prisma query syntax
    const doctors = await prisma.doctor.findMany({
      where: {
        isAvailable: true,
        isOnDuty: false, // Not currently with patient
        OR: [
          {
            specialty: {
              contains: 'umum' // Remove mode - not supported in this Prisma version
            }
          },
          {
            specialty: {
              contains: 'Umum'
            }
          },
          {
            specialty: {
              contains: 'UMUM'
            }
          },
          {
            specialty: {
              contains: 'general'
            }
          },
          {
            specialty: {
              contains: 'General'
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true
          }
        }
      },
      orderBy: [
        { isOnDuty: 'asc' }, // Available doctors first
        { createdAt: 'asc' }  // Oldest first (fair rotation)
      ],
      take: 10 // Increase limit to get more doctors
    });

    // ✅ If no doctors with 'umum' specialty, get any available doctors
    let availableDoctors = doctors;
    
    if (doctors.length === 0) {
      console.log('⚠️ No "umum" doctors found, getting any available doctors...');
      
      const anyDoctors = await prisma.doctor.findMany({
        where: {
          isAvailable: true,
          isOnDuty: false
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profilePicture: true
            }
          }
        },
        orderBy: [
          { isOnDuty: 'asc' },
          { createdAt: 'asc' }
        ],
        take: 5
      });
      
      availableDoctors = anyDoctors;
    }

    // Transform for mobile response
    const doctorsResponse = availableDoctors.map(doctor => ({
      id: doctor.id,
      userId: doctor.userId,
      name: doctor.name || doctor.user.fullName,
      specialty: doctor.specialty || 'Dokter Umum',
      consultationFee: parseFloat(doctor.consultationFee || 25000),
      isAvailable: doctor.isAvailable && !doctor.isOnDuty,
      profilePicture: doctor.user.profilePicture,
      photoUrl: doctor.user.profilePicture, // ✅ Add this for compatibility
      experience: `${Math.floor(Math.random() * 10) + 5} tahun`, // Mock for MVP
      hospital: 'HospitalLink Medical Center',
      description: `Dokter ${doctor.specialty || 'Umum'} berpengalaman dengan pendekatan yang ramah dan profesional.`
    }));

    console.log(`✅ Found ${doctorsResponse.length} available doctors`);

    res.json({
      success: true,
      message: 'Available doctors retrieved successfully',
      data: {
        doctors: doctorsResponse,
        totalAvailable: doctorsResponse.length,
        consultationTypes: [
          {
            type: 'CHAT',
            name: 'Chat Konsultasi',
            description: 'Konsultasi via chat real-time',
            estimatedResponseTime: '15-30 menit',
            baseFee: 25000
          },
          {
            type: 'CALL',
            name: 'Panggilan Suara',
            description: 'Konsultasi via telepon',
            estimatedResponseTime: '5-15 menit',
            baseFee: 35000
          }
        ]
      }
    });

  } catch (error) {
    console.error('❌ Get available doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available doctors',
      error: error.message
    });
  }
};

// ✅ Start direct consultation (MVP version)
const startDirectConsultation = async (req, res) => {
  try {
    const { doctorId, symptoms, notes, consultationType = 'CHAT' } = req.body;
    const userId = req.user.id;

    console.log('🚀 Starting direct consultation:', {
      userId,
      doctorId,
      consultationType,
      symptomsCount: symptoms?.length || 0
    });

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Symptoms are required'
      });
    }

    // Get doctor details
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true
          }
        }
      }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (!doctor.isAvailable || doctor.isOnDuty) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is not available at the moment'
      });
    }

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        userId,
        doctorId,
        type: 'DOCTOR_CHAT',
        severity: 'MEDIUM', // Default for direct consultation
        symptoms: symptoms,
        consultationFee: parseFloat(doctor.consultationFee || 25000),
        paymentStatus: 'PENDING',
        paymentMethod: 'CASH', // MVP default
        chatHistory: [
          {
            text: `Pasien memulai konsultasi dengan keluhan: ${symptoms.join(', ')}`,
            isUser: false,
            timestamp: new Date().toISOString(),
            isSystemMessage: true
          }
        ],
        doctorNotes: notes || `Konsultasi langsung untuk: ${symptoms.join(', ')}`,
        isCompleted: false
      }
    });

    // Create queue for organized consultation
    const queueNumber = `DC${Date.now().toString().slice(-6)}`; // Direct Consultation
    
    const queue = await prisma.queue.create({
      data: {
        userId,
        doctorId,
        consultationId: consultation.id,
        queueNumber,
        queueType: 'DIRECT_CONSULTATION',
        status: 'WAITING',
        position: 1, // Direct consultation gets priority
        estimatedWaitTime: 15, // 15 minutes for direct consultation
        queueDate: new Date(),
        notes: `Direct consultation: ${symptoms.join(', ')}`
      }
    });

    // Update doctor status
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { isOnDuty: true }
    });

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId,
        title: '✅ Konsultasi Dimulai',
        message: `Konsultasi dengan Dr. ${doctor.name} telah dimulai. Anda akan mendapat respons dalam 15-30 menit.`,
        type: 'CONSULTATION',
        priority: 'MEDIUM',
        actionUrl: `/consultations/${consultation.id}`,
        relatedData: {
          consultationId: consultation.id,
          queueId: queue.id,
          doctorName: doctor.name,
          queueNumber: queue.queueNumber
        }
      }
    });

    // Create notification for doctor
    await prisma.notification.create({
      data: {
        userId: doctor.userId,
        title: '🩺 Konsultasi Baru',
        message: `Pasien baru memerlukan konsultasi untuk: ${symptoms.slice(0, 2).join(', ')}${symptoms.length > 2 ? '...' : ''}`,
        type: 'CONSULTATION',
        priority: 'HIGH',
        actionUrl: `/doctor/consultations/${consultation.id}`,
        relatedData: {
          consultationId: consultation.id,
          queueId: queue.id,
          patientName: req.user.fullName || 'Pasien',
          symptoms: symptoms
        }
      }
    });

    console.log('✅ Direct consultation started:', {
      consultationId: consultation.id,
      queueNumber: queue.queueNumber,
      doctorName: doctor.name
    });

    res.json({
      success: true,
      message: 'Direct consultation started successfully',
      data: {
        consultation: {
          id: consultation.id,
          type: consultation.type,
          status: 'WAITING',
          consultationFee: consultation.consultationFee,
          scheduledTime: consultation.createdAt,
          estimatedResponseTime: '15-30 menit'
        },
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          profilePicture: doctor.user.profilePicture,
          consultationFee: doctor.consultationFee
        },
        queue: {
          id: queue.id,
          queueNumber: queue.queueNumber,
          position: queue.position,
          estimatedWaitTime: queue.estimatedWaitTime,
          status: queue.status
        },
        nextSteps: [
          'Dokter akan menerima notifikasi konsultasi',
          'Anda akan mendapat respons dalam 15-30 menit',
          'Chat akan aktif setelah dokter merespons',
          'Pembayaran akan diproses setelah konsultasi selesai'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Start direct consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start direct consultation',
      error: error.message
    });
  }
};

// ✅ Get consultation details for mobile
const getConsultationDetails = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        userId // Ensure user can only access their own consultations
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true
              }
            }
          }
        },
        queues: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    const queue = consultation.queues[0];

    res.json({
      success: true,
      data: {
        consultation: {
          id: consultation.id,
          type: consultation.type,
          symptoms: consultation.symptoms,
          severity: consultation.severity,
          consultationFee: consultation.consultationFee,
          paymentStatus: consultation.paymentStatus,
          isCompleted: consultation.isCompleted,
          createdAt: consultation.createdAt,
          chatHistory: consultation.chatHistory || [],
          doctorNotes: consultation.doctorNotes,
          recommendation: consultation.recommendation
        },
        doctor: consultation.doctor ? {
          id: consultation.doctor.id,
          name: consultation.doctor.name,
          specialty: consultation.doctor.specialty,
          profilePicture: consultation.doctor.user.profilePicture,
          consultationFee: consultation.doctor.consultationFee
        } : null,
        queue: queue ? {
          id: queue.id,
          queueNumber: queue.queueNumber,
          status: queue.status,
          position: queue.position,
          estimatedWaitTime: queue.estimatedWaitTime
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Get consultation details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consultation details',
      error: error.message
    });
  }
};

module.exports = {
  getAvailableDoctors,
  startDirectConsultation,
  getConsultationDetails
};