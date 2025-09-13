-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'PATIENT', 'DOCTOR', 'ADMIN', 'FAMILY_MEMBER') NOT NULL DEFAULT 'USER',
    `nik` VARCHAR(16) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(15) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `qrCode` VARCHAR(191) NULL,
    `fingerprintData` TEXT NULL,
    `profilePicture` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `lastLogin` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `street` VARCHAR(191) NULL,
    `village` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `regency` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_nik_key`(`nik`),
    UNIQUE INDEX `users_qrCode_key`(`qrCode`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_nik_idx`(`nik`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `family_members` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `relation` ENUM('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'GRANDPARENT', 'SIBLING', 'OTHER') NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `isEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `family_members_userId_idx`(`userId`),
    UNIQUE INDEX `family_members_userId_memberId_key`(`userId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hospital_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'hospital',
    `hospitalName` VARCHAR(191) NOT NULL,
    `hospitalAddress` TEXT NOT NULL,
    `hospitalPhone` VARCHAR(191) NOT NULL,
    `hospitalEmail` VARCHAR(191) NULL,
    `hospitalWebsite` VARCHAR(191) NULL,
    `emergencyNumber` VARCHAR(191) NULL,
    `queuePrefix` VARCHAR(191) NOT NULL DEFAULT 'A',
    `maxQueuePerDay` INTEGER NOT NULL DEFAULT 100,
    `operatingHoursStart` VARCHAR(191) NOT NULL DEFAULT '08:00',
    `operatingHoursEnd` VARCHAR(191) NOT NULL DEFAULT '17:00',
    `queueCallInterval` INTEGER NOT NULL DEFAULT 5,
    `licenseNumber` VARCHAR(191) NULL,
    `accreditationLevel` VARCHAR(191) NULL,
    `hospitalType` VARCHAR(191) NULL,
    `bedCapacity` INTEGER NULL,
    `isInitialized` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctors` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `licenseNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `profilePicture` VARCHAR(191) NULL,
    `consultationFee` DECIMAL(10, 2) NULL,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `isOnDuty` BOOLEAN NOT NULL DEFAULT false,
    `schedule` JSON NULL,
    `bio` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `doctors_userId_key`(`userId`),
    UNIQUE INDEX `doctors_licenseNumber_key`(`licenseNumber`),
    INDEX `doctors_userId_idx`(`userId`),
    INDEX `doctors_specialty_idx`(`specialty`),
    INDEX `doctors_isAvailable_idx`(`isAvailable`),
    INDEX `doctors_isOnDuty_idx`(`isOnDuty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'AI',
    `severity` VARCHAR(191) NULL,
    `urgency` VARCHAR(191) NULL,
    `symptoms` JSON NOT NULL,
    `aiAnalysis` JSON NULL,
    `chatHistory` JSON NULL,
    `doctorNotes` TEXT NULL,
    `recommendation` VARCHAR(191) NULL,
    `prescriptions` JSON NULL,
    `followUpDate` DATETIME(3) NULL,
    `consultationFee` DECIMAL(8, 2) NULL,
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD') NOT NULL DEFAULT 'CASH',
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `rating` INTEGER NULL,
    `feedback` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `consultations_userId_idx`(`userId`),
    INDEX `consultations_type_idx`(`type`),
    INDEX `consultations_severity_idx`(`severity`),
    INDEX `consultations_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `prescriptionCode` VARCHAR(191) NOT NULL,
    `medications` JSON NOT NULL,
    `instructions` TEXT NULL,
    `totalAmount` DECIMAL(10, 2) NULL,
    `pharmacyNotes` TEXT NULL,
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD') NOT NULL DEFAULT 'CASH',
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `isDispensed` BOOLEAN NOT NULL DEFAULT false,
    `dispensedAt` DATETIME(3) NULL,
    `dispensedBy` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prescriptions_prescriptionCode_key`(`prescriptionCode`),
    INDEX `prescriptions_userId_idx`(`userId`),
    INDEX `prescriptions_prescriptionCode_idx`(`prescriptionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `queues` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `consultationId` VARCHAR(191) NULL,
    `queueNumber` VARCHAR(191) NOT NULL,
    `queueType` VARCHAR(191) NOT NULL DEFAULT 'WALK_IN',
    `currentNumber` VARCHAR(191) NULL,
    `status` ENUM('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'WAITING',
    `position` INTEGER NOT NULL,
    `estimatedWaitTime` INTEGER NULL,
    `checkInTime` DATETIME(3) NULL,
    `calledTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `isPriority` BOOLEAN NOT NULL DEFAULT false,
    `queueDate` DATE NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `queues_appointmentId_key`(`appointmentId`),
    UNIQUE INDEX `queues_queueNumber_key`(`queueNumber`),
    INDEX `queues_userId_idx`(`userId`),
    INDEX `queues_queueDate_idx`(`queueDate`),
    INDEX `queues_status_idx`(`status`),
    INDEX `queues_position_idx`(`position`),
    INDEX `queues_queueType_idx`(`queueType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointments` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NULL,
    `appointmentDate` DATETIME(3) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'CONSULTATION',
    `source` VARCHAR(191) NOT NULL DEFAULT 'WALK_IN',
    `status` ENUM('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `queueNumber` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `notes` TEXT NULL,
    `reminderSent` BOOLEAN NOT NULL DEFAULT false,
    `rating` INTEGER NULL,
    `feedback` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `appointments_consultationId_key`(`consultationId`),
    INDEX `appointments_userId_idx`(`userId`),
    INDEX `appointments_doctorId_idx`(`doctorId`),
    INDEX `appointments_appointmentDate_idx`(`appointmentDate`),
    INDEX `appointments_status_idx`(`status`),
    INDEX `appointments_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NULL,
    `visitDate` DATETIME(3) NOT NULL,
    `queueNumber` VARCHAR(191) NULL,
    `diagnosis` TEXT NOT NULL,
    `treatment` TEXT NOT NULL,
    `symptoms` JSON NULL,
    `vitalSigns` JSON NULL,
    `medications` JSON NULL,
    `followUpDate` DATETIME(3) NULL,
    `totalCost` DECIMAL(10, 2) NULL,
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD') NOT NULL DEFAULT 'CASH',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medical_records_consultationId_key`(`consultationId`),
    INDEX `medical_records_userId_idx`(`userId`),
    INDEX `medical_records_doctorId_idx`(`doctorId`),
    INDEX `medical_records_visitDate_idx`(`visitDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lab_results` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `medicalRecordId` VARCHAR(191) NULL,
    `testName` VARCHAR(191) NOT NULL,
    `testType` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `results` JSON NOT NULL,
    `normalRange` JSON NULL,
    `isNormal` BOOLEAN NULL,
    `isCritical` BOOLEAN NOT NULL DEFAULT false,
    `doctorNotes` TEXT NULL,
    `testDate` DATETIME(3) NOT NULL,
    `resultDate` DATETIME(3) NULL,
    `isNew` BOOLEAN NOT NULL DEFAULT true,
    `reportUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lab_results_userId_idx`(`userId`),
    INDEX `lab_results_testDate_idx`(`testDate`),
    INDEX `lab_results_isNew_idx`(`isNew`),
    INDEX `lab_results_isCritical_idx`(`isCritical`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('QUEUE', 'APPOINTMENT', 'LAB_RESULT', 'PAYMENT', 'SYSTEM', 'CONSULTATION') NOT NULL,
    `priority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `actionUrl` VARCHAR(191) NULL,
    `relatedData` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_isRead_idx`(`isRead`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    INDEX `notifications_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `isEditable` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    INDEX `system_configs_key_idx`(`key`),
    INDEX `system_configs_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `family_members` ADD CONSTRAINT `family_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `family_members` ADD CONSTRAINT `family_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctors` ADD CONSTRAINT `doctors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultations` ADD CONSTRAINT `consultations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultations` ADD CONSTRAINT `consultations_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queues` ADD CONSTRAINT `queues_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queues` ADD CONSTRAINT `queues_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queues` ADD CONSTRAINT `queues_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `queues` ADD CONSTRAINT `queues_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_results` ADD CONSTRAINT `lab_results_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_results` ADD CONSTRAINT `lab_results_medicalRecordId_fkey` FOREIGN KEY (`medicalRecordId`) REFERENCES `medical_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
