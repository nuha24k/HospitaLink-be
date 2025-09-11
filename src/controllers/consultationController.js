const { PrismaClient } = require('@prisma/client');
const aiService = require('../services/aiService');

const prisma = new PrismaClient();

// AI Screening - Step 1: Initial AI Analysis
const aiScreening = async (req, res) => {
  try {
    const { userId, symptoms, chatHistory } = req.body;

    console.log('🔄 AI Screening request:', { userId, symptoms });

    // Call OpenRouter AI service
    const aiAnalysis = await aiService.analyzeSymptoms(symptoms, chatHistory);
    
    // Create consultation record
    const consultation = await prisma.consultation.create({
      data: {
        userId,
        type: 'AI',
        severity: aiAnalysis.severity,
        urgency: aiAnalysis.recommendation === 'EMERGENCY' ? 'EMERGENCY' : 
                aiAnalysis.recommendation === 'DOCTOR_CONSULTATION' ? 'URGENT' : 'NORMAL',
        symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
        aiAnalysis: aiAnalysis,
        chatHistory: chatHistory || [],
        recommendation: aiAnalysis.recommendation,
        consultationFee: aiAnalysis.needsDoctor ? 25000 : 0,
        paymentStatus: aiAnalysis.needsDoctor ? 'PENDING' : 'PAID'
      }
    });

    console.log('✅ AI Analysis completed:', aiAnalysis.severity);

    // Prepare response based on AI recommendation
    let responseData = {
      consultationId: consultation.id,
      severity: aiAnalysis.severity,
      urgency: consultation.urgency,
      recommendation: aiAnalysis.recommendation,
      message: aiAnalysis.message,
      needsDoctorConsultation: aiAnalysis.needsDoctor,
      estimatedFee: consultation.consultationFee,
      confidence: aiAnalysis.confidence,
      symptoms_analysis: aiAnalysis.symptoms_analysis
    };

    // If emergency, skip doctor consultation and direct to hospital
    if (aiAnalysis.recommendation === 'EMERGENCY') {
      responseData.emergencyMessage = "Segera datang ke rumah sakit atau IGD terdekat!";
      responseData.hospitalInfo = {
        name: "RS Mitra Keluarga",
        address: "Jl. Raya Hospital No. 123",
        phone: "021-1234567",
        emergencyNumber: "119"
      };
    }

    res.json({
      success: true,
      message: 'AI screening completed',
      data: responseData
    });

  } catch (error) {
    console.error('❌ AI Screening error:', error);
    res.status(500).json({
      success: false,
      message: 'AI screening failed',
      error: error.message
    });
  }
};

// Request Doctor Chat Consultation - Step 2
const requestDoctorChat = async (req, res) => {
  try {
    const { consultationId, paymentMethod = 'CASH' } = req.body;

    // Get consultation
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { user: true }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check if payment is needed
    if (consultation.consultationFee > 0 && consultation.paymentStatus !== 'PAID') {
      // For demo, we'll mark as paid. In production, integrate with payment gateway
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { 
          paymentStatus: 'PAID',
          paymentMethod: paymentMethod 
        }
      });
    }

    // Find available doctor for chat consultation
    const availableDoctor = await prisma.doctor.findFirst({
      where: {
        isAvailable: true,
        specialty: 'Dokter Umum',
        user: { isActive: true }
      },
      include: {
        user: { select: { fullName: true } }
      }
    });

    if (!availableDoctor) {
      return res.status(503).json({
        success: false,
        message: 'No doctor available for chat consultation at the moment',
        estimatedWaitTime: 30 // minutes
      });
    }

    // Update consultation to chat type
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        type: 'CHAT_DOCTOR',
        doctorId: availableDoctor.id
      }
    });

    res.json({
      success: true,
      message: 'Doctor chat consultation requested',
      data: {
        consultationId: updatedConsultation.id,
        doctor: {
          id: availableDoctor.id,
          name: availableDoctor.name,
          specialty: availableDoctor.specialty
        },
        chatInfo: {
          type: 'asynchronous',
          estimatedResponseTime: '2-4 hours',
          instructions: 'Dokter akan membalas pesan Anda dalam 2-4 jam. Anda akan mendapat notifikasi ketika dokter sudah merespons.'
        },
        paymentStatus: 'PAID',
        totalPaid: consultation.consultationFee
      }
    });

  } catch (error) {
    console.error('Request doctor chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request doctor chat consultation'
    });
  }
};

