-- AlterTable
ALTER TABLE `consultations` ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    MODIFY `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET') NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE `medical_records` MODIFY `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET') NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE `prescriptions` ADD COLUMN `paidAt` DATETIME(3) NULL,
    MODIFY `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET') NOT NULL DEFAULT 'CASH';

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PRESCRIPTION_PAYMENT', 'CONSULTATION_PAYMENT', 'APPOINTMENT_FEE') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `amount` DOUBLE NOT NULL,
    `paymentMethod` ENUM('CASH', 'BPJS', 'INSURANCE', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET') NULL,
    `description` VARCHAR(191) NULL,
    `prescriptionId` VARCHAR(191) NULL,
    `consultationId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transactions_prescriptionId_key`(`prescriptionId`),
    UNIQUE INDEX `transactions_consultationId_key`(`consultationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `prescriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
