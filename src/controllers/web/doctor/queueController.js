const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getTodayQueueWeb = async (req, res) => {
  try {
    // ✅ FIX: Use local timezone instead of UTC
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const localTomorrow = new Date(localToday);
    localTomorrow.setDate(localTomorrow.getDate() + 1);

    console.log('🔍 Getting today queue for date range (LOCAL):', {
      today: localToday.toISOString(),
      tomorrow: localTomorrow.toISOString(),
      currentTime: new Date().toISOString()
    });

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    console.log('👨‍⚕️ Current doctor:', {
      id: currentDoctor.id,
      name: currentDoctor.name,
      specialty: currentDoctor.specialty,
      isOnDuty: currentDoctor.isOnDuty
    });

    // ✅ FIX: More flexible query - include all recent queues
    const whereCondition = {
      // Include today and yesterday's queues that might still be active
      queueDate: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        lt: localTomorrow,
      },
    };

    // ✅ FIX: Better doctor filtering
    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    console.log('🔍 Queue query condition:', whereCondition);

    // ✅ DEBUG: First check all queues for this doctor
    const allQueues = await prisma.queue.findMany({
      where: {
        OR: [
          { doctorId: currentDoctor.id },
          currentDoctor.specialty === 'Dokter Umum' ? { doctorId: null } : {}
        ]
      },
      select: {
        id: true,
        queueNumber: true,
        status: true,
        queueDate: true,
        doctorId: true,
        userId: true
      },
      orderBy: { queueDate: 'desc' },
      take: 10
    });

    console.log('🔍 All recent queues for this doctor:', {
      total: allQueues.length,
      queues: allQueues.map(q => ({
        queueNumber: q.queueNumber,
        status: q.status,
        queueDate: q.queueDate,
        doctorAssigned: !!q.doctorId
      }))
    });

    const queues = await prisma.queue.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
            recommendation: true,
            isCompleted: true
          },
        },
      },
      orderBy: [
        { isPriority: 'desc' },
        { position: 'asc' },
      ],
    });

    console.log('📊 Found queues:', {
      total: queues.length,
      byStatus: queues.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1;
        return acc;
      }, {}),
      queueDetails: queues.map(q => ({
        number: q.queueNumber,
        status: q.status,
        date: q.queueDate,
        patient: q.user.fullName
      }))
    });

    const currentQueue = queues.find(q => q.status === 'IN_PROGRESS');
    const waitingQueues = queues.filter(q => q.status === 'WAITING');
    const completedQueues = queues.filter(q => q.status === 'COMPLETED');

    console.log('🎯 Queue distribution:', {
      current: currentQueue ? currentQueue.queueNumber : 'None',
      waiting: waitingQueues.length,
      completed: completedQueues.length
    });

    res.json({
      success: true,
      message: 'Today\'s queue retrieved successfully',
      data: {
        total: queues.length,
        current: currentQueue || null,
        waiting: waitingQueues,
        completed: completedQueues,
        summary: {
          waiting: waitingQueues.length,
          completed: completedQueues.length,
          total: queues.length,
        },
        doctorInfo: {
          id: currentDoctor.id,
          name: currentDoctor.name,
          specialty: currentDoctor.specialty,
          isOnDuty: currentDoctor.isOnDuty,
        },
        debug: {
          allRecentQueues: allQueues.length,
          queryRange: {
            from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            to: localTomorrow.toISOString()
          }
        }
      },
    });
  } catch (error) {
    console.error('❌ Get today queue web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue',
      error: error.message
    });
  }
};



const getActiveQueue = async (req, res) => {
  try {
    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // ✅ FIX: Check for IN_PROGRESS queue properly
    const whereCondition = {
      status: 'IN_PROGRESS',
    };

    // For general doctor, check all IN_PROGRESS or assigned to them
    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    const activeQueue = await prisma.queue.findFirst({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
            recommendation: true,
          },
        },
      },
    });

    console.log('🎯 Active queue check:', {
      doctorId: currentDoctor.id,
      doctorName: currentDoctor.name,
      activeQueue: activeQueue ? activeQueue.queueNumber : 'None',
      isOnDuty: currentDoctor.isOnDuty
    });

    res.json({
      success: true,
      message: 'Active queue retrieved successfully',
      data: {
        activeQueue: activeQueue || null,
        isOnDuty: currentDoctor.isOnDuty,
      },
    });
  } catch (error) {
    console.error('❌ Get active queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active queue',
      error: error.message
    });
  }
};

