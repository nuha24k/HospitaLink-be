const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ChatController {
  // Helper method to map AI severity to urgency
  mapSeverityToUrgency(aiSeverity) {
    const mapping = {
      'LOW': 'NORMAL',
      'MEDIUM': 'URGENT', 
      'HIGH': 'EMERGENCY'
    };
    return mapping[aiSeverity] || 'NORMAL';
  }

  // Helper method to get display urgency from various sources
  getDisplayUrgency(consultation) {
    // Priority order: explicit urgency > mapped from AI severity > default
    if (consultation.urgency && ['EMERGENCY', 'URGENT', 'NORMAL'].includes(consultation.urgency)) {
      return consultation.urgency;
    }
    
    if (consultation.severity) {
      return this.mapSeverityToUrgency(consultation.severity);
    }
    
    // Check AI analysis for severity
    if (consultation.aiAnalysis?.severity) {
      return this.mapSeverityToUrgency(consultation.aiAnalysis.severity);
    }
    
    return 'NORMAL';
  }

  // Get active chat sessions for doctor
  async getActiveChatSessions(req, res) {
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

      // Determine consultation type based on doctor specialty
      const consultationType = currentDoctor.specialty.toLowerCase() === 'umum' ? 'CHAT_DOCTOR' : 'CHAT_SPECIALIST';
      
      console.log('Doctor Specialty:', currentDoctor.specialty);
      console.log('Consultation Type Filter:', consultationType);

      // Get consultations
      const activeSessions = await prisma.consultation.findMany({
        where: {
          doctorId: currentDoctor.id,
          type: consultationType,
          isCompleted: false,
          paymentStatus: 'PAID'
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profilePicture: true,
              nik: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      console.log('Found Active Sessions:', activeSessions.length);

      // If no sessions found, return empty result
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
              consultationType
            }
          }
        });
      }

      // Process sessions with consistent urgency mapping
      const processedSessions = await Promise.all(
        activeSessions.map(async (session) => {
          // Get last message from chatHistory
          const chatHistory = session.chatHistory || [];
          const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
          
          // Calculate response time
          const timeToRespond = this.calculateResponseTime(session.updatedAt);
          
          // Get consistent urgency
          const displayUrgency = this.getDisplayUrgency(session);
          
          return {
            consultationId: session.id,
            patient: session.user,
            severity: session.severity || session.aiAnalysis?.severity || 'MEDIUM',
            urgency: displayUrgency, // Use mapped urgency
            symptoms: session.symptoms || [],
            aiAnalysis: session.aiAnalysis || {},
            lastMessage: lastMessage ? {
              content: lastMessage.message,
              sender: lastMessage.sender,
              timestamp: lastMessage.timestamp,
              timeAgo: this.formatTimeAgo(new Date(lastMessage.timestamp))
            } : null,
            responseStatus: this.getResponseStatus(timeToRespond),
            timeToRespond: timeToRespond,
            startedAt: session.createdAt,
            lastActivity: session.updatedAt
          };
        })
      );

      // Sort by urgency and response time
      processedSessions.sort((a, b) => {
        // Priority order: EMERGENCY > URGENT > NORMAL
        const urgencyPriority = { 'EMERGENCY': 3, 'URGENT': 2, 'NORMAL': 1 };
        const aPriority = urgencyPriority[a.urgency] || 1;
        const bPriority = urgencyPriority[b.urgency] || 1;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // Then by response time (longer wait time first)
        return b.timeToRespond - a.timeToRespond;
      });

      const summary = {
        emergency: processedSessions.filter(s => s.urgency === 'EMERGENCY').length,
        urgent: processedSessions.filter(s => s.urgency === 'URGENT').length,
        normal: processedSessions.filter(s => s.urgency === 'NORMAL').length,
        needsResponse: processedSessions.filter(s => s.responseStatus === 'overdue').length
      };

      console.log('Processed Sessions Summary:', summary);

      res.json({
        success: true,
        message: 'Active chat sessions retrieved',
        data: {
          sessions: processedSessions,
          totalActive: processedSessions.length,
          summary,
          doctorInfo: {
            specialty: currentDoctor.specialty,
            consultationType
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
  }

  // Get specific chat conversation
  async getChatConversation(req, res) {
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

      const consultationType = currentDoctor.specialty.toLowerCase() === 'umum' ? 'CHAT_DOCTOR' : 'CHAT_SPECIALIST';

      const consultation = await prisma.consultation.findFirst({
        where: {
          id: consultationId,
          doctorId: currentDoctor.id,
          type: consultationType
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

      // Format chat history
      const chatHistory = consultation.chatHistory || [];
      const formattedHistory = chatHistory.map(msg => ({
        ...msg,
        timeAgo: this.formatTimeAgo(new Date(msg.timestamp)),
        isFromDoctor: msg.sender === 'DOCTOR'
      }));

      // Patient info with age calculation
      const patientAge = consultation.user.dateOfBirth ? 
        this.calculateAge(new Date(consultation.user.dateOfBirth)) : null;

      // Get consistent urgency
      const displayUrgency = this.getDisplayUrgency(consultation);

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
            urgency: displayUrgency, // Use mapped urgency
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
            consultationType
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
  }

  // Complete chat consultation
  async completeChatConsultation(req, res) {
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
        sender: 'SYSTEM',
        senderName: 'System',
        message: `Konsultasi telah selesai. Keputusan: ${this.formatDecision(decision)}`,
        type: 'system',
        timestamp: new Date().toISOString(),
        isRead: false
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
          message: `Konsultasi dengan Dr. ${currentDoctor.name} telah selesai. ${this.getDecisionMessage(decision)}`,
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
  }

  // Helper methods (unchanged)
  calculateResponseTime(lastUpdate) {
    const now = new Date();
    const lastActivity = new Date(lastUpdate);
    return Math.floor((now - lastActivity) / (1000 * 60)); // minutes
  }

  getResponseStatus(minutes) {
    if (minutes > 240) return 'overdue'; // > 4 hours
    if (minutes > 120) return 'urgent';  // > 2 hours
    if (minutes > 60) return 'warning';  // > 1 hour
    return 'normal';
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    return `${diffDays} hari yang lalu`;
  }

  calculateAge(birthDate) {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Send message (implementation...)
  async sendMessage(req, res) {
    try {
      const { consultationId } = req.params;
      const { message, type = 'text', attachments = [] } = req.body;

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

      // Prepare new message
      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sender: 'DOCTOR',
        senderName: currentDoctor.name,
        message: message || '',
        type,
        attachments,
        timestamp: new Date().toISOString(),
        isRead: false
      };

      // Update chat history
      const currentHistory = consultation.chatHistory || [];
      const updatedHistory = [...currentHistory, newMessage];

      // Update consultation
      await prisma.consultation.update({
        where: { id: consultationId },
        data: {
          chatHistory: updatedHistory,
          updatedAt: new Date()
        }
      });

      // Create notification for patient
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

      res.json({
        success: true,
        message: 'Pesan berhasil dikirim',
        data: {
          message: {
            ...newMessage,
            timeAgo: 'Baru saja',
            isFromDoctor: true
          }
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
  }

  // Helper methods untuk completion
  formatDecision(decision) {
    const decisions = {
      'PRESCRIPTION_ONLY': 'Resep Obat',
      'APPOINTMENT_NEEDED': 'Perlu Appointment',
      'SPECIALIST_REFERRAL': 'Rujukan Spesialis',
      'SELF_CARE': 'Perawatan Mandiri',
      'EMERGENCY_REFERRAL': 'Rujukan Emergency'
    };
    return decisions[decision] || decision;
  }

  getDecisionMessage(decision) {
    const messages = {
      'PRESCRIPTION_ONLY': 'Resep digital sudah tersedia.',
      'APPOINTMENT_NEEDED': 'Silakan buat appointment untuk pemeriksaan lanjutan.',
      'SPECIALIST_REFERRAL': 'Anda dirujuk ke dokter spesialis.',
      'SELF_CARE': 'Ikuti instruksi perawatan mandiri yang diberikan.',
      'EMERGENCY_REFERRAL': 'Segera datang ke rumah sakit.'
    };
    return messages[decision] || 'Silakan baca hasil konsultasi lengkap.';
  }
}

module.exports = new ChatController();