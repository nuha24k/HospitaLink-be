const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NotificationController {
  async getNotifications(req, res) {
    try {
      console.log('=== Get Notifications ===');
      console.log('User ID:', req.user.id);

      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        type = 'all', 
        unreadOnly = false 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Build where clause
      const whereClause = {
        userId: userId,
        ...(type !== 'all' && { type: type.toUpperCase() }),
        ...(unreadOnly === 'true' && { isRead: false }),
        // Only get non-expired notifications
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      };

      // Get notifications with pagination
      const [notifications, totalCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          orderBy: [
            { isRead: 'asc' }, // Unread first
            { priority: 'desc' }, // High priority first
            { createdAt: 'desc' } // Newest first
          ],
          skip,
          take
        }),
        prisma.notification.count({
          where: whereClause
        })
      ]);

      // Get unread count
      const unreadCount = await prisma.notification.count({
        where: {
          userId: userId,
          isRead: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        }
      });

      // Get notifications by type count
      const typeCounts = await prisma.notification.groupBy({
        by: ['type'],
        where: {
          userId: userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        },
        _count: {
          id: true
        }
      });

      const typeCountsFormatted = typeCounts.reduce((acc, item) => {
        acc[item.type.toLowerCase()] = item._count.id;
        return acc;
      }, {});

      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            totalPages: Math.ceil(totalCount / take),
            hasNext: skip + take < totalCount,
            hasPrev: page > 1
          },
          summary: {
            unreadCount,
            totalCount,
            typeCounts: typeCountsFormatted
          }
        }
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        error: error.message
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: userId
        }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      const updateResult = await prisma.notification.updateMany({
        where: {
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({
        success: true,
        message: `${updateResult.count} notifications marked as read`
      });

    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message
      });
    }
  }

  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: userId
        }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await prisma.notification.delete({
        where: { id: notificationId }
      });

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });

    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  }

  async clearAllNotifications(req, res) {
    try {
      const userId = req.user.id;

      const deleteResult = await prisma.notification.deleteMany({
        where: { userId: userId }
      });

      res.json({
        success: true,
        message: `${deleteResult.count} notifications cleared`
      });

    } catch (error) {
      console.error('Clear all notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear all notifications',
        error: error.message
      });
    }
  }

  async createNotification(req, res) {
    try {
      const userId = req.user.id;
      const {
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        actionUrl,
        relatedData,
        expiresAt
      } = req.body;

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required'
        });
      }

      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type: type.toUpperCase(),
          priority: priority.toUpperCase(),
          actionUrl,
          relatedData,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });

    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: error.message
      });
    }
  }

  // Helper method to create system notifications
  async createSystemNotification(userId, data) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          ...data
        }
      });
    } catch (error) {
      console.error('Create system notification error:', error);
      throw error;
    }
  }

  // Notification templates
  async sendQueueNotification(req, res) {
    try {
      const { userId, queueNumber, message, doctorName, estimatedTime } = req.body;

      const notification = await this.createSystemNotification(userId, {
        title: 'Update Antrean',
        message: message || `Antrean ${queueNumber} - ${doctorName}`,
        type: 'QUEUE',
        priority: 'HIGH',
        relatedData: {
          queueNumber,
          doctorName,
          estimatedTime
        }
      });

      res.json({
        success: true,
        message: 'Queue notification sent',
        data: notification
      });

    } catch (error) {
      console.error('Send queue notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send queue notification',
        error: error.message
      });
    }
  }

  async sendAppointmentReminder(req, res) {
    try {
      const { userId, doctorName, appointmentTime, hospitalName } = req.body;

      const notification = await this.createSystemNotification(userId, {
        title: 'Reminder Konsultasi',
        message: `Jangan lupa konsultasi dengan ${doctorName} pada ${appointmentTime}`,
        type: 'APPOINTMENT',
        priority: 'MEDIUM',
        relatedData: {
          doctorName,
          appointmentTime,
          hospitalName
        }
      });

      res.json({
        success: true,
        message: 'Appointment reminder sent',
        data: notification
      });

    } catch (error) {
      console.error('Send appointment reminder error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send appointment reminder',
        error: error.message
      });
    }
  }

  async sendLabResultNotification(req, res) {
    try {
      const { userId, testName, hospitalName } = req.body;

      const notification = await this.createSystemNotification(userId, {
        title: 'Hasil Lab Tersedia',
        message: `Hasil pemeriksaan ${testName} sudah dapat dilihat. Klik untuk melihat detail.`,
        type: 'LAB_RESULT',
        priority: 'MEDIUM',
        actionUrl: '/lab/results',
        relatedData: {
          testName,
          hospitalName
        }
      });

      res.json({
        success: true,
        message: 'Lab result notification sent',
        data: notification
      });

    } catch (error) {
      console.error('Send lab result notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send lab result notification',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationController();