const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper functions (standalone untuk menghindari context issues)
const calculateResponseTime = (lastUpdate) => {
  try {
    const now = new Date();
    const lastActivity = new Date(lastUpdate);
    return Math.floor((now - lastActivity) / (1000 * 60)); // minutes
  } catch (error) {
    console.error('Error calculating response time:', error);
    return 0;
  }
};

const getResponseStatus = (minutes) => {
  if (minutes > 240) return 'overdue'; // > 4 hours
  if (minutes > 120) return 'urgent';  // > 2 hours
  if (minutes > 60) return 'warning';  // > 1 hour
  return 'normal';
};

const formatTimeAgo = (date) => {
  try {
    const now = new Date();
    const inputDate = new Date(date);
    const diffMs = now - inputDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    return `${diffDays} hari yang lalu`;
  } catch (error) {
    console.error('Error formatting time ago:', error);
    return 'Waktu tidak valid';
  }
};

const calculateAge = (birthDate) => {
  try {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (error) {
    console.error('Error calculating age:', error);
    return null;
  }
};

// Map severity to urgency - HIGH = EMERGENCY, MEDIUM = URGENT, LOW = NORMAL
const mapSeverityToUrgency = (severity) => {
  const mapping = {
    'HIGH': 'EMERGENCY',    // High severity = Emergency
    'MEDIUM': 'URGENT',     // Medium severity = Urgent  
    'LOW': 'NORMAL'         // Low severity = Normal
  };
  return mapping[severity] || 'NORMAL';
};

const getDisplayUrgency = (consultation) => {
  // Priority order: explicit urgency > mapped from severity > mapped from AI analysis > default
  if (consultation.urgency && ['EMERGENCY', 'URGENT', 'NORMAL'].includes(consultation.urgency)) {
    return consultation.urgency;
  }
  
  // Check direct severity field
  if (consultation.severity) {
    return mapSeverityToUrgency(consultation.severity);
  }
  
  // Check AI analysis for severity
  if (consultation.aiAnalysis?.severity) {
    return mapSeverityToUrgency(consultation.aiAnalysis.severity);
  }
  
  return 'NORMAL';
};

const formatDecision = (decision) => {
  const decisions = {
    'PRESCRIPTION_ONLY': 'Resep Obat',
    'APPOINTMENT_NEEDED': 'Perlu Appointment',
    'SPECIALIST_REFERRAL': 'Rujukan Spesialis',
    'SELF_CARE': 'Perawatan Mandiri',
    'EMERGENCY_REFERRAL': 'Rujukan Emergency'
  };
  return decisions[decision] || decision;
};

const getDecisionMessage = (decision) => {
  const messages = {
    'PRESCRIPTION_ONLY': 'Resep digital sudah tersedia.',
    'APPOINTMENT_NEEDED': 'Silakan buat appointment untuk pemeriksaan lanjutan.',
    'SPECIALIST_REFERRAL': 'Anda dirujuk ke dokter spesialis.',
    'SELF_CARE': 'Ikuti instruksi perawatan mandiri yang diberikan.',
    'EMERGENCY_REFERRAL': 'Segera datang ke rumah sakit.'
  };
  return messages[decision] || 'Silakan baca hasil konsultasi lengkap.';
};

// Main controller functions
const getActiveChatSessions = async (req, res) => {
  try {
    console.log('=== Get Active Chat Sessions ===');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    console.log('Current Doctor:', currentDoctor);

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    // ✅ SIMPLIFIED QUERY - Less restrictive filters
    console.log('🔍 Searching consultations for doctor:', currentDoctor.id);
    
    // First, check ALL consultations for this doctor
    const allConsultations = await prisma.consultation.findMany({
      where: {
        doctorId: currentDoctor.id
      },
      select: {
        id: true,
        type: true,
        isCompleted: true,
        isPaid: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('📊 All consultations for doctor:', {
      total: allConsultations.length,
      byType: allConsultations.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {}),
      byCompleted: allConsultations.reduce((acc, c) => {
        acc[c.isCompleted ? 'completed' : 'active'] = (acc[c.isCompleted ? 'completed' : 'active'] || 0) + 1;
        return acc;
      }, {}),
      byPayment: allConsultations.reduce((acc, c) => {
        acc[c.paymentStatus || 'unknown'] = (acc[c.paymentStatus || 'unknown'] || 0) + 1;
        return acc;
      }, {})
    });

    // ✅ SIMPLIFIED ACTIVE SESSIONS QUERY
    const activeSessions = await prisma.consultation.findMany({
      where: {
        doctorId: currentDoctor.id,
        // ✅ Only essential filters
        isCompleted: false,
        // ✅ Accept multiple chat types
        type: {
          in: ['CHAT_DOCTOR', 'DOCTOR_CHAT', 'CONSULTATION'] // More flexible
        }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
            nik: true,
            gender: true,
            dateOfBirth: true,
            phone: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log('📋 Active sessions found:', {
      count: activeSessions.length,
      consultations: activeSessions.map(s => ({
        id: s.id,
        type: s.type,
        isCompleted: s.isCompleted,
        isPaid: s.isPaid,
        paymentStatus: s.paymentStatus,
        hasUser: !!s.user,
        userName: s.user?.fullName,
        createdAt: s.createdAt,
        chatHistoryLength: Array.isArray(s.chatHistory) ? s.chatHistory.length : 0
      }))
    });

    if (activeSessions.length === 0) {
      return res.json({
        success: true,
        message: 'No active chat sessions found',
        data: {
          sessions: [],
          totalActive: 0,
          summary: {
            emergency: 0,
            urgent: 0,
            normal: 0,
            needsResponse: 0
          },
          doctorInfo: {
            specialty: currentDoctor.specialty,
            consultationType: 'CHAT_DOCTOR'
          },
          debug: {
            totalConsultations: allConsultations.length,
            doctorId: currentDoctor.id
          }
        }
      });
    }

    // Process sessions
    const processedSessions = activeSessions.map(session => {
      try {
        console.log('🔄 Processing session:', session.id);
        
        // Parse chat history safely
        let chatHistory = [];
        try {
          chatHistory = Array.isArray(session.chatHistory) ? session.chatHistory : [];
        } catch (e) {
          console.log('Warning: Could not parse chat history for session:', session.id);
          chatHistory = [];
        }

        // Get last message
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
        
        // Calculate response time
        const timeToRespond = calculateResponseTime(session.updatedAt);
        
        // Get urgency with fallback
        const displayUrgency = getDisplayUrgency(session);
        
        // Calculate patient age
        const patientAge = session.user.dateOfBirth ? 
          calculateAge(new Date(session.user.dateOfBirth)) : null;

        return {
          consultationId: session.id,
          patient: {
            id: session.user.id,
            fullName: session.user.fullName,
            profilePicture: session.user.profilePicture,
            nik: session.user.nik,
            gender: session.user.gender,
            age: patientAge,
            phone: session.user.phone
          },
          severity: session.severity || 'MEDIUM',
          urgency: displayUrgency,
          symptoms: session.symptoms || [],
          aiAnalysis: session.aiAnalysis || {},
          lastMessage: lastMessage ? {
            content: lastMessage.text || lastMessage.message || '',
            sender: lastMessage.isUser ? 'PATIENT' : 'DOCTOR',
            timestamp: lastMessage.timestamp,
            timeAgo: formatTimeAgo(new Date(lastMessage.timestamp))
          } : null,
          responseStatus: getResponseStatus(timeToRespond),
          timeToRespond: timeToRespond,
          startedAt: session.createdAt,
          lastActivity: session.updatedAt,
          // ✅ Add debugging info
          debug: {
            type: session.type,
            isCompleted: session.isCompleted,
            isPaid: session.isPaid,
            paymentStatus: session.paymentStatus,
            chatHistoryLength: chatHistory.length
          }
        };
      } catch (sessionError) {
        console.error('Error processing session:', sessionError);
        return null;
      }
    }).filter(session => session !== null);

    // Sort by urgency and response time
    processedSessions.sort((a, b) => {
      const urgencyPriority = { 'EMERGENCY': 3, 'URGENT': 2, 'NORMAL': 1 };
      const aPriority = urgencyPriority[a.urgency] || 1;
      const bPriority = urgencyPriority[b.urgency] || 1;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.timeToRespond - a.timeToRespond;
    });

    const summary = {
      emergency: processedSessions.filter(s => s.urgency === 'EMERGENCY').length,
      urgent: processedSessions.filter(s => s.urgency === 'URGENT').length,
      normal: processedSessions.filter(s => s.urgency === 'NORMAL').length,
      needsResponse: processedSessions.filter(s => s.responseStatus === 'overdue').length
    };

    console.log('✅ Final result:', {
      processedCount: processedSessions.length,
      summary
    });

    res.json({
      success: true,
      message: 'Active chat sessions retrieved',
      data: {
        sessions: processedSessions,
        totalActive: processedSessions.length,
        summary,
        doctorInfo: {
          specialty: currentDoctor.specialty,
          consultationType: 'CHAT_DOCTOR'
        }
      }
    });

  } catch (error) {
    console.error('Get active chat sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat sesi chat aktif',
      error: error.message
    });
  }
};

const getChatConversation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    console.log('=== Get Chat Conversation ===');
    console.log('Consultation ID:', consultationId);
    console.log('User ID:', req.user?.id);
    console.log('User Role:', req.user?.role);
    
    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    console.log('🩺 Current Doctor Found:', {
      found: !!currentDoctor,
      id: currentDoctor?.id,
      name: currentDoctor?.name,
      specialty: currentDoctor?.specialty
    });

    if (!currentDoctor) {
      console.log('❌ Doctor not found for user:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    console.log('🔍 Searching consultation with params:', {
      consultationId,
      doctorId: currentDoctor.id
    });

    // ✅ SIMPLIFIED QUERY - Remove type restriction to debug
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        doctorId: currentDoctor.id
        // ✅ Remove type filter temporarily to see if consultation exists
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
            nik: true,
            gender: true,
            dateOfBirth: true,
            phone: true
          }
        }
      }
    });

    console.log('📋 Consultation Query Result:', {
      found: !!consultation,
      id: consultation?.id,
      type: consultation?.type,
      isCompleted: consultation?.isCompleted,
      doctorId: consultation?.doctorId,
      patientName: consultation?.user?.fullName,
      createdAt: consultation?.createdAt
    });

    if (!consultation) {
      console.log('❌ Consultation not found with params:', {
        consultationId,
        doctorId: currentDoctor.id
      });

      // ✅ DEBUG: Check if consultation exists for different doctor
      const consultationExists = await prisma.consultation.findFirst({
        where: { id: consultationId },
        select: { id: true, doctorId: true, type: true, isCompleted: true }
      });

      console.log('🔍 Debug - Consultation exists anywhere:', {
        exists: !!consultationExists,
        doctorId: consultationExists?.doctorId,
        expectedDoctorId: currentDoctor.id,
        type: consultationExists?.type,
        isCompleted: consultationExists?.isCompleted
      });

      return res.status(404).json({
        success: false,
        message: 'Konsultasi tidak ditemukan atau bukan milik dokter ini',
        debug: {
          consultationId,
          doctorId: currentDoctor.id,
          consultationExists: !!consultationExists,
          consultationDoctorId: consultationExists?.doctorId
        }
      });
    }

    console.log('✅ Consultation found, processing chat history...');

    // Format chat history from mobile format to web format
    let chatHistory = [];
    try {
      console.log('📝 Raw chat history type:', typeof consultation.chatHistory);
      console.log('📝 Raw chat history length:', consultation.chatHistory?.length);
      
      if (Array.isArray(consultation.chatHistory)) {
        chatHistory = consultation.chatHistory;
      } else if (consultation.chatHistory) {
        // Try to parse if it's a string
        chatHistory = JSON.parse(consultation.chatHistory);
      } else {
        chatHistory = [];
      }
      
      console.log('📝 Processed chat history length:', chatHistory.length);
    } catch (e) {
      console.error('❌ Error parsing chat history:', e);
      chatHistory = [];
    }

    // Format messages using standalone functions
    const formattedHistory = chatHistory.map((msg, index) => {
      try {
        return {
          id: msg.id || `msg_${index}_${Date.now()}`,
          sender: msg.isUser ? 'PATIENT' : 'DOCTOR',
          senderName: msg.isUser ? consultation.user.fullName : currentDoctor.name,
          message: msg.text || msg.message || '',
          type: msg.type || 'text',
          attachments: msg.attachments || [],
          timestamp: msg.timestamp || new Date().toISOString(),
          timeAgo: formatTimeAgo(new Date(msg.timestamp || new Date())),
          isFromDoctor: !msg.isUser,
          isRead: msg.isRead !== undefined ? msg.isRead : true
        };
      } catch (msgError) {
        console.error('❌ Error formatting message:', msgError);
        return {
          id: `error_msg_${index}`,
          sender: 'SYSTEM',
          senderName: 'System',
          message: 'Error loading message',
          type: 'text',
          attachments: [],
          timestamp: new Date().toISOString(),
          timeAgo: 'Unknown',
          isFromDoctor: false,
          isRead: true
        };
      }
    });

    console.log('💬 Formatted messages count:', formattedHistory.length);

    // Patient info with age calculation
    let patientAge = null;
    try {
      if (consultation.user.dateOfBirth) {
        patientAge = calculateAge(new Date(consultation.user.dateOfBirth));
      }
    } catch (ageError) {
      console.warn('⚠️ Error calculating age:', ageError);
    }

    // Get consistent urgency
    const displayUrgency = getDisplayUrgency(consultation);

    console.log('🎯 Final data prepared:', {
      patientName: consultation.user?.fullName,
      messagesCount: formattedHistory.length,
      urgency: displayUrgency,
      age: patientAge
    });

    const responseData = {
      consultationId: consultation.id,
      patient: {
        ...consultation.user,
        age: patientAge
      },
      chatInfo: {
        severity: consultation.severity || consultation.aiAnalysis?.severity || 'MEDIUM',
        urgency: displayUrgency,
        symptoms: consultation.symptoms || [],
        aiAnalysis: consultation.aiAnalysis || {},
        consultationFee: consultation.consultationFee || 0,
        startedAt: consultation.createdAt,
        lastActivity: consultation.updatedAt
      },
      messages: formattedHistory,
      doctorNotes: consultation.doctorNotes,
      recommendation: consultation.recommendation,
      isCompleted: consultation.isCompleted,
      doctorInfo: {
        specialty: currentDoctor.specialty,
        consultationType: consultation.type || 'CHAT_DOCTOR'
      }
    };

    console.log('✅ Sending response with data keys:', Object.keys(responseData));

    res.json({
      success: true,
      message: 'Chat conversation retrieved',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Get chat conversation error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Send error response
    res.status(500).json({
      success: false,
      message: 'Gagal memuat percakapan chat',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { message, type = 'text', attachments = [] } = req.body;

    console.log('📤 Doctor sending message:', {
      consultationId,
      messageLength: message?.length || 0,
      type,
      attachmentsCount: attachments.length
    });

    if (!message && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pesan atau lampiran harus diisi'
      });
    }

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        doctorId: currentDoctor.id,
        isCompleted: false
      },
      include: {
        user: { select: { id: true, fullName: true } }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Konsultasi tidak ditemukan atau sudah selesai'
      });
    }

    // Create message in mobile format
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      text: message || '',
      isUser: false, // Doctor message
      timestamp: new Date().toISOString(),
      isRead: false,
      type,
      attachments
    };

    // Update chat history (mobile format)
    const currentHistory = consultation.chatHistory || [];
    const updatedHistory = [...currentHistory, newMessage];

    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        chatHistory: updatedHistory,
        updatedAt: new Date()
      }
    });

    console.log('✅ Message saved to database');

    // Create notification for patient
    try {
      await prisma.notification.create({
        data: {
          userId: consultation.userId,
          title: 'Pesan Baru dari Dokter',
          message: `Dr. ${currentDoctor.name}: ${message ? message.substring(0, 100) : 'Mengirim lampiran'}${message && message.length > 100 ? '...' : ''}`,
          type: 'CONSULTATION',
          priority: consultation.urgency === 'EMERGENCY' ? 'HIGH' : 'MEDIUM',
          actionUrl: `/consultation/chat/${consultationId}`,
          relatedData: {
            consultationId,
            messageId: newMessage.id
          }
        }
      });
      console.log('✅ Notification created for patient');
    } catch (notifError) {
      console.warn('⚠️ Failed to create notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Return message in web format
    const webFormatMessage = {
      id: newMessage.id,
      sender: 'DOCTOR',
      senderName: currentDoctor.name,
      message: newMessage.text,
      type: newMessage.type,
      attachments: newMessage.attachments,
      timestamp: newMessage.timestamp,
      timeAgo: 'Baru saja',
      isFromDoctor: true,
      isRead: newMessage.isRead
    };

    res.json({
      success: true,
      message: 'Pesan berhasil dikirim',
      data: {
        message: webFormatMessage
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengirim pesan',
      error: error.message
    });
  }
};


const completeChatConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { 
      diagnosis,
      treatment,
      prescriptions = [],
      followUpDays = null,
      doctorNotes = '',
      decision = 'PRESCRIPTION_ONLY'
    } = req.body;

    console.log('🏁 Completing chat consultation:', {
      consultationId,
      diagnosis: diagnosis?.substring(0, 50) + '...',
      treatment: treatment?.substring(0, 50) + '...',
      prescriptionsCount: Array.isArray(prescriptions) ? prescriptions.length : 0,
      decision
    });

    // Enhanced validation
    if (!diagnosis || typeof diagnosis !== 'string' || diagnosis.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Diagnosis harus diisi minimal 10 karakter',
        field: 'diagnosis'
      });
    }

    if (!treatment || typeof treatment !== 'string' || treatment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Treatment harus diisi minimal 10 karakter',
        field: 'treatment'
      });
    }

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        doctorId: currentDoctor.id
      },
      include: {
        user: { 
          select: { 
            id: true, 
            fullName: true, 
            nik: true,
            phone: true 
          } 
        },
        medicalRecord: true // Include existing medical record
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Konsultasi tidak ditemukan'
      });
    }

    if (consultation.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Konsultasi sudah diselesaikan sebelumnya'
      });
    }

    // Calculate follow-up date
    const followUpDate = followUpDays ? 
      new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000) : null;

    // **FIX: Handle existing medical record**
    let medicalRecord;
    if (consultation.medicalRecord) {
      // Update existing medical record
      console.log('🔄 Updating existing medical record:', consultation.medicalRecord.id);
      medicalRecord = await prisma.medicalRecord.update({
        where: { id: consultation.medicalRecord.id },
        data: {
          diagnosis: diagnosis.trim(),
          treatment: treatment.trim(),
          symptoms: consultation.symptoms || [],
          notes: doctorNotes.trim(),
          followUpDate,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new medical record
      console.log('📝 Creating new medical record');
      medicalRecord = await prisma.medicalRecord.create({
        data: {
          userId: consultation.userId,
          doctorId: currentDoctor.id,
          consultationId: consultation.id,
          visitDate: new Date(),
          queueNumber: null,
          diagnosis: diagnosis.trim(),
          treatment: treatment.trim(),
          symptoms: consultation.symptoms || [],
          notes: doctorNotes.trim(),
          followUpDate,
          totalCost: consultation.consultationFee || 0,
          paymentStatus: 'PAID',
          paymentMethod: 'E_WALLET'
        }
      });
    }

    console.log('✅ Medical record processed:', medicalRecord.id);

    // **FIX: Handle prescriptions properly**
    let prescriptionRecord = null;
    let validatedMedications = [];

    if (Array.isArray(prescriptions) && prescriptions.length > 0) {
      // Check if prescription already exists for this consultation
      const existingPrescription = await prisma.prescription.findFirst({
        where: { consultationId: consultation.id }
      });

      if (existingPrescription) {
        console.log('🔄 Updating existing prescription:', existingPrescription.id);
        
        // Process medications
        let totalAmount = 0;
        for (const med of prescriptions) {
          if (med.medicationId) {
            const dbMed = await prisma.medication.findFirst({
              where: { id: med.medicationId, isActive: true }
            });
            
            if (dbMed) {
              const medicationData = {
                medicationId: dbMed.id,
                medicationCode: dbMed.medicationCode,
                genericName: dbMed.genericName,
                brandName: dbMed.brandName,
                dosageForm: dbMed.dosageForm,
                strength: dbMed.strength,
                unit: dbMed.unit,
                quantity: parseInt(med.quantity) || 1,
                pricePerUnit: parseFloat(dbMed.pricePerUnit),
                totalPrice: (parseInt(med.quantity) || 1) * parseFloat(dbMed.pricePerUnit),
                dosageInstructions: med.dosageInstructions || dbMed.dosageInstructions,
                frequency: med.frequency || '',
                duration: med.duration || '',
                notes: med.notes || ''
              };
              
              validatedMedications.push(medicationData);
              totalAmount += medicationData.totalPrice;
            }
          }
        }

        // Update existing prescription
        prescriptionRecord = await prisma.prescription.update({
          where: { id: existingPrescription.id },
          data: {
            medications: validatedMedications,
            instructions: `${diagnosis.trim()}\n\nTreatment: ${treatment.trim()}\n\nCatatan: ${doctorNotes.trim()}`,
            totalAmount,
            updatedAt: new Date()
          }
        });

      } else {
        console.log('📝 Creating new prescription');
        
        const prescriptionCode = `RX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        let totalAmount = 0;
        for (const med of prescriptions) {
          if (med.medicationId) {
            const dbMed = await prisma.medication.findFirst({
              where: { id: med.medicationId, isActive: true }
            });
            
            if (dbMed) {
              const medicationData = {
                medicationId: dbMed.id,
                medicationCode: dbMed.medicationCode,
                genericName: dbMed.genericName,
                brandName: dbMed.brandName,
                dosageForm: dbMed.dosageForm,
                strength: dbMed.strength,
                unit: dbMed.unit,
                quantity: parseInt(med.quantity) || 1,
                pricePerUnit: parseFloat(dbMed.pricePerUnit),
                totalPrice: (parseInt(med.quantity) || 1) * parseFloat(dbMed.pricePerUnit),
                dosageInstructions: med.dosageInstructions || dbMed.dosageInstructions,
                frequency: med.frequency || '',
                duration: med.duration || '',
                notes: med.notes || ''
              };
              
              validatedMedications.push(medicationData);
              totalAmount += medicationData.totalPrice;
            }
          }
        }

        if (validatedMedications.length > 0) {
          prescriptionRecord = await prisma.prescription.create({
            data: {
              userId: consultation.userId,
              doctorId: currentDoctor.id,
              consultationId: consultation.id,
              prescriptionCode,
              medications: validatedMedications,
              instructions: `${diagnosis.trim()}\n\nTreatment: ${treatment.trim()}\n\nCatatan: ${doctorNotes.trim()}`,
              totalAmount,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              paymentStatus: 'PENDING',
              paymentMethod: 'CASH'
            }
          });
        }
      }

      console.log('✅ Prescription processed:', prescriptionRecord?.prescriptionCode || 'Updated');
    }

    // Create completion message
    const completionMessage = {
      id: `msg_${Date.now()}_completion`,
      text: `✅ Konsultasi telah selesai.\n\n📋 Diagnosis: ${diagnosis.trim()}\n💊 Treatment: ${treatment.trim()}${prescriptionRecord ? `\n🧾 Resep Digital: ${prescriptionRecord.prescriptionCode || 'Diperbarui'} (${validatedMedications.length} obat)` : ''}${followUpDate ? `\n📅 Follow-up: ${followUpDate.toLocaleDateString('id-ID')}` : ''}`,
      isUser: false,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'completion'
    };

    // Update chat history
    const currentHistory = consultation.chatHistory || [];
    const updatedHistory = [...currentHistory, completionMessage];

    // Update consultation
    const completedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        isCompleted: true,
        recommendation: decision,
        doctorNotes: doctorNotes.trim(),
        prescriptions: validatedMedications.length > 0 ? validatedMedications : null,
        followUpDate,
        chatHistory: updatedHistory,
        updatedAt: new Date()
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: consultation.userId,
        title: '✅ Konsultasi Chat Selesai',
        message: `Konsultasi dengan Dr. ${currentDoctor.name} telah selesai. Medical record${prescriptionRecord ? ' dan resep digital' : ''} sudah tersedia.${prescriptionRecord ? ` Kode resep: ${prescriptionRecord.prescriptionCode || 'Diperbarui'}` : ''}`,
        type: 'CONSULTATION',
        priority: 'HIGH',
        actionUrl: `/medical-records/${medicalRecord.id}`,
        relatedData: {
          consultationId,
          medicalRecordId: medicalRecord.id,
          prescriptionId: prescriptionRecord?.id,
          prescriptionCode: prescriptionRecord?.prescriptionCode,
          medicationCount: validatedMedications.length
        }
      }
    });

    console.log('✅ Consultation completed successfully');

    res.json({
      success: true,
      message: 'Konsultasi berhasil diselesaikan',
      data: {
        consultationId: completedConsultation.id,
        medicalRecord: {
          id: medicalRecord.id,
          diagnosis: medicalRecord.diagnosis,
          treatment: medicalRecord.treatment,
          visitDate: medicalRecord.visitDate || medicalRecord.createdAt,
          followUpDate: medicalRecord.followUpDate
        },
        prescription: prescriptionRecord ? {
          id: prescriptionRecord.id,
          code: prescriptionRecord.prescriptionCode,
          medicationsCount: validatedMedications.length,
          totalAmount: prescriptionRecord.totalAmount,
          expiresAt: prescriptionRecord.expiresAt
        } : null,
        patient: {
          name: consultation.user.fullName,
          nik: consultation.user.nik
        },
        doctor: {
          name: currentDoctor.name,
          specialty: currentDoctor.specialty
        },
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Complete chat consultation error:', error);
    
    // More specific error handling
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('consultationId')) {
        return res.status(409).json({
          success: false,
          message: 'Medical record untuk konsultasi ini sudah ada. Silakan refresh halaman.',
          error: 'MEDICAL_RECORD_EXISTS'
        });
      }
      if (error.meta?.target?.includes('prescriptionCode')) {
        return res.status(409).json({
          success: false,
          message: 'Resep digital untuk konsultasi ini sudah ada. Silakan refresh halaman.',
          error: 'PRESCRIPTION_EXISTS'
        });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Gagal menyelesaikan konsultasi',
      error: error.message
    });
  }
};

// Helper function to calculate prescription total
function calculatePrescriptionTotal(prescriptions) {
  if (!Array.isArray(prescriptions)) return 0;
  
  return prescriptions.reduce((total, med) => {
    const quantity = parseInt(med.quantity) || 1;
    const price = parseFloat(med.price) || 5000; // Default price
    return total + (quantity * price);
  }, 0);
}

// Export functions
module.exports = {
  getActiveChatSessions,
  getChatConversation,
  sendMessage,
  completeChatConsultation,
  calculateResponseTime,
  getResponseStatus,
  formatTimeAgo,
  calculateAge,
  getDisplayUrgency,
  mapSeverityToUrgency,
  formatDecision,
  getDecisionMessage
};