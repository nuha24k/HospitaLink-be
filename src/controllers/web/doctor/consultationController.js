const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get pending online consultations for doctor
const getPendingConsultationsWeb = async (req, res) => {
  try {
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const consultations = await prisma.consultation.findMany({
      where: {
        doctorId: currentDoctor.id,
        type: 'CHAT_DOCTOR',
        isCompleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            dateOfBirth: true,
            gender: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json({
      success: true,
      message: 'Pending consultations retrieved successfully',
      data: { 
        consultations,
        total: consultations.length
      },
    });

  } catch (error) {
    console.error('Get pending consultations web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending consultations',
    });
  }
};

// Complete online consultation (doctor responds)
const completeOnlineConsultationWeb = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { 
      doctorDecision, 
      doctorNotes, 
      prescriptions, 
      followUpInDays,
      appointmentNeeded 
    } = req.body;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { 
        user: true, 
        doctor: true 
      },
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Verify this is doctor's consultation
    const currentDoctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (consultation.doctorId !== currentDoctor.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to complete this consultation',
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
        followUpDate,
      },
    });

    let responseData = {
      consultationId: updatedConsultation.id,
      decision: doctorDecision,
      doctorNotes,
      prescriptions: prescriptions || [],
      followUpDate,
    };

    // Handle different doctor decisions
    switch (doctorDecision) {
      case 'PRESCRIPTION_ONLY':
        if (prescriptions && prescriptions.length > 0) {
          // Create digital prescription
          const prescriptionCode = `RX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          
          const prescription = await prisma.prescription.create({
            data: {
              userId: consultation.userId,
              doctorId: consultation.doctorId,
              consultationId,
              prescriptionCode,
              medications: prescriptions,
              instructions: doctorNotes,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          });
          
          responseData.prescriptionCode = prescription.prescriptionCode;
        }
        break;

      case 'APPOINTMENT_NEEDED':
        // Get available appointment slots for this doctor
        const availableSlots = await getAvailableAppointmentSlots(currentDoctor.id);
        responseData.availableSlots = availableSlots.slice(0, 10); // First 10 slots
        responseData.appointmentFee = 15000;
        break;

      case 'EMERGENCY_REFERRAL':
        responseData.emergencyMessage = "Kondisi memerlukan pemeriksaan segera";
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
        priority: 'HIGH',
      },
    });

    res.json({
      success: true,
      message: 'Online consultation completed successfully',
      data: responseData,
    });

  } catch (error) {
    console.error('Complete online consultation web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation',
    });
  }
};

// Helper function to get available appointment slots
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

  return slots;
}

module.exports = {
  getPendingConsultationsWeb,
  completeOnlineConsultationWeb,
};