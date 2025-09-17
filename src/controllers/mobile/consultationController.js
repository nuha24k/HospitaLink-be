const { PrismaClient } = require('@prisma/client');
const aiService = require('../../services/aiService');

const prisma = new PrismaClient();

// AI Screening - Step 1: Initial AI Analysis
const aiScreening = async (req, res) => {
  try {
    const { userId, symptoms, chatHistory, questionCount = 0 } = req.body;

    console.log('🔄 AI Screening request:', { 
      userId, 
      symptoms, 
      questionCount,
      chatLength: chatHistory?.length || 0 
    });

    // Find or create consultation record
    let consultation = null;
    
    if (req.body.consultationId) {
      consultation = await prisma.consultation.findUnique({
        where: { id: req.body.consultationId }
      });
    }

    if (!consultation) {
      consultation = await prisma.consultation.create({
        data: {
          userId,
          type: 'AI',
          severity: 'COLLECTING_INFO',
          urgency: 'NORMAL',
          symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
          chatHistory: chatHistory || [],
          consultationFee: 0,
          paymentStatus: 'PAID'
        }
      });
    }

    // Call AI service with question count
    const aiAnalysis = await aiService.analyzeSymptoms(symptoms, chatHistory, questionCount);
    
    // Update consultation with latest analysis
    await prisma.consultation.update({
      where: { id: consultation.id },
      data: {
        chatHistory: chatHistory || [],
        aiAnalysis: aiAnalysis,
        severity: aiAnalysis.severity || consultation.severity,
        updatedAt: new Date()
      }
    });

    // Prepare response based on analysis type
    let responseData = {
      consultationId: consultation.id,
      type: aiAnalysis.type,
      ...aiAnalysis
    };

    // If it's a follow-up question
    if (aiAnalysis.type === 'FOLLOW_UP_QUESTION') {
      responseData.message = aiAnalysis.question;
      responseData.isQuestion = true;
      responseData.progress = {
        current: aiAnalysis.questionNumber,
        total: aiAnalysis.totalQuestions,
        percentage: Math.round((aiAnalysis.questionNumber / aiAnalysis.totalQuestions) * 100)
      };
    }
    
    // If it's final diagnosis
    else if (aiAnalysis.type === 'FINAL_DIAGNOSIS') {
      responseData.isComplete = true;
      responseData.message = aiAnalysis.explanation;
      
      // Update consultation as completed if no doctor needed
      if (!aiAnalysis.needsDoctor) {
        await prisma.consultation.update({
          where: { id: consultation.id },
          data: {
            isCompleted: true,
            recommendation: 'SELF_CARE'
          }
        });
      } else {
        await prisma.consultation.update({
          where: { id: consultation.id },
          data: {
            recommendation: aiAnalysis.recommendation,
            consultationFee: 25000,
            paymentStatus: 'PENDING'
          }
        });
      }

      // Add medical search results if available
      if (aiAnalysis.medicalResearch) {
        responseData.medicalResearch = aiAnalysis.medicalResearch;
      }
    }

    console.log('✅ AI Analysis completed:', aiAnalysis.type);

    res.json({
      success: true,
      message: aiAnalysis.type === 'FOLLOW_UP_QUESTION' ? 
        'Follow-up question generated' : 
        'AI screening completed',
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

const markConsultationCompleted = async (req, res) => {
  try {
    const { consultationId, reason = 'USER_COMPLETED' } = req.body;
    const userId = req.user.id;

    console.log('✅ Marking consultation completed:', { consultationId, reason, userId });

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        userId,
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Update consultation as completed
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        isCompleted: true,
        recommendation: consultation.recommendation || 'USER_COMPLETED',
        doctorNotes: consultation.doctorNotes || `Completed by user: ${reason}`,
        updatedAt: new Date()
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Konsultasi Diselesaikan',
        message: 'Konsultasi telah ditandai selesai dan disimpan dalam riwayat',
        type: 'CONSULTATION',
        priority: 'LOW'
      }
    });

    console.log('✅ Consultation marked completed:', consultationId);

    res.json({
      success: true,
      message: 'Consultation marked as completed',
      data: {
        consultationId: updatedConsultation.id,
        isCompleted: true,
        completedAt: updatedConsultation.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Mark consultation completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark consultation completed',
      error: error.message
    });
  }
};

const getConsultationDetails = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    console.log('📋 Getting consultation details:', { consultationId, userId });

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        userId,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    res.json({
      success: true,
      message: 'Consultation details retrieved',
      data: {
        consultation: {
          id: consultation.id,
          type: consultation.type,
          severity: consultation.severity,
          urgency: consultation.urgency,
          symptoms: consultation.symptoms,
          chatHistory: consultation.chatHistory,
          aiAnalysis: consultation.aiAnalysis,
          isCompleted: consultation.isCompleted,
          recommendation: consultation.recommendation,
          doctorNotes: consultation.doctorNotes,
          consultationFee: consultation.consultationFee,
          paymentStatus: consultation.paymentStatus,
          createdAt: consultation.createdAt,
          updatedAt: consultation.updatedAt,
          doctor: consultation.doctor
        }
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

const continueAIConsultation = async (req, res) => {
  try {
    const { consultationId, userResponse, chatHistory } = req.body;

    console.log('🔄 Continue AI consultation:', { consultationId, userResponse });

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Add user response to chat history
    const updatedChatHistory = [
      ...(chatHistory || []),
      {
        id: `user_${Date.now()}`,
        text: userResponse,
        isUser: true,
        timestamp: new Date().toISOString()
      }
    ];

    // Count questions asked so far (excluding welcome message)
    const questionCount = updatedChatHistory.filter(msg => 
      !msg.isUser && !msg.text.includes('Halo! Saya AI Assistant')
    ).length;

    console.log('📊 Current question count:', questionCount);

    // Continue AI analysis
    const aiAnalysis = await aiService.analyzeSymptoms(
      consultation.symptoms, 
      updatedChatHistory, 
      questionCount
    );

    console.log('🤖 AI Analysis result:', aiAnalysis.type, aiAnalysis.question || aiAnalysis.explanation);

    // Prepare response data
    let responseData = {
      consultationId,
      type: aiAnalysis.type,
      chatHistory: updatedChatHistory,
      ...aiAnalysis
    };

    // Handle different response types
    if (aiAnalysis.type === 'FOLLOW_UP_QUESTION') {
      // Add AI question to response
      responseData.message = aiAnalysis.question || 'Pertanyaan tidak tersedia';
      responseData.isQuestion = true;
      responseData.progress = {
        current: questionCount + 1,
        total: 5,
        percentage: Math.round(((questionCount + 1) / 5) * 100)
      };
      
      console.log('✅ Follow-up question:', aiAnalysis.question);
      
    } else if (aiAnalysis.type === 'FINAL_DIAGNOSIS') {
      responseData.message = aiAnalysis.explanation || 'Analisis lengkap telah selesai';
      responseData.isComplete = true;
      
      console.log('✅ Final diagnosis completed');
    }

    // Update consultation with final chat history (without adding AI response yet)
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        chatHistory: updatedChatHistory,
        aiAnalysis: aiAnalysis,
        severity: aiAnalysis.severity || consultation.severity,
        isCompleted: aiAnalysis.type === 'FINAL_DIAGNOSIS' && !aiAnalysis.needsDoctor,
        recommendation: aiAnalysis.recommendation || consultation.recommendation,
        consultationFee: aiAnalysis.needsDoctor ? 25000 : 0,
        paymentStatus: aiAnalysis.needsDoctor ? 'PENDING' : 'PAID',
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: aiAnalysis.type === 'FOLLOW_UP_QUESTION' ? 
        'Follow-up question generated' : 
        'Final diagnosis completed',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Continue AI consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to continue consultation',
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
      include: { 
        user: true,
        doctor: { select: { name: true, specialty: true } }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check if payment is needed
    if (consultation.consultationFee > 0 && consultation.paymentStatus !== 'PAID') {
      // ✅ NEW: Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: consultation.userId,
          type: 'CONSULTATION_PAYMENT',
          status: 'PAID', // For MVP, assume immediate payment
          amount: consultation.consultationFee,
          paymentMethod: paymentMethod.toUpperCase(),
          description: `Online consultation fee with Dr. ${consultation.doctor?.name}`,
          consultationId,
          paidAt: new Date()
        }
      });

      // Update consultation payment status
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { 
          isPaid: true,
          paidAt: new Date(),
          paymentStatus: 'PAID',
          paymentMethod: paymentMethod 
        }
      });

      console.log('💳 Transaction created for consultation:', transaction.id);
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

// Chat Consultation Methods
const getAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    
    // Generate available time slots for the next 7 days
    const slots = [];
    const startDate = date ? new Date(date) : new Date();
    
    // Time slots: 8:00 AM to 5:00 PM, every hour
    const timeSlots = [
      '08:00', '09:00', '10:00', '11:00', 
      '14:00', '15:00', '16:00', '17:00'
    ];

    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      
      // Skip weekends for this MVP
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue;
      
      for (const timeSlot of timeSlots) {
        const [hours, minutes] = timeSlot.split(':');
        const slotDateTime = new Date(currentDate);
        slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Skip past time slots
        if (slotDateTime <= new Date()) continue;
        
        // Check existing appointments/consultations
        const existingCount = await prisma.consultation.count({
          where: {
            doctorId: doctorId || undefined,
            type: 'CHAT_DOCTOR',
            createdAt: {
              gte: new Date(slotDateTime.getTime() - 30 * 60 * 1000), // 30 min before
              lte: new Date(slotDateTime.getTime() + 30 * 60 * 1000)  // 30 min after
            }
          }
        });

        const maxQueue = 10; // Max consultations per slot
        const isAvailable = existingCount < maxQueue;

        slots.push({
          id: `slot_${currentDate.toISOString().split('T')[0]}_${timeSlot}`,
          dateTime: slotDateTime.toISOString(),
          timeDisplay: timeSlot,
          date: currentDate.toISOString().split('T')[0],
          isAvailable,
          currentQueue: existingCount,
          maxQueue
        });
      }
    }

    res.json({
      success: true,
      message: 'Available time slots retrieved',
      data: { slots }
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available slots',
      error: error.message
    });
  }
};

const bookChatConsultation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { slotId, scheduledTime, notes, paymentMethod = 'CREDIT_CARD' } = req.body;

    console.log('📅 Booking chat consultation:', { userId, slotId, scheduledTime });

    // Parse slot info
    const slotParts = slotId.split('_');
    const slotDate = slotParts[1];
    const slotTime = slotParts[2];

    // Find available doctor
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
        message: 'No doctor available for this slot'
      });
    }

    // Check slot availability again
    const existingCount = await prisma.consultation.count({
      where: {
        doctorId: availableDoctor.id,
        type: 'CHAT_DOCTOR',
        createdAt: {
          gte: new Date(new Date(scheduledTime).getTime() - 30 * 60 * 1000),
          lte: new Date(new Date(scheduledTime).getTime() + 30 * 60 * 1000)
        }
      }
    });

    if (existingCount >= 10) {
      return res.status(400).json({
        success: false,
        message: 'This slot is no longer available'
      });
    }

    const consultationFee = 15000;

    // Create chat consultation
    const consultation = await prisma.consultation.create({
      data: {
        userId,
        doctorId: availableDoctor.id,
        type: 'CHAT_DOCTOR',
        severity: 'MEDIUM',
        urgency: 'NORMAL',
        symptoms: notes ? [notes] : ['Chat consultation scheduled'],
        chatHistory: [
          {
            id: `initial_${Date.now()}`,
            text: `Konsultasi chat dijadwalkan untuk ${new Date(scheduledTime).toLocaleDateString('id-ID')} jam ${slotTime}. ${notes ? `Catatan: ${notes}` : ''}`,
            isUser: false,
            timestamp: new Date().toISOString()
          }
        ],
        consultationFee,
        paymentStatus: 'PENDING',
        isPaid: false
      }
    });

    // ✅ NEW: Create transaction for consultation fee
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'CONSULTATION_PAYMENT',
        status: 'PAID', // For MVP, assume immediate payment
        amount: consultationFee,
        paymentMethod: paymentMethod.toUpperCase(),
        description: `Chat consultation fee with Dr. ${availableDoctor.name}`,
        consultationId: consultation.id,
        paidAt: new Date()
      }
    });

    // Update consultation as paid
    await prisma.consultation.update({
      where: { id: consultation.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paymentStatus: 'PAID'
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Jadwal Konsultasi Chat Dibuat',
        message: `Konsultasi chat dengan ${availableDoctor.name} berhasil dijadwalkan pada ${new Date(scheduledTime).toLocaleDateString('id-ID')} jam ${slotTime}`,
        type: 'CONSULTATION',
        priority: 'MEDIUM'
      }
    });

    // Prepare response data
    const chatConsultation = {
      id: consultation.id,
      doctorName: availableDoctor.name,
      specialty: availableDoctor.specialty,
      scheduledTime,
      status: 'waiting',
      queuePosition: existingCount + 1,
      estimatedWaitMinutes: (existingCount + 1) * 15,
      messages: consultation.chatHistory || [],
      hasUnreadMessages: false,
      lastMessageTime: null,
      // ✅ ADD: Payment info
      paymentInfo: {
        transactionId: transaction.id,
        amount: consultationFee,
        paymentMethod,
        paidAt: transaction.paidAt,
        status: 'PAID'
      }
    };

    console.log('✅ Chat consultation booked:', consultation.id);

    res.json({
      success: true,
      message: 'Chat consultation booked successfully',
      data: { consultation: chatConsultation }
    });

  } catch (error) {
    console.error('❌ Book chat consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book chat consultation',
      error: error.message
    });
  }
};

