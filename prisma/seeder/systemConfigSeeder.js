const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const systemConfigSeeder = async () => {
  console.log('  ⚙️ Creating system configurations...');

  const configs = [
    // Queue Settings
    {
      key: 'QUEUE_AUTO_CALL_ENABLED',
      value: 'true',
      description: 'Enable automatic queue calling',
      category: 'QUEUE',
      isEditable: true
    },
    {
      key: 'QUEUE_CALL_INTERVAL_MINUTES',
      value: '3',
      description: 'Interval between queue calls in minutes',
      category: 'QUEUE',
      isEditable: true
    },
    {
      key: 'QUEUE_MAX_SKIP_COUNT',
      value: '3',
      description: 'Maximum times a queue can be skipped before cancellation',
      category: 'QUEUE',
      isEditable: true
    },

    // Notification Settings
    {
      key: 'NOTIFICATION_PUSH_ENABLED',
      value: 'true',
      description: 'Enable push notifications',
      category: 'NOTIFICATION',
      isEditable: true
    },
    {
      key: 'NOTIFICATION_EMAIL_ENABLED',
      value: 'false',
      description: 'Enable email notifications',
      category: 'NOTIFICATION',
      isEditable: true
    },
    {
      key: 'NOTIFICATION_SMS_ENABLED',
      value: 'false',
      description: 'Enable SMS notifications',
      category: 'NOTIFICATION',
      isEditable: true
    },

    // AI Settings
    {
      key: 'AI_CONSULTATION_ENABLED',
      value: 'true',
      description: 'Enable AI consultation feature',
      category: 'AI',
      isEditable: true
    },
    {
      key: 'AI_SYMPTOM_ANALYSIS_ENABLED',
      value: 'true',
      description: 'Enable AI symptom analysis',
      category: 'AI',
      isEditable: true
    },

    // Appointment Settings
    {
      key: 'APPOINTMENT_ADVANCE_BOOKING_DAYS',
      value: '30',
      description: 'How many days in advance appointments can be booked',
      category: 'APPOINTMENT',
      isEditable: true
    },
    {
      key: 'APPOINTMENT_REMINDER_HOURS',
      value: '24',
      description: 'Send appointment reminder X hours before',
      category: 'APPOINTMENT',
      isEditable: true
    },

    // Payment Settings
    {
      key: 'PAYMENT_BPJS_ENABLED',
      value: 'true',
      description: 'Enable BPJS payment method',
      category: 'PAYMENT',
      isEditable: true
    },
    {
      key: 'PAYMENT_CREDIT_CARD_ENABLED',
      value: 'true',
      description: 'Enable credit card payment',
      category: 'PAYMENT',
      isEditable: true
    },

    // System Settings
    {
      key: 'SYSTEM_MAINTENANCE_MODE',
      value: 'false',
      description: 'Enable maintenance mode',
      category: 'SYSTEM',
      isEditable: true
    },
    {
      key: 'SYSTEM_VERSION',
      value: '1.0.0',
      description: 'Current system version',
      category: 'SYSTEM',
      isEditable: false
    }
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  console.log(`  ✅ ${configs.length} system configurations created`);
};

module.exports = systemConfigSeeder;