const getWaitingQueues = async (req, res) => {
  try {
    // ✅ FIX: More flexible date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // ✅ FIX: Check all WAITING queues regardless of exact date
    const whereCondition = {
      status: 'WAITING',
      // Expand date range to catch queues from yesterday that are still waiting
      queueDate: {
        gte: yesterday,
        lte: tomorrow,
      },
    };

    // ✅ FIX: Proper logic for general vs specialist doctor
    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    console.log('⏳ Searching waiting queues with condition:', {
      ...whereCondition,
      doctorId: currentDoctor.id,
      doctorSpecialty: currentDoctor.specialty
    });

    const waitingQueues = await prisma.queue.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
          },
        },
      },
      orderBy: [
        { isPriority: 'desc' },
        { position: 'asc' },
      ],
    });

    // ✅ DEBUG: Also check all queues to see what's available
    const allQueuesDebug = await prisma.queue.findMany({
      where: {
        queueDate: {
          gte: yesterday,
          lte: tomorrow,
        }
      },
      select: {
        queueNumber: true,
        status: true,
        queueDate: true,
        doctorId: true,
        user: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { queueDate: 'desc' }
    });

    console.log('🔍 All queues in date range:', {
      total: allQueuesDebug.length,
      queues: allQueuesDebug.map(q => ({
        number: q.queueNumber,
        status: q.status,
        date: q.queueDate?.toISOString(),
        doctor: q.doctorId,
        patient: q.user.fullName
      }))
    });

    console.log('⏳ Waiting queues result:', {
      doctorId: currentDoctor.id,
      doctorSpecialty: currentDoctor.specialty,
      total: waitingQueues.length,
      queueNumbers: waitingQueues.map(q => q.queueNumber),
      patients: waitingQueues.map(q => q.user.fullName)
    });

    res.json({
      success: true,
      message: 'Waiting queues retrieved successfully',
      data: {
        waitingQueues,
        total: waitingQueues.length,
        debug: {
          searchCondition: whereCondition,
          allQueuesFound: allQueuesDebug.length
        }
      },
    });
  } catch (error) {
    console.error('❌ Get waiting queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve waiting queues',
      error: error.message
    });
  }
};