// Complete Doctor Chat Consultation - Step 3 (Doctor completes)
const completeDoctorChat = async (req, res) => {
  try {
    const { consultationId, doctorDecision, doctorNotes, prescriptions, followUpInDays } = req.body;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { user: true, doctor: true }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Calculate follow-up date if needed
    const followUpDate = followUpInDays ? 
      new Date(Date.now() + followUpInDays * 24 * 60 * 60 * 1000) : null;

    // Update consultation with doctor's decision
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        isCompleted: true,
        recommendation: doctorDecision,
        doctorNotes,
        prescriptions: prescriptions || [],
        followUpDate
      }
    });

    let responseData = {
      consultationId: updatedConsultation.id,
      decision: doctorDecision,
      doctorNotes,
      prescriptions: prescriptions || [],
      followUpDate
    };

    // Handle different doctor decisions
    switch (doctorDecision) {
      case 'PRESCRIPTION_ONLY':
        if (prescriptions && prescriptions.length > 0) {
          // Create digital prescription
          const prescription = await createDigitalPrescription(
            consultation.userId,
            consultation.doctorId,
            consultationId,
            prescriptions,
            doctorNotes
          );
          responseData.prescriptionCode = prescription.prescriptionCode;
          responseData.pharmacyInstructions = "Tunjukkan kode resep ini di apotek";
        }
        break;

      case 'APPOINTMENT_NEEDED':
        // Get available appointment slots
        const availableSlots = await getAvailableAppointmentSlots(consultation.doctorId);
        responseData.availableSlots = availableSlots;
        responseData.appointmentFee = 15000;
        responseData.appointmentInstructions = "Silakan pilih jadwal appointment yang tersedia";
        break;

      case 'EMERGENCY_REFERRAL':
        responseData.emergencyMessage = "Kondisi Anda memerlukan pemeriksaan segera";
        responseData.hospitalInfo = {
          name: "RS Mitra Keluarga",
          address: "Jl. Raya Hospital No. 123",
          emergencyNumber: "119"
        };
        break;
    }

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId: consultation.userId,
        title: 'Konsultasi Online Selesai',
        message: `Dokter ${consultation.doctor?.name} telah menyelesaikan konsultasi Anda. ${
          doctorDecision === 'PRESCRIPTION_ONLY' ? 'Resep digital sudah tersedia.' :
          doctorDecision === 'APPOINTMENT_NEEDED' ? 'Anda perlu appointment lanjutan.' :
          'Silakan baca hasil konsultasi di aplikasi.'
        }`,
        type: 'CONSULTATION',
        priority: 'HIGH'
      }
    });

    res.json({
      success: true,
      message: 'Doctor consultation completed',
      data: responseData
    });

  } catch (error) {
    console.error('Complete doctor consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation'
    });
  }
};

// Book Appointment from Consultation - Step 4
const bookAppointmentFromConsultation = async (req, res) => {
  try {
    const { consultationId, selectedSlot, paymentMethod = 'CASH' } = req.body;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { user: true }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Parse selected slot
    const { doctorId, appointmentDate, startTime } = selectedSlot;
    const appointmentDateTime = new Date(appointmentDate);
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); // 30 minutes

    // Generate queue number for appointment
    const queueNumber = await generateQueueNumber(appointmentDateTime);

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        userId: consultation.userId,
        doctorId,
        consultationId,
        appointmentDate: appointmentDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        type: 'CONSULTATION',
        source: 'ONLINE_CONSULTATION',
        queueNumber,
        reason: `Appointment lanjutan dari konsultasi online: ${consultationId}`,
        status: 'SCHEDULED'
      }
    });

    // Create queue entry for appointment
    const position = await getQueuePosition(appointmentDateTime);
    const queue = await prisma.queue.create({
      data: {
        userId: consultation.userId,
        doctorId,
        appointmentId: appointment.id,
        consultationId,
        queueNumber,
        queueType: 'ONLINE_APPOINTMENT',
        position,
        queueDate: appointmentDateTime,
        notes: `Appointment from online consultation`
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: consultation.userId,
        title: 'Appointment Berhasil Dibuat',
        message: `Appointment Anda pada ${appointmentDate} jam ${startTime.split('T')[1]?.slice(0,5)} berhasil dijadwalkan. Nomor antrian: ${queueNumber}`,
        type: 'APPOINTMENT',
        priority: 'MEDIUM'
      }
    });

    res.json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointmentId: appointment.id,
        queueId: queue.id,
        queueNumber,
        appointmentDate: appointmentDate,
        startTime: startTime,
        position,
        estimatedWaitTime: position * 15, // 15 minutes per patient
        qrCode: `APPT_${appointment.id}_${queueNumber}`,
        totalFee: 40000, // 25000 consultation + 15000 appointment
        instructions: "Datang 15 menit sebelum jadwal appointment Anda"
      }
    });

  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment'
    });
  }
};

// Direct Queue (Walk-in or Direct appointment without consultation)
const takeDirectQueue = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentType = 'WALK_IN', doctorId } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check existing queue for today
    const existingQueue = await prisma.queue.findFirst({
      where: {
        userId,
        queueDate: today,
        status: { in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
      }
    });

    if (existingQueue) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active queue today',
        data: { existingQueue }
      });
    }

    // Auto-assign doctor if not specified
    let assignedDoctor = null;
    if (doctorId) {
      assignedDoctor = await prisma.doctor.findUnique({
        where: { id: doctorId, isAvailable: true }
      });
    } else {
      assignedDoctor = await prisma.doctor.findFirst({
        where: {
          specialty: 'Dokter Umum',
          isAvailable: true,
          user: { isActive: true }
        }
      });
    }

    // Generate queue number and position
    const queueNumber = await generateQueueNumber(today);
    const position = await getQueuePosition(today);

    // Create queue
    const queue = await prisma.queue.create({
      data: {
        userId,
        doctorId: assignedDoctor?.id,
        queueNumber,
        queueType: appointmentType,
        position,
        queueDate: today,
        checkInTime: new Date(),
        estimatedWaitTime: position * 15
      },
      include: {
        doctor: { select: { name: true, specialty: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Queue taken successfully',
      data: {
        queue,
        qrCode: `QUEUE_${queue.id}_${queueNumber}`,
        instructions: appointmentType === 'WALK_IN' ? 
          "Silakan tunggu nomor antrian Anda dipanggil" :
          "Anda memiliki appointment, silakan check-in di loket"
      }
    });

  } catch (error) {
    console.error('Take direct queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to take queue'
    });
  }
};

// Helper Functions
async function createDigitalPrescription(userId, doctorId, consultationId, medications, instructions) {
  const prescriptionCode = `RX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Calculate total amount (mock calculation)
  const totalAmount = medications.reduce((total, med) => {
    return total + (med.price || 0) * (med.quantity || 1);
  }, 0);

  return await prisma.prescription.create({
    data: {
      userId,
      doctorId,
      consultationId,
      prescriptionCode,
      medications,
      instructions,
      totalAmount,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  });
}

async function getAvailableAppointmentSlots(doctorId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const slots = [];

  for (let day = 0; day < 7; day++) {
    const date = new Date(tomorrow);
    date.setDate(date.getDate() + day);
    
    for (const time of timeSlots) {
      const datetime = new Date(`${date.toISOString().split('T')[0]}T${time}:00`);
      
      // Check availability
      const existingAppointment = await prisma.appointment.findFirst({
        where: { doctorId, startTime: datetime }
      });

      if (!existingAppointment) {
        slots.push({
          doctorId,
          appointmentDate: date.toISOString().split('T')[0],
          startTime: datetime.toISOString(),
          time: time,
          displayDate: date.toLocaleDateString('id-ID'),
          displayTime: time
        });
      }
    }
  }

  return slots.slice(0, 20); // Return max 20 slots
}

async function generateQueueNumber(date) {
  const today = date.toISOString().split('T')[0];
  const count = await prisma.queue.count({
    where: { queueDate: new Date(today) }
  });
  return `A${String(count + 1).padStart(3, '0')}`;
}

async function getQueuePosition(date) {
  const today = date.toISOString().split('T')[0];
  const count = await prisma.queue.count({
    where: {
      queueDate: new Date(today),
      status: 'WAITING'
    }
  });
  return count + 1;
}

// Get consultation history
const getConsultationHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const consultations = await prisma.consultation.findMany({
      where: { userId },
      include: {
        doctor: { select: { name: true, specialty: true } },
        appointment: { select: { appointmentDate: true, queueNumber: true } },
        prescriptions: { select: { prescriptionCode: true, isDispensed: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      data: { consultations }
    });

  } catch (error) {
    console.error('Get consultation history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consultation history'
    });
  }
};

// Test AI Connection - Keep existing
const testAIConnection = async (req, res) => {
  try {
    const testSymptoms = ['batuk', 'demam ringan'];
    const result = await aiService.analyzeSymptoms(testSymptoms);

    res.json({
      success: true,
      message: 'AI connection working',
      data: result
    });

  } catch (error) {
    console.error('❌ AI connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'AI connection failed',
      error: error.message
    });
  }
};

module.exports = {
  aiScreening,
  requestDoctorChat,
  completeDoctorChat,
  bookAppointmentFromConsultation,
  takeDirectQueue,
  getConsultationHistory,
  testAIConnection,
  
  // Keep old names for backward compatibility
  requestDoctorConsultation: requestDoctorChat,
  completeDoctorConsultation: completeDoctorChat,
  bookAppointment: bookAppointmentFromConsultation
};