const getChatConsultations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('💬 Getting chat consultations for user:', userId);
    
    // Query consultations yang berbasis chat dengan dokter UNTUK USER INI
    const consultations = await prisma.consultation.findMany({
      where: {
        userId: userId,
        type: 'CHAT_DOCTOR',
        OR: [
          { isPaid: true },
          { paymentStatus: 'PAID' }
        ]
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            consultationFee: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedConsultations = consultations.map(consultation => {
      // Fix: Proper status determination
      let status = 'WAITING';
      
      if (consultation.isCompleted) {
        status = 'COMPLETED';
      } else if (consultation.isPaid && consultation.paymentStatus === 'PAID') {
        status = 'IN_PROGRESS';
      }

      // Parse chat history safely
      let messages = [];
      try {
        messages = Array.isArray(consultation.chatHistory) ? consultation.chatHistory : [];
      } catch (e) {
        console.log('Error parsing chat history:', e);
        messages = [];
      }

      return {
        id: consultation.id,
        doctorName: consultation.doctor?.name || 'Unknown Doctor',
        specialty: consultation.doctor?.specialty || 'General',
        scheduledTime: consultation.createdAt,
        status: status,
        isCompleted: consultation.isCompleted, // Add this field
        queuePosition: 1,
        estimatedWaitMinutes: status === 'IN_PROGRESS' ? 30 : 120,
        messages: messages.map((msg, index) => ({
          id: msg.id || `msg_${index}`,
          text: msg.text || '',
          isUser: msg.isUser || false,
          timestamp: msg.timestamp || consultation.createdAt,
          isRead: true
        })),
        hasUnreadMessages: false,
        lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
        consultationFee: consultation.consultationFee || consultation.doctor?.consultationFee || 25000,
        isPaid: consultation.isPaid,
        paymentStatus: consultation.paymentStatus
      };
    });

    console.log('✅ Found chat consultations:', formattedConsultations.length);

    res.json({
      success: true,
      data: { consultations: formattedConsultations }
    });

  } catch (error) {
    console.error('❌ Get chat consultations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat consultations',
      error: error.message
    });
  }
};

