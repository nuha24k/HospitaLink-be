const { PrismaClient } = require('@prisma/client');
const midtransService = require('../services/midtrans');
const prisma = new PrismaClient();

class TransactionController {
  async createPrescriptionPayment(req, res) {
    try {
      const userId = req.user.id;
      const { prescriptionId } = req.params;
      const { useSnapPayment = true } = req.body;

      const prescription = await prisma.prescription.findFirst({
        where: { id: prescriptionId, userId },
        include: {
          doctor: { select: { name: true, specialty: true } },
          user: { 
            select: { 
              fullName: true, 
              email: true, 
              phone: true, 
              street: true, 
              regency: true 
            } 
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

      // Check if transaction already exists
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          prescriptionId: prescriptionId,
          status: { in: ['PENDING', 'PAID'] }
        }
      });

      if (existingTransaction) {
        if (existingTransaction.status === 'PAID') {
          return res.status(400).json({
            success: false,
            message: 'Payment already completed'
          });
        }

        // If pending, return existing transaction details
        if (useSnapPayment && existingTransaction.orderId) {
          try {
            const statusResult = await midtransService.checkTransactionStatus(existingTransaction.orderId);
            
            if (statusResult.transactionStatus === 'settlement' || statusResult.transactionStatus === 'capture') {
              // Update to paid if Midtrans shows paid
              await this.updatePrescriptionPayment(
                prescriptionId,
                'PAID',
                statusResult.paymentType,
                statusResult.grossAmount,
                statusResult.settlementTime,
                existingTransaction.orderId
              );

              return res.json({
                success: true,
                message: 'Payment already completed',
                data: {
                  transactionId: existingTransaction.id,
                  prescriptionId: prescriptionId,
                  status: 'PAID',
                  amount: statusResult.grossAmount
                }
              });
            }

            // Return existing pending transaction
            return res.json({
              success: true,
              message: 'Pending transaction found',
              data: {
                transactionId: existingTransaction.id,
                prescriptionId: prescriptionId,
                orderId: existingTransaction.orderId,
                status: 'PENDING',
                amount: existingTransaction.amount
              }
            });

          } catch (statusError) {
            // If status check fails, delete invalid transaction and create new one
            await prisma.transaction.delete({
              where: { id: existingTransaction.id }
            });
          }
        } else {
          return res.json({
            success: true,
            message: 'Transaction already exists',
            data: {
              transactionId: existingTransaction.id,
              prescriptionId: prescriptionId,
              status: existingTransaction.status,
              amount: existingTransaction.amount,
              paymentMethod: existingTransaction.paymentMethod
            }
          });
        }
      }

      // Parse medications
      let medications = [];
      try {
        const rawMedications = typeof prescription.medications === 'string' 
          ? JSON.parse(prescription.medications) 
          : prescription.medications || [];
        
        if (Array.isArray(rawMedications)) {
          medications = rawMedications.map((med, index) => {
            const basePrice = parseFloat(med.price || 0);
            const quantity = parseInt(med.quantity || 1);
            const totalPrice = basePrice * quantity;
            
            return {
              genericName: med.genericName || med.name || `Medicine ${index + 1}`,
              price: basePrice,
              quantity: quantity,
              totalPrice: totalPrice,
            };
          }).filter(med => med.totalPrice > 0);
        }
      } catch (e) {
        medications = [];
      }

      const medicationTotal = medications.reduce((sum, med) => sum + (med.totalPrice || 0), 0);
      const finalAmount = medicationTotal > 0 ? medicationTotal : (prescription.totalAmount || 0);

      if (useSnapPayment) {
        const prescriptionData = {
          id: prescription.id,
          prescriptionCode: prescription.prescriptionCode,
          totalAmount: finalAmount,
          doctorId: prescription.doctorId,
          medications: medications,
        };

        const midtransResult = await midtransService.createPrescriptionPayment(
          prescriptionData, 
          prescription.user
        );

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            type: 'PRESCRIPTION_PAYMENT',
            status: 'PENDING',
            amount: finalAmount,
            paymentMethod: 'CREDIT_CARD',
            description: `Online payment for prescription ${prescription.prescriptionCode}`,
            prescriptionId,
            orderId: midtransResult.orderId,
          }
        });

        return res.json({
          success: true,
          message: 'Midtrans payment created successfully',
          data: {
            transactionId: transaction.id,
            prescriptionId: prescriptionId,
            snapToken: midtransResult.snapToken,
            redirectUrl: midtransResult.redirectUrl,
            orderId: midtransResult.orderId,
            amount: finalAmount,
          }
        });
      } else {
        const { paymentMethod, amount } = req.body;

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            type: 'PRESCRIPTION_PAYMENT',
            status: 'PAID',
            amount: amount || finalAmount,
            paymentMethod: paymentMethod?.toUpperCase() || 'CASH',
            description: `Direct payment for prescription ${prescription.prescriptionCode}`,
            prescriptionId,
            paidAt: new Date()
          }
        });

        await prisma.prescription.update({
          where: { id: prescriptionId },
          data: {
            isPaid: true,
            paidAt: new Date(),
            totalAmount: amount || finalAmount
          }
        });

        await this.createPaymentNotification(
          userId, 
          prescription.prescriptionCode, 
          transaction.amount, 
          paymentMethod
        );

        return res.json({
          success: true,
          message: 'Direct payment processed successfully',
          data: {
            transaction,
            prescription: {
              ...prescription,
              isPaid: true,
              paidAt: new Date()
            }
          }
        });
      }

    } catch (error) {
      console.error('Create prescription payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process prescription payment',
        error: error.message
      });
    }
  }

  handleMidtransNotification = async (req, res) => {
    try {
      console.log('Midtrans notification received:', req.body);
      
      const notificationResult = await midtransService.handleNotification(req.body);
      
      const {
        orderId,
        finalStatus,
        paymentType,
        grossAmount,
        relatedId,
        paymentTypeField,
        settlementTime
      } = notificationResult;

      console.log('Processing notification:', {
        orderId,
        finalStatus,
        paymentTypeField,
        relatedId
      });

      if (paymentTypeField === 'PRESCRIPTION_PAYMENT') {
        await this.updatePrescriptionPayment(
          relatedId, 
          finalStatus, 
          paymentType, 
          grossAmount, 
          settlementTime,
          orderId
        );
      } else if (paymentTypeField === 'CONSULTATION_PAYMENT') {
        await this.updateConsultationPayment(
          relatedId, 
          finalStatus, 
          paymentType, 
          grossAmount, 
          settlementTime,
          orderId
        );
      }

      res.status(200).json({
        success: true,
        message: 'Notification processed successfully'
      });

    } catch (error) {
      console.error('Midtrans notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process notification',
        error: error.message
      });
    }
  }

  updatePrescriptionPayment = async (prescriptionId, status, paymentType, amount, settlementTime, orderId) => {
    try {
      const convertedPaymentMethod = midtransService.convertPaymentMethod(paymentType);
      
      const updateResult = await prisma.transaction.updateMany({
        where: { 
          prescriptionId: prescriptionId,
          status: 'PENDING',
          ...(orderId && { orderId })
        },
        data: {
          status: status,
          paymentMethod: convertedPaymentMethod,
          amount: parseFloat(amount),
          paidAt: status === 'PAID' ? new Date(settlementTime || Date.now()) : null,
          updatedAt: new Date()
        }
      });

      console.log(`Updated ${updateResult.count} transactions for prescription ${prescriptionId}`);

      if (status === 'PAID') {
        const prescription = await prisma.prescription.update({
          where: { id: prescriptionId },
          data: {
            isPaid: true,
            paidAt: new Date(settlementTime || Date.now()),
            paymentStatus: 'PAID',
            paymentMethod: convertedPaymentMethod,
            updatedAt: new Date()
          }
        });

        await this.createPaymentNotification(
          prescription.userId,
          prescription.prescriptionCode,
          amount,
          convertedPaymentMethod
        );

        console.log('Prescription payment updated successfully');
      }

    } catch (error) {
      console.error('Error updating prescription payment:', error);
      throw error;
    }
  }

  createPaymentNotification = async (userId, prescriptionCode, amount, paymentMethod) => {
    try {
      await prisma.notification.create({
        data: {
          userId: userId,
          title: 'Pembayaran Berhasil',
          message: `Pembayaran resep ${prescriptionCode} sebesar Rp ${new Intl.NumberFormat('id-ID').format(amount)} telah berhasil diproses via ${paymentMethod}.`,
          type: 'PAYMENT',
          priority: 'HIGH',
          relatedData: JSON.stringify({
            prescriptionCode,
            amount,
            paymentMethod,
            action: 'pickup_medication'
          })
        }
      });

      await prisma.notification.create({
        data: {
          userId: userId,
          title: 'Obat Siap Diambil',
          message: `Resep ${prescriptionCode} telah dibayar. Silakan ambil obat di farmasi dalam 2x24 jam.`,
          type: 'SYSTEM',
          priority: 'HIGH',
          relatedData: JSON.stringify({
            prescriptionCode,
            action: 'pickup_medication',
            pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          })
        }
      });

    } catch (error) {
      console.error('Error creating payment notification:', error);
    }
  }

  async getUserTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status, type } = req.query;

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
                doctor: { select: { name: true, specialty: true } }
              }
            },
            consultation: {
              include: {
                doctor: { select: { name: true, specialty: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.transaction.count({ where })
      ]);

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
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions',
        error: error.message
      });
    }
  }

  async getPendingPayments(req, res) {
    try {
      const userId = req.user.id;

      const unpaidPrescriptions = await prisma.prescription.findMany({
        where: {
          userId,
          isPaid: false,
          totalAmount: { gt: 0 }
        },
        include: {
          doctor: { select: { name: true, specialty: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        message: 'Pending payments retrieved successfully',
        data: {
          prescriptions: unpaidPrescriptions,
          totalAmount: unpaidPrescriptions.reduce((sum, p) => sum + (p.totalAmount || 0), 0)
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get pending payments',
        error: error.message
      });
    }
  }

  async getTransactionById(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await prisma.transaction.findFirst({
        where: { id: transactionId, userId },
        include: {
          prescription: {
            include: {
              doctor: { select: { name: true, specialty: true } }
            }
          },
          consultation: {
            include: {
              doctor: { select: { name: true, specialty: true } }
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
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction',
        error: error.message
      });
    }
  }

  createConsultationPayment = async (req, res) => {
    try {
      const userId = req.user.id;
      const { consultationId } = req.params;
      const { useSnapPayment = true } = req.body;

      console.log('🏥 Creating consultation payment:', { userId, consultationId, useSnapPayment });

      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId, userId },
        include: {
          doctor: { select: { name: true, specialty: true } },
          user: { 
            select: { 
              fullName: true, 
              email: true, 
              phone: true, 
              street: true, 
              regency: true 
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

      if (consultation.isPaid) {
        return res.status(400).json({
          success: false,
          message: 'Consultation already paid'
        });
      }

      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          consultationId: consultationId,
          status: { in: ['PENDING', 'PAID'] }
        }
      });

      if (existingTransaction && existingTransaction.status === 'PAID') {
        return res.status(400).json({
          success: false,
          message: 'Payment already completed'
        });
      }

      const consultationFee = consultation.consultationFee || 25000;

      if (useSnapPayment) {
        console.log('🏦 Creating Midtrans payment for consultation...');

        const consultationData = {
          id: consultation.id,
          consultationFee: consultationFee,
          doctorId: consultation.doctorId,
          doctorName: consultation.doctor?.name || 'Unknown Doctor',
        };

        const midtransResult = await midtransService.createConsultationPayment(
          consultationData, 
          consultation.user
        );

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            type: 'CONSULTATION_PAYMENT',
            status: 'PENDING',
            amount: consultationFee,
            paymentMethod: 'CREDIT_CARD',
            description: `Online payment for consultation with ${consultation.doctor?.name}`,
            consultationId,
            orderId: midtransResult.orderId,
          }
        });

        console.log('✅ Midtrans consultation payment created:', transaction.id);

        return res.json({
          success: true,
          message: 'Midtrans payment created successfully',
          data: {
            transactionId: transaction.id,
            consultationId: consultationId,
            snapToken: midtransResult.snapToken,
            redirectUrl: midtransResult.redirectUrl,
            orderId: midtransResult.orderId,
            amount: consultationFee,
          }
        });
      } else {
        // Direct payment
        const { paymentMethod } = req.body;

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            type: 'CONSULTATION_PAYMENT',
            status: 'PAID',
            amount: consultationFee,
            paymentMethod: paymentMethod?.toUpperCase() || 'CASH',
            description: `Direct payment for consultation with ${consultation.doctor?.name}`,
            consultationId,
            paidAt: new Date()
          }
        });

        await prisma.consultation.update({
          where: { id: consultationId },
          data: {
            isPaid: true,
            paidAt: new Date(),
            paymentStatus: 'PAID'
          }
        });

        console.log('✅ Direct consultation payment processed:', transaction.id);

        return res.json({
          success: true,
          message: 'Direct payment processed successfully',
          data: {
            transaction,
            consultation: {
              ...consultation,
              isPaid: true,
              paidAt: new Date()
            }
          }
        });
      }

    } catch (error) {
      console.error('❌ Create consultation payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process consultation payment',
        error: error.message
      });
    }
  }

  async checkPaymentStatus(req, res) {
    try {
      const { orderId } = req.params;
      const statusResult = await midtransService.checkTransactionStatus(orderId);
      
      res.json({
        success: true,
        message: 'Payment status retrieved successfully',
        data: statusResult
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check payment status',
        error: error.message
      });
    }
  }

  async getAllTransactions(req, res) {
    try {
      res.status(501).json({
        success: false,
        message: 'Admin transactions not implemented yet'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get all transactions',
        error: error.message
      });
    }
  }

  updateConsultationPayment = async (consultationId, status, paymentType, amount, settlementTime, orderId) => {
    try {
      const convertedPaymentMethod = midtransService.convertPaymentMethod(paymentType);
      
      const updateResult = await prisma.transaction.updateMany({
        where: { 
          consultationId: consultationId,
          status: 'PENDING',
          ...(orderId && { orderId })
        },
        data: {
          status: status,
          paymentMethod: convertedPaymentMethod,
          amount: parseFloat(amount),
          paidAt: status === 'PAID' ? new Date(settlementTime || Date.now()) : null,
          updatedAt: new Date()
        }
      });

      console.log(`Updated ${updateResult.count} transactions for consultation ${consultationId}`);

      if (status === 'PAID') {
        const consultation = await prisma.consultation.update({
          where: { id: consultationId },
          data: {
            isPaid: true,
            paidAt: new Date(settlementTime || Date.now()),
            paymentStatus: 'PAID',
            updatedAt: new Date()
          },
          include: {
            doctor: { select: { name: true } }
          }
        });

        await prisma.notification.create({
          data: {
            userId: consultation.userId,
            title: 'Pembayaran Konsultasi Berhasil',
            message: `Pembayaran konsultasi dengan ${consultation.doctor?.name} sebesar Rp ${new Intl.NumberFormat('id-ID').format(amount)} telah berhasil diproses.`,
            type: 'PAYMENT',
            priority: 'HIGH',
            relatedData: JSON.stringify({
              consultationId,
              amount,
              paymentMethod: convertedPaymentMethod,
              action: 'start_chat'
            })
          }
        });

        console.log('Consultation payment updated successfully');
      }

    } catch (error) {
      console.error('Error updating consultation payment:', error);
      throw error;
    }
  }
}

module.exports = new TransactionController();