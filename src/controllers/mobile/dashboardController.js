const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DashboardController {
  async getDashboardData(req, res) {
    try {
      console.log('=== Get Dashboard Data ===');
      console.log('User ID:', req.user.id);

      const userId = req.user.id;

      // Get user profile with additional info - FIXED field names
      const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          profilePicture: true, // FIXED: was profileImage
          isActive: true
        }
      });

      if (!userProfile) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get active queue status
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

      // Get upcoming appointments/schedules - FIXED field name
      const upcomingAppointments = await prisma.appointment.findMany({
        where: {
          userId: userId,
          appointmentDate: { // FIXED: was scheduledDate
            gte: new Date()
          },
          status: {
            in: ['SCHEDULED', 'CONFIRMED']
          }
        },
        include: {
          doctor: {
            select: {
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
          appointmentDate: 'asc' // FIXED: was scheduledDate
        },
        take: 3
      });

      // Get recent consultations
      const recentConsultations = await prisma.consultation.findMany({
        where: {
          userId: userId,
          isCompleted: true
        },
        include: {
          doctor: {
            select: {
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
        },
        take: 3
      });

      // Get pending lab results - FIXED: remove status filter as it doesn't exist in schema
      const pendingLabResults = await prisma.labResult.findMany({
        where: {
          userId: userId,
          isNew: true // Use isNew instead of status
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });

      // Get recent prescriptions - FIXED: remove _count for medications as it's JSON field
      const recentPrescriptions = await prisma.prescription.findMany({
        where: {
          userId: userId
        },
        include: {
          doctor: {
            select: {
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
        },
        take: 3
      });

      // Get unread notifications count
      const unreadNotifications = await prisma.notification.count({
        where: {
          userId: userId,
          isRead: false
        }
      });

      // Calculate age
      const calculateAge = (dateOfBirth) => {
        if (!dateOfBirth) return null;
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };

      // Count medications in JSON field
      const countMedications = (medicationsJson) => {
        if (!medicationsJson || typeof medicationsJson !== 'object') return 0;
        if (Array.isArray(medicationsJson)) return medicationsJson.length;
        if (medicationsJson.medications && Array.isArray(medicationsJson.medications)) {
          return medicationsJson.medications.length;
        }
        return 0;
      };

      // Format queue data
      let queueStatus = null;
      if (activeQueue) {
        // Calculate estimated waiting time
        const queuePosition = await prisma.queue.count({
          where: {
            doctorId: activeQueue.doctorId,
            status: 'WAITING',
            queueNumber: {
              lt: activeQueue.queueNumber
            }
          }
        });

        const estimatedMinutes = queuePosition * 15; // 15 minutes per patient

        queueStatus = {
          id: activeQueue.id,
          queueNumber: activeQueue.queueNumber,
          status: activeQueue.status,
          estimatedWaitTime: estimatedMinutes,
          doctor: {
            name: activeQueue.doctor?.user?.fullName || 'Unknown Doctor',
            specialty: activeQueue.doctor?.specialty || 'General'
          },
          position: queuePosition + 1
        };
      }

      // Format response
      const dashboardData = {
        user: {
          ...userProfile,
          profileImage: userProfile.profilePicture, // Map profilePicture to profileImage for frontend
          age: calculateAge(userProfile.dateOfBirth)
        },
        queueStatus,
        upcomingAppointments: upcomingAppointments.map(apt => ({
          id: apt.id,
          scheduledDate: apt.appointmentDate, // Map appointmentDate to scheduledDate for frontend
          status: apt.status,
          notes: apt.notes,
          doctor: {
            name: apt.doctor?.user?.fullName || 'Unknown Doctor',
            specialty: apt.doctor?.specialty || 'General'
          }
        })),
        recentConsultations: recentConsultations.map(cons => ({
          id: cons.id,
          type: cons.type,
          status: cons.isCompleted ? 'COMPLETED' : 'PENDING', // Map boolean to status
          createdAt: cons.createdAt,
          doctorNotes: cons.doctorNotes,
          doctor: {
            name: cons.doctor?.user?.fullName || 'Unknown Doctor',
            specialty: cons.doctor?.specialty || 'General'
          }
        })),
        pendingLabResults: pendingLabResults.length,
        recentPrescriptions: recentPrescriptions.map(presc => ({
          id: presc.id,
          prescriptionCode: presc.prescriptionCode,
          createdAt: presc.createdAt,
          totalAmount: presc.totalAmount,
          status: presc.isPaid ? 'PAID' : 'PENDING', // Map boolean to status
          medicationCount: countMedications(presc.medications), // Count from JSON
          doctor: {
            name: presc.doctor?.user?.fullName || 'Unknown Doctor'
          }
        })),
        notifications: {
          unreadCount: unreadNotifications
        },
        stats: {
          totalConsultations: recentConsultations.length,
          totalPrescriptions: recentPrescriptions.length,
          pendingLabResults: pendingLabResults.length,
          upcomingAppointments: upcomingAppointments.length
        }
      };

      console.log('Dashboard data prepared for user:', userProfile.fullName);

      res.json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: dashboardData
      });

    } catch (error) {
      console.error('Get dashboard data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error.message
      });
    }
  }

  async getQuickStats(req, res) {
    try {
      const userId = req.user.id;

      const [
        totalConsultations,
        totalPrescriptions,
        pendingResults,
        unreadNotifications
      ] = await Promise.all([
        prisma.consultation.count({
          where: { userId, isCompleted: true }
        }),
        prisma.prescription.count({
          where: { userId }
        }),
        prisma.labResult.count({
          where: { userId, isNew: true }
        }),
        prisma.notification.count({
          where: { userId, isRead: false }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalConsultations,
          totalPrescriptions,
          pendingResults,
          unreadNotifications
        }
      });

    } catch (error) {
      console.error('Get quick stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get quick stats',
        error: error.message
      });
    }
  }
}

module.exports = new DashboardController();