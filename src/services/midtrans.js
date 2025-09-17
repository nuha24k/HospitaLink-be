const midtransClient = require('midtrans-client');

class MidtransService {
  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });

    this.coreApi = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }

  async createPrescriptionPayment(prescriptionData, userData) {
    try {
      const orderId = this._generateOrderId('RX', prescriptionData.id);
      const totalAmount = Math.round(prescriptionData.totalAmount || 0);
      
      // Filter valid medications and ensure they have prices
      const validMedications = prescriptionData.medications.filter(med => 
        med.genericName && 
        med.genericName !== 'Unknown Medicine' && 
        med.totalPrice > 0
      );

      console.log('💊 Valid medications:', validMedications.length);
      console.log('💰 Total amount:', totalAmount);

      let itemDetails = [];
      let calculatedTotal = 0;

      // If we have valid medications with prices, use them
      if (validMedications.length > 0) {
        itemDetails = validMedications.slice(0, 10).map((med, index) => {
          const price = Math.round(med.totalPrice || 0);
          calculatedTotal += price;
          
          return {
            id: `med-${index + 1}`,
            price: price,
            quantity: 1,
            name: med.genericName.substring(0, 50),
            category: 'Medication',
          };
        });
      } else {
        // If no valid medications, create a single prescription item
        itemDetails = [{
          id: prescriptionData.prescriptionCode || prescriptionData.id.substring(0, 20),
          price: totalAmount,
          quantity: 1,
          name: `Resep ${prescriptionData.prescriptionCode}`,
          brand: 'HospitaLink',
          category: 'Prescription',
          merchant_name: 'HospitaLink Pharmacy',
        }];
        calculatedTotal = totalAmount;
      }

      // Ensure gross_amount equals sum of item_details
      const finalGrossAmount = calculatedTotal > 0 ? calculatedTotal : totalAmount;

      console.log('📊 Item details total:', calculatedTotal);
      console.log('📊 Final gross amount:', finalGrossAmount);
      console.log('📋 Item details:', itemDetails);

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: finalGrossAmount,
        },
        credit_card: {
          secure: true,
        },
        item_details: itemDetails,
        customer_details: {
          first_name: this._sanitizeName(userData.fullName?.split(' ')[0] || 'Patient'),
          last_name: this._sanitizeName(userData.fullName?.split(' ').slice(1).join(' ') || ''),
          email: userData.email,
          phone: this._sanitizePhone(userData.phone),
          billing_address: {
            first_name: this._sanitizeName(userData.fullName?.split(' ')[0] || 'Patient'),
            last_name: this._sanitizeName(userData.fullName?.split(' ').slice(1).join(' ') || ''),
            email: userData.email,
            phone: this._sanitizePhone(userData.phone),
            address: userData.street?.substring(0, 200) || 'Alamat tidak tersedia',
            city: userData.regency?.substring(0, 50) || 'Kota tidak tersedia',
            postal_code: '12345',
            country_code: 'IDN',
          },
        },
        enabled_payments: [
          'credit_card', 
          'bca_va', 
          'bni_va', 
          'bri_va', 
          'mandiri_va',
          'permata_va',
          'other_va',
          'gopay',
          'shopeepay',
          'qris'
        ],
        custom_field1: prescriptionData.id,
        custom_field2: 'PRESCRIPTION_PAYMENT',
        custom_field3: prescriptionData.doctorId,
      };

      console.log('🏦 Final parameter:', JSON.stringify(parameter, null, 2));

      const transaction = await this.snap.createTransaction(parameter);
      
      return {
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId: orderId,
      };

    } catch (error) {
      console.error('❌ Midtrans payment creation error:', error);
      throw new Error(`Failed to create Midtrans payment: ${error.message}`);
    }
  }

  async createConsultationPayment(consultationData, userData) {
    try {
      const orderId = this._generateOrderId('CS', consultationData.id);
      const amount = Math.round(consultationData.consultationFee || 50000);
      
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        credit_card: {
          secure: true,
        },
        item_details: [
          {
            id: consultationData.id.substring(0, 20),
            price: amount,
            quantity: 1,
            name: `Konsultasi Dr. ${consultationData.doctorName || 'Unknown'}`.substring(0, 50),
            brand: 'HospitaLink',
            category: 'Consultation',
            merchant_name: 'HospitaLink Medical',
          },
        ],
        customer_details: {
          first_name: this._sanitizeName(userData.fullName?.split(' ')[0] || 'Patient'),
          last_name: this._sanitizeName(userData.fullName?.split(' ').slice(1).join(' ') || ''),
          email: userData.email,
          phone: this._sanitizePhone(userData.phone),
        },
        enabled_payments: [
          'credit_card', 
          'bca_va', 
          'bni_va', 
          'bri_va', 
          'mandiri_va',
          'gopay',
          'shopeepay',
          'qris'
        ],
        custom_field1: consultationData.id,
        custom_field2: 'CONSULTATION_PAYMENT',
        custom_field3: consultationData.doctorId,
      };

      const transaction = await this.snap.createTransaction(parameter);
      
      return {
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId: orderId,
      };

    } catch (error) {
      console.error('❌ Midtrans consultation payment error:', error);
      throw new Error(`Failed to create consultation payment: ${error.message}`);
    }
  }

  async checkTransactionStatus(orderId) {
    try {
      const statusResponse = await this.coreApi.transaction.status(orderId);
      
      return {
        orderId: statusResponse.order_id,
        transactionStatus: statusResponse.transaction_status,
        fraudStatus: statusResponse.fraud_status,
        paymentType: statusResponse.payment_type,
        grossAmount: statusResponse.gross_amount,
        transactionTime: statusResponse.transaction_time,
        settlementTime: statusResponse.settlement_time,
        customField1: statusResponse.custom_field1,
        customField2: statusResponse.custom_field2,
      };

    } catch (error) {
      console.error('❌ Error checking transaction status:', error);
      throw new Error(`Failed to check transaction status: ${error.message}`);
    }
  }

  async handleNotification(notificationBody) {
    try {
      const statusResponse = await this.coreApi.transaction.notification(notificationBody);
      
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const paymentType = statusResponse.payment_type;
      const grossAmount = parseFloat(statusResponse.gross_amount);
      
      const relatedId = statusResponse.custom_field1;
      const paymentTypeField = statusResponse.custom_field2;

      let finalStatus = 'PENDING';
      
      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          finalStatus = 'PAID';
        }
      } else if (transactionStatus === 'settlement') {
        finalStatus = 'PAID';
      } else if (transactionStatus === 'cancel' || 
                 transactionStatus === 'deny' || 
                 transactionStatus === 'expire') {
        finalStatus = 'FAILED';
      }

      return {
        orderId,
        transactionStatus,
        fraudStatus,
        paymentType,
        grossAmount,
        finalStatus,
        relatedId,
        paymentTypeField,
        settlementTime: statusResponse.settlement_time,
      };

    } catch (error) {
      console.error('❌ Error handling Midtrans notification:', error);
      throw new Error(`Failed to handle notification: ${error.message}`);
    }
  }

  convertPaymentMethod(midtransPaymentType) {
    const paymentMap = {
      'credit_card': 'CREDIT_CARD',
      'bank_transfer': 'BANK_TRANSFER',
      'bca_va': 'BANK_TRANSFER',
      'bni_va': 'BANK_TRANSFER',
      'bri_va': 'BANK_TRANSFER',
      'mandiri_va': 'BANK_TRANSFER',
      'permata_va': 'BANK_TRANSFER',
      'other_va': 'BANK_TRANSFER',
      'gopay': 'E_WALLET',
      'shopeepay': 'E_WALLET',
      'qris': 'E_WALLET',
      'indomaret': 'CASH',
      'alfamart': 'CASH',
    };

    return paymentMap[midtransPaymentType] || 'BANK_TRANSFER';
  }

  _generateOrderId(prefix, id) {
    const timestamp = Date.now().toString().slice(-8);
    const shortId = id.replace(/-/g, '').substring(0, 12);
    return `${prefix}${timestamp}${shortId}`.substring(0, 50);
  }

  _sanitizeName(name) {
    return name?.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50) || 'Patient';
  }

  _sanitizePhone(phone) {
    if (!phone) return '+6281234567890';
    
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }
    
    return '+' + cleanPhone;
  }
}

module.exports = new MidtransService();