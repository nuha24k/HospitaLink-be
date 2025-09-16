const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class QueueController {
  // Take queue (user)
  async takeQueue(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if user already has queue today
      const existingQueue = await prisma.queue.findFirst({
        where: {
          userId,
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: ['WAITING', 'CALLED', 'IN_PROGRESS'],
          },
        },
      });

      if (existingQueue) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active queue today',
          data: { existingQueue },
        });
      }

      // Get hospital config for queue settings
      const hospitalConfig = await prisma.hospitalConfig.findUnique({
        where: { id: 'hospital' },
      });

      const queuePrefix = hospitalConfig?.queuePrefix || 'A';
      const maxQueue = hospitalConfig?.maxQueuePerDay || 100;

      // Get current queue count for today
      const queueCount = await prisma.queue.count({
        where: {
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (queueCount >= maxQueue) {
        return res.status(400).json({
          success: false,
          message: 'Queue is full for today. Please try again tomorrow',
          maxQueue,
        });
      }

      // Get next position
      const lastQueue = await prisma.queue.findFirst({
        where: {
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: {
          position: 'desc',
        },
      });

      const nextPosition = (lastQueue?.position || 0) + 1;
      const queueNumber = `${queuePrefix}${nextPosition.toString().padStart(3, '0')}`;

      // Auto-assign available general doctor
      const availableDoctor = await prisma.doctor.findFirst({
        where: {
          specialty: 'Dokter Umum',
          isAvailable: true,
          isOnDuty: false,
          user: {
            isActive: true,
          },
        },
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // FIFO for fairness
        },
      });

      // Calculate estimated wait time
      const waitingCount = await prisma.queue.count({
        where: {
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
          status: 'WAITING',
        },
      });

      const estimatedWaitTime = waitingCount * (hospitalConfig?.queueCallInterval || 5);

      // Create queue
      const queue = await prisma.queue.create({
        data: {
          userId,
          doctorId: availableDoctor?.id || null, // Auto-assign if available
          queueNumber,
          position: nextPosition,
          queueDate: today,
          estimatedWaitTime,
          status: 'WAITING',
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              nik: true,
              phone: true,
            },
          },
          doctor: {
            select: {
              name: true,
              specialty: true,
            },
          },
        },
      });

      // Create notification
      const doctorInfo = availableDoctor 
        ? `dengan ${availableDoctor.name} (${availableDoctor.specialty})`
        : 'dokter akan ditentukan kemudian';

      await prisma.notification.create({
        data: {
          userId,
          title: 'Antrian Berhasil Diambil',
          message: `Nomor antrian Anda: ${queueNumber}. Konsultasi ${doctorInfo}. Estimasi waktu tunggu: ${estimatedWaitTime} menit`,
          type: 'QUEUE',
          priority: 'MEDIUM',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Queue taken successfully',
        data: { 
          queue,
          estimatedWaitTime: `${estimatedWaitTime} menit`,
          position: nextPosition,
          assignedDoctor: availableDoctor ? {
            name: availableDoctor.name,
            specialty: availableDoctor.specialty,
          } : null,
        },
      });

    } catch (error) {
      console.error('Take queue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to take queue',
      });
    }
  }

  // Get user's current queue
  async getMyQueue(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const queue = await prisma.queue.findFirst({
        where: {
          userId,
          queueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              nik: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!queue) {
        return res.json({
          success: true,
          message: 'No queue found for today',
          data: { queue: null },
        });
      }

      // Calculate current position in waiting list
      if (queue.status === 'WAITING') {
        const waitingAhead = await prisma.queue.count({
          where: {
            queueDate: {
              gte: today,
              lt: tomorrow,
            },
            status: 'WAITING',
            position: {
              lt: queue.position,
            },
          },
        });

        queue.waitingAhead = waitingAhead;
      }

      res.json({
        success: true,
        message: 'Queue retrieved successfully',
        data: { queue },
      });

    } catch (error) {
      console.error('Get my queue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve queue',
      });
    }
  }

  // Get queue status by ID
  async getQueueStatus(req, res) {
    try {
      const { queueId } = req.params;

      const queue = await prisma.queue.findUnique({
        where: { id: queueId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      if (!queue) {
        return res.status(404).json({
          success: false,
          message: 'Queue not found',
        });
      }

      // Check if user owns this queue
      if (queue.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Get current serving number
      const currentServing = await prisma.queue.findFirst({
        where: {
          queueDate: queue.queueDate,
          status: 'IN_PROGRESS',
        },
        select: {
          queueNumber: true,
          position: true,
        },
      });

      res.json({
        success: true,
        message: 'Queue status retrieved successfully',
        data: { 
          queue,
          currentServing,
        },
      });

    } catch (error) {
      console.error('Get queue status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve queue status',
      });
    }
  }

  // Update: HospitaLink-be/src/controllers/mobile/queueController.js
  async getQueueDetails(req, res) {
    try {
      const queueId = req.params.id;
      const userId = req.user.id;

      const queue = await prisma.queue.findFirst({
        where: {
          id: queueId,
          userId: userId
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialty: true,
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              }
            }
          },
          user: {
            select: {
              fullName: true,
              phone: true
            }
          }
        }
      });

      if (!queue) {
        return res.status(404).json({
          success: false,
          message: 'Queue not found'
        });
      }

      // Calculate current position
      const currentPosition = await prisma.queue.count({
        where: {
          doctorId: queue.doctorId,
          status: 'WAITING',
          queueNumber: {
            lt: queue.queueNumber
          },
          queueDate: queue.queueDate
        }
      });

      // Get total waiting queue
      const totalWaiting = await prisma.queue.count({
        where: {
          doctorId: queue.doctorId,
          status: {
            in: ['WAITING', 'CALLED']
          },
          queueDate: queue.queueDate
        }
      });

      // Calculate estimated time
      const estimatedMinutes = currentPosition * 15;

      res.json({
        success: true,
        message: 'Queue details retrieved successfully',
        data: {
          id: queue.id,
          queueNumber: queue.queueNumber,
          status: queue.status,
          queueType: queue.queueType,
          position: currentPosition + 1,
          totalWaiting: totalWaiting,
          estimatedWaitTime: estimatedMinutes,
          queueDate: queue.queueDate,
          checkInTime: queue.checkInTime,
          calledTime: queue.calledTime,
          notes: queue.notes,
          doctor: {
            name: queue.doctor?.user?.fullName || 'Unknown Doctor',
            specialty: queue.doctor?.specialty || 'General',
            phone: queue.doctor?.user?.phone
          },
          patient: {
            name: queue.user.fullName,
            phone: queue.user.phone
          },
          createdAt: queue.createdAt,
          updatedAt: queue.updatedAt
        }
      });

    } catch (error) {
      console.error('❌ Get queue details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue details',
        error: error.message
      });
    }
  }

  // Cancel queue
  async cancelQueue(req, res) {
    try {
      const queueId = req.params.id;
      const userId = req.user.id;
      const { reason } = req.body;

      // Find the queue
      const queue = await prisma.queue.findFirst({
        where: {
          id: queueId,
          userId: userId,
          status: {
            in: ['WAITING', 'CALLED']
          }
        }
      });

      if (!queue) {
        return res.status(404).json({
          success: false,
          message: 'Queue not found or cannot be cancelled'
        });
      }

      // Update queue status
      const updatedQueue = await prisma.queue.update({
        where: { id: queueId },
        data: {
          status: 'CANCELLED',
          notes: reason || 'Cancelled by patient',
          updatedAt: new Date()
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: userId,
          title: 'Antrean Dibatalkan',
          message: `Antrean nomor ${queue.queueNumber} telah dibatalkan`,
          type: 'QUEUE',
          priority: 'MEDIUM'
        }
      });

      console.log('✅ Queue cancelled:', queue.queueNumber);

      res.json({
        success: true,
        message: 'Queue cancelled successfully',
        data: {
          queueNumber: queue.queueNumber,
          cancelledAt: new Date(),
          reason: reason || 'Cancelled by patient'
        }
      });

    } catch (error) {
      console.error('❌ Cancel queue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel queue',
        error: error.message
      });
    }
  }

  // Get user's active queue
  async getActiveQueue(req, res) {
    try {
      const userId = req.user.id;

      const activeQueue = await prisma.queue.findFirst({
        where: {
          userId: userId,
          status: {
            in: ['WAITING', 'CALLED', 'IN_PROGRESS']
          }
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialty: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!activeQueue) {
        return res.json({
          success: true,
          message: 'No active queue found',
          data: null
        });
      }

      // Calculate position
      const position = await prisma.queue.count({
        where: {
          doctorId: activeQueue.doctorId,
          status: 'WAITING',
          queueNumber: {
            lt: activeQueue.queueNumber
          }
        }
      });

      const estimatedMinutes = position * 15;

      res.json({
        success: true,
        message: 'Active queue retrieved successfully',
        data: {
          id: activeQueue.id,
          queueNumber: activeQueue.queueNumber,
          status: activeQueue.status,
          estimatedWaitTime: estimatedMinutes,
          position: position + 1,
          doctor: {
            name: activeQueue.doctor?.user?.fullName || 'Unknown Doctor',
            specialty: activeQueue.doctor?.specialty || 'General'
          }
        }
      });

    } catch (error) {
      console.error('❌ Get active queue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active queue',
        error: error.message
      });
    }
  }
}

module.exports = new QueueController();