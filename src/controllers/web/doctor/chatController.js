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

    // Get consultations from mobile consultation table
    const activeSessions = await prisma.consultation.findMany({
      where: {
        doctorId: currentDoctor.id,
        type: 'CHAT_DOCTOR',
        isCompleted: false,
        OR: [
          { isPaid: true },
          { paymentStatus: 'PAID' }
        ]
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

    console.log('Found Active Sessions:', activeSessions.length);

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
          }
        }
      });
    }

    // Process sessions without context issues
    const processedSessions = activeSessions.map(session => {
      try {
        console.log('Processing session:', session.id, 'Severity:', session.severity);
        
        // Parse chat history safely
        let chatHistory = [];
        try {
          chatHistory = Array.isArray(session.chatHistory) ? session.chatHistory : [];
        } catch (e) {
          console.log('Error parsing chat history:', e);
          chatHistory = [];
        }

        // Get last message from chatHistory (mobile format)
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
        
        // Use standalone functions - no context issues
        const timeToRespond = calculateResponseTime(session.updatedAt);
        const displayUrgency = getDisplayUrgency(session);
        const patientAge = session.user.dateOfBirth ? 
          calculateAge(new Date(session.user.dateOfBirth)) : null;

        console.log('Session processed:', {
          id: session.id,
          severity: session.severity,
          mappedUrgency: displayUrgency,
          timeToRespond,
          hasLastMessage: !!lastMessage
        });

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
          severity: session.severity || session.aiAnalysis?.severity || 'MEDIUM',
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
          lastActivity: session.updatedAt
        };
      } catch (sessionError) {
        console.error('Error processing session:', sessionError);
        return null;
      }
    }).filter(session => session !== null);

    console.log('Processed sessions count:', processedSessions.length);

    // Sort by urgency and response time - HIGH priority first
    processedSessions.sort((a, b) => {
      const urgencyPriority = { 'EMERGENCY': 3, 'URGENT': 2, 'NORMAL': 1 };
      const aPriority = urgencyPriority[a.urgency] || 1;
      const bPriority = urgencyPriority[b.urgency] || 1;
      
      console.log('Sorting:', a.consultationId, 'priority:', aPriority, 'vs', b.consultationId, 'priority:', bPriority);
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return b.timeToRespond - a.timeToRespond; // More time waiting first
    });

    const summary = {
      emergency: processedSessions.filter(s => s.urgency === 'EMERGENCY').length,
      urgent: processedSessions.filter(s => s.urgency === 'URGENT').length,
      normal: processedSessions.filter(s => s.urgency === 'NORMAL').length,
      needsResponse: processedSessions.filter(s => s.responseStatus === 'overdue').length
    };

    console.log('Final Processed Sessions Summary:', summary);
    console.log('Sessions by urgency:', processedSessions.map(s => ({ id: s.consultationId, urgency: s.urgency, severity: s.severity })));

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
    
    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
      });
    }

    // Get consultation from mobile table
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        doctorId: currentDoctor.id,
        type: 'CHAT_DOCTOR'
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

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Konsultasi tidak ditemukan'
      });
    }

    // Format chat history from mobile format to web format
    let chatHistory = [];
    try {
      chatHistory = Array.isArray(consultation.chatHistory) ? consultation.chatHistory : [];
    } catch (e) {
      console.log('Error parsing chat history:', e);
      chatHistory = [];
    }

    // Format messages using standalone functions
    const formattedHistory = chatHistory.map(msg => ({
      id: msg.id,
      sender: msg.isUser ? 'PATIENT' : 'DOCTOR',
      senderName: msg.isUser ? consultation.user.fullName : currentDoctor.name,
      message: msg.text || msg.message || '',
      type: msg.type || 'text',
      attachments: msg.attachments || [],
      timestamp: msg.timestamp,
      timeAgo: formatTimeAgo(new Date(msg.timestamp)),
      isFromDoctor: !msg.isUser,
      isRead: msg.isRead !== undefined ? msg.isRead : true
    }));

    // Patient info with age calculation
    const patientAge = consultation.user.dateOfBirth ? 
      calculateAge(new Date(consultation.user.dateOfBirth)) : null;

    // Get consistent urgency
    const displayUrgency = getDisplayUrgency(consultation);

    console.log('✅ Chat conversation loaded successfully');

    res.json({
      success: true,
      message: 'Chat conversation retrieved',
      data: {
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
          consultationType: 'CHAT_DOCTOR'
        }
      }
    });

  } catch (error) {
    console.error('Get chat conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memuat percakapan chat',
      error: error.message
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
      decision, 
      doctorNotes, 
      prescriptions = [], 
      followUpDays = null,
      referralSpecialty = null,
      appointmentNeeded = false 
    } = req.body;

    if (!decision || !doctorNotes) {
      return res.status(400).json({
        success: false,
        message: 'Keputusan dan catatan dokter harus diisi'
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
        user: { select: { id: true, fullName: true } }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Konsultasi tidak ditemukan'
      });
    }

    // Calculate follow-up date
    const followUpDate = followUpDays ? 
      new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000) : null;

    // Create completion message
    const completionMessage = {
      id: `msg_${Date.now()}_completion`,
      text: `Konsultasi telah selesai. Keputusan: ${formatDecision(decision)}`,
      isUser: false, // Doctor/System message
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'system'
    };

    const currentHistory = consultation.chatHistory || [];
    const updatedHistory = [...currentHistory, completionMessage];

    // Update consultation
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        isCompleted: true,
        recommendation: decision,
        doctorNotes,
        prescriptions: prescriptions.length > 0 ? prescriptions : null,
        followUpDate,
        chatHistory: updatedHistory,
        updatedAt: new Date()
      }
    });

    // Create completion notification
    await prisma.notification.create({
      data: {
        userId: consultation.userId,
        title: 'Konsultasi Selesai',
        message: `Konsultasi dengan Dr. ${currentDoctor.name} telah selesai. ${getDecisionMessage(decision)}`,
        type: 'CONSULTATION',
        priority: 'HIGH',
        actionUrl: `/consultation/result/${consultationId}`,
        relatedData: {
          consultationId,
          decision,
          hasPrescription: prescriptions.length > 0
        }
      }
    });

    res.json({
      success: true,
      message: 'Konsultasi berhasil diselesaikan',
      data: {
        consultationId,
        decision,
        doctorNotes,
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Complete chat consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menyelesaikan konsultasi',
      error: error.message
    });
  }
};

