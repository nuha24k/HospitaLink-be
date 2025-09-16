const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TransactionController {
  // Get all transactions for a user
  async getUserTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status, type } = req.query;

      console.log('💰 Getting transactions for user:', userId);

      const where = {
        userId,
        ...(status && { status }),
        ...(type && { type })
      };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            prescription: {
              include: {
                doctor: {
                  select: { name: true, specialty: true }
                }
              }
            },
            consultation: {
              include: {
                doctor: {
                  select: { name: true, specialty: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.transaction.count({ where })
      ]);

      console.log('💰 Found', transactions.length, 'transactions');

      res.json({
        success: true,
        message: 'Transactions retrieved successfully',
        data: transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('❌ Get transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions',
        error: error.message
      });
    }
  }

  // Create prescription payment
  async createPrescriptionPayment(req, res) {
    try {
      const userId = req.user.id;
      const { prescriptionId } = req.params;
      const { paymentMethod, amount } = req.body;

      console.log('💊 Creating prescription payment:', { prescriptionId, paymentMethod, amount });

      // Check if prescription exists and belongs to user
      const prescription = await prisma.prescription.findFirst({
        where: {
          id: prescriptionId,
          userId
        },
        include: {
          doctor: {
            select: { name: true, specialty: true }
          }
        }
      });

      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      if (prescription.isPaid) {
        return res.status(400).json({
          success: false,
          message: 'Prescription already paid'
        });
      }

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: 'PRESCRIPTION_PAYMENT',
          status: 'PAID', // For MVP, assume immediate payment
          amount: amount || prescription.totalAmount || 0,
          paymentMethod,
          description: `Payment for prescription from Dr. ${prescription.doctor.name}`,
          prescriptionId,
          paidAt: new Date()
        }
      });

      // Update prescription status
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          totalAmount: amount || prescription.totalAmount || 0
        }
      });

      console.log('✅ Prescription payment created:', transaction.id);

      res.json({
        success: true,
        message: 'Prescription payment successful',
        data: {
          transaction,
          prescription: {
            ...prescription,
            isPaid: true,
            paidAt: new Date()
          }
        }
      });

    } catch (error) {
      console.error('❌ Create prescription payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process prescription payment',
        error: error.message
      });
    }
  }

  // Create consultation payment
  async createConsultationPayment(req, res) {
    try {
      const userId = req.user.id;
      const { consultationId } = req.params;
      const { paymentMethod, amount } = req.body;

      console.log('💬 Creating consultation payment:', { consultationId, paymentMethod, amount });

      // Check if consultation exists and belongs to user
      const consultation = await prisma.consultation.findFirst({
        where: {
          id: consultationId,
          userId
        },
        include: {
          doctor: {
            select: { name: true, specialty: true }
          }
        }
      });

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: 'Consultation not found'
        });
      }

      if (consultation.isPaid) {
        return res.status(400).json({
          success: false,
          message: 'Consultation already paid'
        });
      }

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: 'CONSULTATION_PAYMENT',
          status: 'PAID', // For MVP, assume immediate payment
          amount: amount || consultation.consultationFee || 50000, // Default fee
          paymentMethod,
          description: `Online consultation fee with Dr. ${consultation.doctor.name}`,
          consultationId,
          paidAt: new Date()
        }
      });

      // Update consultation status
      await prisma.consultation.update({
        where: { id: consultationId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          consultationFee: amount || consultation.consultationFee || 50000
        }
      });

      console.log('✅ Consultation payment created:', transaction.id);

      res.json({
        success: true,
        message: 'Consultation payment successful',
        data: {
          transaction,
          consultation: {
            ...consultation,
            isPaid: true,
            paidAt: new Date()
          }
        }
      });

    } catch (error) {
      console.error('❌ Create consultation payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process consultation payment',
        error: error.message
      });
    }
  }

  // Get pending payments for user
  async getPendingPayments(req, res) {
    try {
      const userId = req.user.id;

      console.log('⏳ Getting pending payments for user:', userId);

      // Get unpaid prescriptions
      const unpaidPrescriptions = await prisma.prescription.findMany({
        where: {
          userId,
          isPaid: false
        },
        include: {
          doctor: {
            select: { name: true, specialty: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get unpaid consultations  
      const unpaidConsultations = await prisma.consultation.findMany({
        where: {
          userId,
          isPaid: false,
          status: 'COMPLETED' // Only completed consultations need payment
        },
        include: {
          doctor: {
            select: { name: true, specialty: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log('⏳ Found pending payments:', {
        prescriptions: unpaidPrescriptions.length,
        consultations: unpaidConsultations.length
      });

      res.json({
        success: true,
        message: 'Pending payments retrieved successfully',
        data: {
          prescriptions: unpaidPrescriptions,
          consultations: unpaidConsultations,
          totalAmount: [
            ...unpaidPrescriptions.map(p => p.totalAmount || 0),
            ...unpaidConsultations.map(c => c.consultationFee || 50000)
          ].reduce((sum, amount) => sum + amount, 0)
        }
      });

    } catch (error) {
      console.error('❌ Get pending payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending payments',
        error: error.message
      });
    }
  }

  // Get transaction by ID
  async getTransactionById(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      console.log('🔍 Getting transaction:', transactionId);

      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId
        },
        include: {
          prescription: {
            include: {
              doctor: {
                select: { name: true, specialty: true }
              }
            }
          },
          consultation: {
            include: {
              doctor: {
                select: { name: true, specialty: true }
              }
            }
          }
        }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      res.json({
        success: true,
        message: 'Transaction retrieved successfully',
        data: transaction
      });

    } catch (error) {
      console.error('❌ Get transaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction',
        error: error.message
      });
    }
  }

  // Admin: Get all transactions
  async getAllTransactions(req, res) {
    try {
      const { page = 1, limit = 20, status, type, startDate, endDate } = req.query;

      console.log('👨‍💼 Admin getting all transactions');

      const where = {
        ...(status && { status }),
        ...(type && { type }),
        ...(startDate && endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
      };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            user: {
              select: { fullName: true, email: true, phone: true }
            },
            prescription: {
              include: {
                doctor: {
                  select: { name: true, specialty: true }
                }
              }
            },
            consultation: {
              include: {
                doctor: {
                  select: { name: true, specialty: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.transaction.count({ where })
      ]);

      // Calculate summary
      const summary = await prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true }
      });

      console.log('👨‍💼 Found', transactions.length, 'transactions');

      res.json({
        success: true,
        message: 'All transactions retrieved successfully',
        data: transactions,
        summary: {
          totalAmount: summary._sum.amount || 0,
          totalTransactions: summary._count._all || 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('❌ Get all transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get all transactions',
        error: error.message
      });
    }
  }
}

module.exports = new TransactionController();