const sendChatMessage = async (req, res) => {
  try {
    const { consultationId, message } = req.body;
    const userId = req.user.id; // Fix: use userId instead of destructured userId

    console.log('📤 Sending chat message:', { consultationId, userId, message: message.substring(0, 50) + '...' });

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { 
        doctor: { 
          select: { 
            id: true, 
            name: true, 
            userId: true 
          } 
        }, 
        user: true 
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check authorization
    const isPatient = consultation.userId === userId;
    const isDoctor = consultation.doctorId && 
                    req.user.role === 'DOCTOR' && 
                    consultation.doctor?.userId === userId;

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send message to this consultation'
      });
    }

    // Create new message
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      text: message.trim(),
      isUser: isPatient, // true if patient, false if doctor
      timestamp: new Date().toISOString(),
      isRead: true
    };

    // Update chat history
    const currentHistory = consultation.chatHistory || [];
    const updatedHistory = [...currentHistory, newMessage];

    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        chatHistory: updatedHistory,
        updatedAt: new Date()
      }
    });

    // Create notification for the other party
    if (isPatient && consultation.doctorId) {
      // Patient sent message, notify doctor
      await prisma.notification.create({
        data: {
          userId: consultation.doctor.userId,
          title: 'Pesan Baru dari Pasien',
          message: `Pesan baru dari ${consultation.user.fullName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
          type: 'CONSULTATION',
          priority: 'MEDIUM',
          relatedData: {
            consultationId,
            messageId: newMessage.id
          }
        }
      });
    } else if (isDoctor) {
      // Doctor sent message, notify patient
      await prisma.notification.create({
        data: {
          userId: consultation.userId,
          title: 'Pesan Baru dari Dokter',
          message: `Dr. ${consultation.doctor.name}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
          type: 'CONSULTATION',
          priority: 'HIGH',
          relatedData: {
            consultationId,
            messageId: newMessage.id
          }
        }
      });
    }

    console.log('✅ Message sent successfully:', newMessage.id);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { 
        message: newMessage,
        consultation: {
          id: consultation.id,
          totalMessages: updatedHistory.length,
          lastActivity: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Send chat message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

const getChatMessages = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    console.log('💬 Getting chat messages:', { consultationId, userId });

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Fix: Allow access if user owns the consultation OR is the assigned doctor
    const isAuthorized = consultation.userId === userId || 
                        (consultation.doctorId && req.user.role === 'DOCTOR' && consultation.doctor?.userId === userId);

    if (!isAuthorized) {
      console.log('❌ Authorization failed:', { 
        consultationUserId: consultation.userId, 
        requestUserId: userId,
        userRole: req.user.role 
      });
      
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this consultation'
      });
    }

    const messages = consultation.chatHistory || [];

    console.log('✅ Chat messages retrieved:', messages.length);

    res.json({
      success: true,
      message: 'Chat messages retrieved',
      data: { messages }
    });

  } catch (error) {
    console.error('❌ Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat messages',
      error: error.message
    });
  }
};