// ✅ FIXED: Complete consultation - Remove medicalRecordId from prescription
const completeConsultationWeb = async (req, res) => {
  try {
    const { 
      queueId, 
      notes, 
      diagnosis, 
      treatment, 
      prescriptions = [],
      labTests = [],
      followUpDays = null,
      vitalSigns = null
    } = req.body;

    console.log('🏁 Completing consultation:', {
      queueId,
      diagnosis: diagnosis?.substring(0, 50),
      treatment: treatment?.substring(0, 50),
      prescriptionsCount: prescriptions.length,
      labTestsCount: labTests.length
    });

    if (!queueId) {
      return res.status(400).json({
        success: false,
        message: 'Queue ID is required',
      });
    }

    if (!diagnosis || !treatment) {
      return res.status(400).json({
        success: false,
        message: 'Diagnosis and treatment are required',
      });
    }

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true
          },
        },
        consultation: true,
      },
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
    }

    if (queue.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Queue is not in progress',
      });
    }

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // Calculate follow-up date
    const followUpDate = followUpDays ? 
      new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000) : null;

    // ✅ 1. Complete the queue
    const completedQueue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
        notes: notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true
          },
        },
      },
    });

    // ✅ 2. Create medical record
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        userId: queue.userId,
        doctorId: currentDoctor.id,
        consultationId: queue.consultationId,
        visitDate: new Date(),
        queueNumber: queue.queueNumber,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim(),
        symptoms: queue.consultation?.symptoms || [],
        vitalSigns: vitalSigns || null,
        notes: notes || null,
        followUpDate,
        totalCost: 0, // Will be calculated if needed
        paymentStatus: 'PAID', // Offline consultation already paid
        paymentMethod: 'CASH'
      },
    });

    console.log('✅ Medical record created:', medicalRecord.id);

    // ✅ 3. Create lab results if specified
    let labResults = [];
    if (Array.isArray(labTests) && labTests.length > 0) {
      for (const labTest of labTests) {
        if (!labTest.testName || !labTest.testName.trim()) {
          console.warn('⚠️ Skipping lab test without name');
          continue;
        }

        const labResult = await prisma.labResult.create({
          data: {
            userId: queue.userId,
            medicalRecordId: medicalRecord.id,
            testName: labTest.testName.trim(),
            testType: labTest.testType || 'BLOOD',
            category: labTest.category || 'GENERAL',
            results: labTest.results || {},
            normalRange: labTest.normalRange || null,
            isNormal: labTest.isNormal || null,
            isCritical: labTest.isCritical || false,
            doctorNotes: labTest.notes || '',
            testDate: new Date(),
            resultDate: new Date(),
            isNew: true
          }
        });
        labResults.push(labResult);
      }
      console.log(`✅ Created ${labResults.length} lab results`);
    }

    // ✅ 4. FIXED: Create prescription without medicalRecordId
    let prescriptionRecord = null;
    let validatedMedications = [];

    if (Array.isArray(prescriptions) && prescriptions.length > 0) {
      const prescriptionCode = `RX_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Process medications
      let totalAmount = 0;

      for (const med of prescriptions) {
        if (!med.medicationName || !med.medicationName.trim()) {
          console.warn('⚠️ Skipping medication without name');
          continue;
        }

        if (med.medicationId) {
          // Get medication from database
          try {
            const dbMed = await prisma.medication.findFirst({
              where: { id: med.medicationId, isActive: true }
            });
            
            if (dbMed) {
              const medicationData = {
                medicationId: dbMed.id,
                medicationCode: dbMed.medicationCode,
                genericName: dbMed.genericName,
                brandName: dbMed.brandName || null,
                dosageForm: dbMed.dosageForm,
                strength: dbMed.strength,
                unit: dbMed.unit,
                quantity: parseInt(med.quantity) || 1,
                pricePerUnit: parseFloat(dbMed.pricePerUnit) || 0,
                totalPrice: (parseInt(med.quantity) || 1) * (parseFloat(dbMed.pricePerUnit) || 0),
                dosageInstructions: med.instructions || dbMed.dosageInstructions || '',
                frequency: med.frequency || '',
                duration: med.duration || '',
                notes: med.notes || ''
              };
              
              validatedMedications.push(medicationData);
              totalAmount += medicationData.totalPrice;
              
              console.log('✅ Added database medication:', dbMed.genericName);
            } else {
              console.warn('⚠️ Medication not found in database:', med.medicationId);
            }
          } catch (error) {
            console.error('❌ Error fetching medication:', error);
          }
        } else {
          // Manual medication entry
          const medicationData = {
            medicationId: null,
            medicationCode: null,
            genericName: med.medicationName.trim(),
            brandName: null,
            dosageForm: med.dosage || '',
            strength: med.dosage || '',
            unit: 'tablet',
            quantity: parseInt(med.quantity) || 1,
            pricePerUnit: parseFloat(med.price) || 5000,
            totalPrice: (parseInt(med.quantity) || 1) * (parseFloat(med.price) || 5000),
            dosageInstructions: med.instructions || '',
            frequency: med.frequency || '',
            duration: med.duration || '',
            notes: med.notes || ''
          };
          
          validatedMedications.push(medicationData);
          totalAmount += medicationData.totalPrice;
          
          console.log('✅ Added manual medication:', med.medicationName);
        }
      }

      if (validatedMedications.length > 0) {
        // ✅ FIXED: Remove medicalRecordId field
        prescriptionRecord = await prisma.prescription.create({
          data: {
            userId: queue.userId,
            doctorId: currentDoctor.id,
            consultationId: queue.consultationId,
            // ❌ REMOVED: medicalRecordId field (not in schema)
            prescriptionCode,
            medications: validatedMedications,
            instructions: `Diagnosis: ${diagnosis}\n\nTreatment: ${treatment}${notes ? `\n\nCatatan: ${notes}` : ''}`,
            totalAmount,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            paymentStatus: 'PENDING',
            paymentMethod: 'CASH',
            // ❌ REMOVED: status field (not in schema)
          },
        });

        console.log('✅ Prescription created:', prescriptionRecord.prescriptionCode);
      }
    }

    // ✅ 5. Update doctor status
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    // ✅ 6. Create notifications
    let notificationMessage = `Konsultasi dengan Dr. ${currentDoctor.name} telah selesai. Medical record sudah tersedia.`;
    
    if (prescriptionRecord) {
      notificationMessage += ` Resep digital dengan kode ${prescriptionRecord.prescriptionCode} telah dibuat.`;
    }
    
    if (labResults.length > 0) {
      notificationMessage += ` ${labResults.length} pemeriksaan lab telah dijadwalkan.`;
    }

    await prisma.notification.create({
      data: {
        userId: queue.userId,
        title: '✅ Konsultasi Selesai',
        message: notificationMessage,
        type: 'CONSULTATION',
        priority: 'HIGH',
        actionUrl: `/medical-records/${medicalRecord.id}`,
        relatedData: {
          queueId,
          medicalRecordId: medicalRecord.id,
          prescriptionId: prescriptionRecord?.id || null,
          prescriptionCode: prescriptionRecord?.prescriptionCode || null,
          labResultsCount: labResults.length
        }
      },
    });

    console.log('✅ Consultation completed successfully');

    // ✅ 7. Prepare response data
    const responseData = {
      success: true,
      message: 'Consultation completed successfully',
      data: { 
        completedQueue,
        medicalRecord: {
          id: medicalRecord.id,
          diagnosis: medicalRecord.diagnosis,
          treatment: medicalRecord.treatment,
          visitDate: medicalRecord.visitDate,
          followUpDate: medicalRecord.followUpDate,
          vitalSigns: medicalRecord.vitalSigns
        },
        prescription: prescriptionRecord ? {
          id: prescriptionRecord.id,
          code: prescriptionRecord.prescriptionCode,
          medicationsCount: validatedMedications.length,
          totalAmount: prescriptionRecord.totalAmount,
          medications: validatedMedications.map(med => ({
            name: med.genericName,
            quantity: med.quantity,
            frequency: med.frequency,
            duration: med.duration
          }))
        } : null,
        labResults: labResults.map(lab => ({
          id: lab.id,
          testName: lab.testName,
          testType: lab.testType,
          category: lab.category,
          isCritical: lab.isCritical
        })),
        summary: {
          medicalRecordCreated: true,
          prescriptionCreated: !!prescriptionRecord,
          labResultsCreated: labResults.length,
          followUpScheduled: !!followUpDate,
          totalMedications: validatedMedications.length,
          totalLabTests: labResults.length
        }
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('❌ Complete consultation web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Keep existing functions...
const getQueueHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const whereCondition = {
      status: 'COMPLETED',
    };

    // ✅ FIX: Include queues from this doctor
    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    if (startDate || endDate) {
      whereCondition.queueDate = {};
      if (startDate) whereCondition.queueDate.gte = new Date(startDate);
      if (endDate) whereCondition.queueDate.lte = new Date(endDate);
    }

    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              nik: true,
              phone: true,
            },
          },
          consultation: {
            select: {
              id: true,
              type: true,
              severity: true,
              symptoms: true,
            },
          },
        },
        orderBy: {
          completedTime: 'desc',
        },
        skip,
        take: parseInt(limit),
      }),
      prisma.queue.count({ where: whereCondition }),
    ]);

    res.json({
      success: true,
      message: 'Queue history retrieved successfully',
      data: {
        queues,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('❌ Get queue history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue history',
      error: error.message
    });
  }
};

const callNextPatientWeb = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // ✅ FIX: Complete any existing IN_PROGRESS queue first
    await prisma.queue.updateMany({
      where: {
        status: 'IN_PROGRESS',
        queueDate: {
          gte: today,
          lt: tomorrow,
        },
        OR: [
          { doctorId: currentDoctor.id },
          currentDoctor.specialty === 'Dokter Umum' ? { doctorId: null } : {}
        ]
      },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
      },
    });

    // Reset doctor duty status
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    // Find next waiting patient
    const whereCondition = {
      status: 'WAITING',
      queueDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (currentDoctor.specialty === 'Dokter Umum') {
      whereCondition.OR = [
        { doctorId: null },
        { doctorId: currentDoctor.id },
      ];
    } else {
      whereCondition.doctorId = currentDoctor.id;
    }

    const nextQueue = await prisma.queue.findFirst({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
          },
        },
      },
      orderBy: [
        { isPriority: 'desc' },
        { position: 'asc' },
      ],
    });

    if (!nextQueue) {
      return res.json({
        success: true,
        message: 'No more patients in queue',
        data: { 
          calledPatient: null,
          queueNumber: null,
          hasMore: false
        },
      });
    }

    // Assign doctor if not assigned
    if (!nextQueue.doctorId) {
      await prisma.queue.update({
        where: { id: nextQueue.id },
        data: { doctorId: currentDoctor.id },
      });
    }

    // Call the patient
    const calledQueue = await prisma.queue.update({
      where: { id: nextQueue.id },
      data: {
        status: 'IN_PROGRESS',
        calledTime: new Date(),
        doctorId: currentDoctor.id,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        doctor: {
          select: {
            name: true,
            specialty: true,
          },
        },
        consultation: {
          select: {
            id: true,
            type: true,
            severity: true,
            symptoms: true,
            aiAnalysis: true,
          },
        },
      },
    });

    // Set doctor on duty
    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: true },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: calledQueue.userId,
        title: '📢 Anda Dipanggil!',
        message: `Nomor antrian ${calledQueue.queueNumber} silakan menuju ruang konsultasi Dr. ${currentDoctor.name}`,
        type: 'QUEUE',
        priority: 'HIGH',
      },
    });

    console.log('✅ Patient called successfully:', {
      queueNumber: calledQueue.queueNumber,
      patientName: calledQueue.user.fullName,
      doctorName: currentDoctor.name
    });

    res.json({
      success: true,
      message: 'Next patient called successfully',
      data: { 
        calledPatient: calledQueue,
        queueNumber: calledQueue.queueNumber,
        assignedDoctor: {
          name: currentDoctor.name,
          specialty: currentDoctor.specialty,
        },
        hasMore: true
      },
    });

  } catch (error) {
    console.error('❌ Call next patient web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to call next patient',
      error: error.message
    });
  }
};

const skipPatientWeb = async (req, res) => {
  try {
    const { queueId, reason } = req.body;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
    });

    if (!queue || queue.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue or not in progress',
      });
    }

    // Find max position for today
    const maxPosition = await prisma.queue.aggregate({
      where: {
        queueDate: queue.queueDate,
        status: 'WAITING',
      },
      _max: {
        position: true,
      },
    });

    // Move to end of queue
    await prisma.queue.update({
      where: { id: queueId },
      data: {
        status: 'WAITING',
        position: (maxPosition._max.position || 0) + 1,
        notes: `Skipped: ${reason || 'No reason provided'}`,
      },
    });

    // Reset doctor duty status
    const currentDoctor = await prisma.doctor.findFirst({
      where: { userId: req.user.id },
    });

    await prisma.doctor.update({
      where: { id: currentDoctor.id },
      data: { isOnDuty: false },
    });

    res.json({
      success: true,
      message: 'Patient skipped successfully',
    });

  } catch (error) {
    console.error('❌ Skip patient web error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to skip patient',
      error: error.message
    });
  }
};

module.exports = {
  getTodayQueueWeb,
  getActiveQueue,
  getWaitingQueues,
  getQueueHistory,
  callNextPatientWeb,
  completeConsultationWeb,
  skipPatientWeb,
};