const testChatController = async (req, res) => {
  try {
    console.log('🧪 Testing chat controller functions...');
    
    // Test helper methods
    const testTime = calculateResponseTime(new Date());
    const testStatus = getResponseStatus(60);
    const testTimeAgo = formatTimeAgo(new Date());
    const testAge = calculateAge(new Date('1990-01-01'));

    console.log('Helper methods test:', {
      testTime,
      testStatus,
      testTimeAgo,
      testAge
    });

    res.json({
      success: true,
      message: 'Chat controller test successful',
      data: {
        helperMethods: {
          calculateResponseTime: testTime,
          getResponseStatus: testStatus,
          formatTimeAgo: testTimeAgo,
          calculateAge: testAge
        },
        functionTests: {
          calculateResponseTime: typeof calculateResponseTime === 'function',
          getResponseStatus: typeof getResponseStatus === 'function',
          formatTimeAgo: typeof formatTimeAgo === 'function',
          calculateAge: typeof calculateAge === 'function',
          mapSeverityToUrgency: typeof mapSeverityToUrgency === 'function',
          getDisplayUrgency: typeof getDisplayUrgency === 'function'
        }
      }
    });

  } catch (error) {
    console.error('Chat controller test error:', error);
    res.status(500).json({
      success: false,
      message: 'Chat controller test failed',
      error: error.message
    });
  }
};

// Export functions
module.exports = {
  getActiveChatSessions,
  getChatConversation,
  sendMessage,
  completeChatConsultation,
  testChatController,
  // Export helper functions for testing
  calculateResponseTime,
  getResponseStatus,
  formatTimeAgo,
  calculateAge,
  getDisplayUrgency,
  mapSeverityToUrgency,
  formatDecision,
  getDecisionMessage
};