// Accept early consultation slot (Doctor or User)
const acceptEarlyConsultation = async (req, res) => {
  try {
    const { consultationId } = req.body;
    const { userId } = req.user;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation || consultation.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Update consultation to indicate early acceptance
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        urgency: 'URGENT',
        updatedAt: new Date()
      }
    });

    // Add system message to chat
    const systemMessage = {
      id: `system_${Date.now()}`,
      text: 'Anda telah menerima slot konsultasi lebih awal. Dokter akan segera merespons.',
      isUser: false,
      timestamp: new Date().toISOString(),
      isRead: true
    };

    const currentHistory = consultation.chatHistory || [];
    const updatedHistory = [...currentHistory, systemMessage];

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { chatHistory: updatedHistory }
    });

    res.json({
      success: true,
      message: 'Early consultation accepted'
    });

  } catch (error) {
    console.error('Accept early consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept early consultation',
      error: error.message
    });
  }
};

const cancelConsultation = async (req, res) => {
  try {
    const { consultationId } = req.body;
    const { userId } = req.user;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation || consultation.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    if (consultation.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed consultation'
      });
    }

    // Update consultation status
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        recommendation: 'CANCELLED',
        doctorNotes: 'Consultation cancelled by patient',
        isCompleted: true,
        paymentStatus: 'PAID' // Refund in real implementation
      }
    });

    res.json({
      success: true,
      message: 'Consultation cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel consultation',
      error: error.message
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

const getUpcomingConsultations = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    console.log('📅 Getting upcoming consultations for user:', userId);
    
    // Fix: Gunakan field yang tersedia di schema
    const consultations = await prisma.consultation.findMany({
      where: {
        userId,
        isCompleted: false,
        OR: [
          {
            // Follow-up consultations yang dijadwalkan di masa depan
            AND: [
              { followUpDate: { gt: now } },
              { 
                OR: [
                  { recommendation: { not: 'CANCELLED' } },
                  { recommendation: null }
                ]
              }
            ]
          },
          {
            // Consultations yang masih pending tapi dibuat kemarin/lusa
            AND: [
              { createdAt: { lt: new Date(now.setHours(0, 0, 0, 0)) } },
              { isCompleted: false },
              { 
                OR: [
                  { recommendation: null },
                  { recommendation: 'APPOINTMENT_NEEDED' }
                ]
              }
            ]
          }
        ]
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            consultationFee: true
          }
        }
      },
      orderBy: [
        { followUpDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const formattedConsultations = consultations.map(consultation => ({
      id: consultation.id,
      type: consultation.type || 'AI',
      status: _getConsultationStatus(consultation),
      scheduledTime: consultation.followUpDate || consultation.createdAt,
      doctor: consultation.doctor ? {
        id: consultation.doctor.id,
        name: consultation.doctor.name,
        specialty: consultation.doctor.specialty,
        hospital: 'RS Mitra Keluarga'
      } : null,
      symptoms: consultation.symptoms || [],
      queueNumber: null,
      estimatedWaitMinutes: 15,
      isUrgent: consultation.urgency === 'HIGH' || consultation.urgency === 'URGENT',
      notes: consultation.doctorNotes
    }));

    console.log('✅ Found upcoming consultations:', formattedConsultations.length);

    res.json({
      success: true,
      data: { consultations: formattedConsultations }
    });

  } catch (error) {
    console.error('❌ Get upcoming consultations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming consultations',
      error: error.message
    });
  }
};
function _getConsultationStatus(consultation) {
  if (consultation.isCompleted) {
    return consultation.recommendation === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED';
  }
  
  if (consultation.recommendation === 'APPOINTMENT_NEEDED') {
    return 'SCHEDULED';
  }
  
  if (consultation.type === 'CHAT_DOCTOR') {
    const hasMessages = consultation.chatHistory && 
      Array.isArray(consultation.chatHistory) && 
      consultation.chatHistory.length > 0;
    return hasMessages ? 'IN_PROGRESS' : 'WAITING';
  }
  
  return 'WAITING';
}

const getActiveConsultations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📅 Getting active consultations for user:', userId);
    
    // Fix: Gunakan field yang ada di schema - createdAt, followUpDate, dll
    const consultations = await prisma.consultation.findMany({
      where: {
        userId,
        isCompleted: false,
        OR: [
          { 
            // Consultation yang baru dibuat hari ini dan belum selesai
            AND: [
              { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
              { 
                OR: [
                  { recommendation: null },
                  { recommendation: { not: 'CANCELLED' } }
                ]
              }
            ]
          },
          {
            // Follow-up consultations yang scheduled untuk hari ini/besok
            AND: [
              { followUpDate: { 
                gte: new Date(),
                lte: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Next 2 days
              }},
              { recommendation: { not: 'CANCELLED' } }
            ]
          }
        ]
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            consultationFee: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedConsultations = consultations.map(consultation => ({
      id: consultation.id,
      type: consultation.type || 'AI',
      status: _getConsultationStatus(consultation),
      scheduledTime: consultation.followUpDate || consultation.createdAt, // Use available fields
      doctor: consultation.doctor ? {
        id: consultation.doctor.id,
        name: consultation.doctor.name,
        specialty: consultation.doctor.specialty,
        hospital: 'RS Mitra Keluarga'
      } : null,
      symptoms: consultation.symptoms || [],
      queueNumber: null, // Will be populated from queue if exists
      position: null,
      estimatedWaitMinutes: 15,
      isUrgent: consultation.urgency === 'HIGH' || consultation.urgency === 'URGENT',
      notes: consultation.doctorNotes
    }));

    console.log('✅ Found active consultations:', formattedConsultations.length);

    res.json({
      success: true,
      data: { consultations: formattedConsultations }
    });

  } catch (error) {
    console.error('❌ Get active consultations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active consultations',
      error: error.message
    });
  }
};


const rescheduleConsultation = async (req, res) => {
  try {
    const { consultationId, newScheduledTime } = req.body;
    const userId = req.user.id;

    console.log('🔄 Rescheduling consultation:', { consultationId, newScheduledTime, userId });

    // Find the consultation
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        userId,
        isCompleted: false
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found or already completed'
      });
    }

    // Check if consultation can be rescheduled
    if (consultation.type === 'AI') {
      return res.status(400).json({
        success: false,
        message: 'AI consultations cannot be rescheduled'
      });
    }

    const newTime = new Date(newScheduledTime);
    const now = new Date();

    // Validate new scheduled time
    if (newTime <= now) {
      return res.status(400).json({
        success: false,
        message: 'New scheduled time must be in the future'
      });
    }

    // Update consultation - use followUpDate instead of scheduledTime
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        followUpDate: newTime, // Use existing field
        updatedAt: new Date()
      }
    });

    // Update related appointment if exists
    const relatedAppointment = await prisma.appointment.findFirst({
      where: { consultationId }
    });

    if (relatedAppointment) {
      const appointmentDate = new Date(newTime);
      appointmentDate.setHours(0, 0, 0, 0);
      
      const startTime = new Date(newTime);
      const endTime = new Date(newTime.getTime() + 30 * 60 * 1000);

      await prisma.appointment.update({
        where: { id: relatedAppointment.id },
        data: {
          appointmentDate,
          startTime,
          endTime,
          updatedAt: new Date()
        }
      });
    }

    // Add reschedule message to chat history
    if (consultation.type === 'CHAT_DOCTOR') {
      const rescheduleMessage = {
        id: `reschedule_${Date.now()}`,
        text: `Konsultasi telah dijadwal ulang ke ${newTime.toLocaleDateString('id-ID')} ${newTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        isUser: false,
        timestamp: new Date().toISOString(),
        isRead: true,
        isSystem: true
      };

      const currentHistory = consultation.chatHistory || [];
      const updatedHistory = [...currentHistory, rescheduleMessage];

      await prisma.consultation.update({
        where: { id: consultationId },
        data: { chatHistory: updatedHistory }
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Jadwal Konsultasi Diubah',
        message: `Jadwal konsultasi dengan ${consultation.doctor?.name || 'dokter'} telah diubah ke ${newTime.toLocaleDateString('id-ID')} ${newTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        type: 'CONSULTATION',
        priority: 'MEDIUM'
      }
    });

    console.log('✅ Consultation rescheduled successfully:', consultationId);

    res.json({
      success: true,
      message: 'Consultation rescheduled successfully',
      data: {
        consultationId: updatedConsultation.id,
        oldScheduledTime: consultation.followUpDate?.toISOString(),
        newScheduledTime: newTime.toISOString(),
        doctorName: consultation.doctor?.name,
        type: consultation.type
      }
    });

  } catch (error) {
    console.error('❌ Reschedule consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule consultation',
      error: error.message
    });
  }
};

// Helper function to get estimated response time based on urgency
function _getEstimatedResponseTime(urgency) {
  switch (urgency) {
    case 'HIGH':
    case 'URGENT':
      return 'Max 1 jam';
    case 'MEDIUM':
    case 'NORMAL':
      return '2-4 jam';
    case 'LOW':
      return '4-8 jam';
    default:
      return '2-4 jam';
  }
}

// Helper function that should already exist (if not, add it)
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

// NEW: Get Available Doctors (General Practitioners)
const getAvailableDoctors = async (req, res) => {
  try {
    // Query dengan field yang lebih spesifik
    const doctors = await prisma.doctor.findMany({
      where: {
        isAvailable: true,
        user: { isActive: true },
        OR: [
          { specialty: { contains: 'Umum' } },
          { specialty: { contains: 'umum' } },
          { specialty: { contains: 'General' } },
          { specialty: { contains: 'general' } }
        ]
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        consultationFee: true,
        isAvailable: true,
        isOnDuty: true,
        bio: true,
        user: {
          select: {
            fullName: true,
            profilePicture: true
          }
        }
      },
      orderBy: [
        { isOnDuty: 'desc' },
        { consultationFee: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('Raw doctors from DB:', doctors);

    const formattedDoctors = doctors.map(doctor => {
      // Ensure fee is not null or 0
      const fee = doctor.consultationFee || 25000;
      
      console.log(`Doctor ${doctor.name}: original fee = ${doctor.consultationFee}, formatted fee = ${fee}`);
      
      return {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        hospital: 'RS Mitra Keluarga',
        rating: 4.5 + Math.random() * 0.5,
        experience: `${Math.floor(Math.random() * 10) + 5} tahun pengalaman`,
        photoUrl: doctor.user?.profilePicture,
        consultationFee: fee,
        isAvailable: doctor.isAvailable && doctor.isOnDuty,
        description: doctor.bio || `Dokter ${doctor.specialty} berpengalaman`
      };
    });

    console.log('Formatted doctors response:', formattedDoctors);

    res.json({
      success: true,
      message: 'Available doctors retrieved',
      data: { doctors: formattedDoctors }
    });

  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available doctors',
      error: error.message
    });
  }
};

const startDirectConsultation = async (req, res) => {
  try {
    const { userId, doctorId, symptoms, notes } = req.body;

    console.log('Starting direct consultation:', { userId, doctorId, symptoms });

    const doctor = await prisma.doctor.findFirst({
      where: {
        id: doctorId,
        isAvailable: true,
        user: { isActive: true }
      },
      include: {
        user: { select: { fullName: true } }
      }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not available'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingConsultation = await prisma.consultation.findFirst({
      where: {
        userId,
        doctorId,
        createdAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        isCompleted: false
      }
    });

    if (existingConsultation) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active consultation with this doctor today'
      });
    }

    const consultationFee = doctor.consultationFee || 25000;

    // Create consultation with auto-paid status
    const consultation = await prisma.consultation.create({
      data: {
        userId,
        doctorId,
        type: 'CHAT_DOCTOR',
        severity: 'MEDIUM',
        urgency: 'NORMAL',
        symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
        chatHistory: [
          {
            id: `initial_${Date.now()}`,
            text: `Konsultasi langsung dimulai. Gejala: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}${notes ? `. Catatan: ${notes}` : ''}`,
            isUser: false,
            timestamp: new Date().toISOString()
          }
        ],
        consultationFee,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        isPaid: true,
        paidAt: new Date()
      }
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'CONSULTATION_PAYMENT',
        status: 'PAID',
        amount: consultationFee,
        paymentMethod: 'CASH',
        description: `Direct consultation with ${doctor.name}`,
        consultationId: consultation.id,
        paidAt: new Date()
      }
    });

    const queueNumber = await generateQueueNumber(today);
    const position = await getQueuePosition(today);

    await prisma.queue.create({
      data: {
        userId,
        doctorId,
        consultationId: consultation.id,
        queueNumber,
        queueType: 'DIRECT_CONSULTATION',
        position,
        queueDate: today,
        checkInTime: new Date(),
        estimatedWaitTime: position * 15,
        notes: `Direct consultation: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}`
      }
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'Konsultasi Langsung Berhasil',
        message: `Konsultasi dengan ${doctor.name} telah dimulai. Chat sudah siap dan dokter akan merespons dalam 1-4 jam.`,
        type: 'CONSULTATION',
        priority: 'MEDIUM'
      }
    });

    const result = {
      consultationId: consultation.id,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        hospital: 'RS Mitra Keluarga',
        consultationFee,
        photoUrl: doctor.user?.profilePicture
      },
      consultationFee,
      queueNumber,
      position,
      estimatedWaitMinutes: position * 15,
      status: 'PAID',
      scheduledTime: new Date().toISOString(),
      paymentStatus: 'PAID',
      isPaid: true,
      paidAt: new Date().toISOString()
    };

    console.log('✅ Direct consultation created and auto-paid:', consultation.id);

    res.json({
      success: true,
      message: 'Direct consultation started successfully',
      data: result
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

// Update the module.exports section at the end:
module.exports = {
  aiScreening,
  requestDoctorChat,
  completeDoctorChat,
  bookAppointmentFromConsultation,
  takeDirectQueue,
  getConsultationHistory,
  testAIConnection,
  
  // New chat consultation exports
  getAvailableTimeSlots,
  bookChatConsultation,
  getChatConsultations,
  sendChatMessage,
  getChatMessages,
  acceptEarlyConsultation,
  cancelConsultation,
  getUpcomingConsultations,
  getActiveConsultations,
  rescheduleConsultation,
  continueAIConsultation,
  markConsultationCompleted,
  getConsultationDetails,
  
  // NEW exports - now defined above
  getAvailableDoctors,
  startDirectConsultation,
  
  // Backward compatibility
  requestDoctorConsultation: requestDoctorChat,
  completeDoctorConsultation: completeDoctorChat,
  bookAppointment: bookAppointmentFromConsultation
};