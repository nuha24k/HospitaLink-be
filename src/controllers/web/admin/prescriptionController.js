const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to calculate total prescription cost
const calculatePrescriptionTotal = (medications) => {
    return medications.reduce((total, med) => {
        const quantity = parseInt(med.quantity) || 1;
        const price = parseFloat(med.pricePerUnit) || 0;
        return total + (quantity * price);
    }, 0);
};

// Search medications for prescription - FIXED for MySQL
const searchMedications = async (req, res) => {
    try {
        const { q: query, category, limit = 20 } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Query minimal 2 karakter'
            });
        }

        // For MySQL, we use simple contains without mode
        const whereCondition = {
            isActive: true,
            OR: [
                { genericName: { contains: query } },
                { brandName: { contains: query } },
                { medicationCode: { contains: query } }
            ]
        };

        if (category) {
            whereCondition.category = category;
        }

        const medications = await prisma.medication.findMany({
            where: whereCondition,
            select: {
                id: true,
                medicationCode: true,
                genericName: true,
                brandName: true,
                category: true,
                dosageForm: true,
                strength: true,
                unit: true,
                pricePerUnit: true,
                stock: true,
                indications: true,
                dosageInstructions: true,
                requiresPrescription: true,
                isControlled: true
            },
            orderBy: [
                { genericName: 'asc' }
            ],
            take: parseInt(limit)
        });

        res.json({
            success: true,
            message: 'Medications found',
            data: {
                medications,
                query,
                total: medications.length
            }
        });

    } catch (error) {
        console.error('Search medications error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mencari obat'
        });
    }
};

// Get medication categories
const getMedicationCategories = async (req, res) => {
    try {
        const categories = await prisma.medication.groupBy({
            by: ['category'],
            where: { isActive: true },
            _count: {
                id: true
            },
            orderBy: {
                category: 'asc'
            }
        });

        res.json({
            success: true,
            message: 'Categories retrieved',
            data: categories.map(cat => ({
                category: cat.category,
                count: cat._count.id
            }))
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat kategori obat'
        });
    }
};

// Get medication detail
const getMedicationDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const medication = await prisma.medication.findFirst({
            where: {
                id,
                isActive: true
            }
        });

        if (!medication) {
            return res.status(404).json({
                success: false,
                message: 'Obat tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Medication detail retrieved',
            data: medication
        });

    } catch (error) {
        console.error('Get medication detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat detail obat'
        });
    }
};


// Get prescription by code for admin
const getPrescriptionByCode = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Kode resep harus diisi'
            });
        }

        const prescription = await prisma.prescription.findFirst({
            where: {
                prescriptionCode: code.trim().toUpperCase()
            },
            include: {
                user: {
                    select: {
                        fullName: true,
                        phone: true,
                        nik: true,
                        gender: true,
                        dateOfBirth: true,
                    },
                },
                consultation: {
                    select: {
                        type: true,
                        severity: true,
                        symptoms: true,
                        recommendation: true,
                    },
                },
                appointment: {
                    select: {
                        appointmentDate: true,
                        type: true,
                    },
                },
                doctor: {
                    select: {
                        name: true,
                        specialty: true,
                        licenseNumber: true
                    }
                }
            },
        });

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Resep dengan kode tersebut tidak ditemukan'
            });
        }

        // Check if prescription is expired
        const isExpired = new Date() > new Date(prescription.expiresAt);

        res.json({
            success: true,
            message: 'Detail resep berhasil dimuat',
            data: {
                ...prescription,
                isExpired,
                daysUntilExpiry: isExpired ? 0 : Math.ceil((new Date(prescription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
            }
        });

    } catch (error) {
        console.error('Get prescription by code error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat detail resep'
        });
    }
};

// Update prescription payment status
const updatePrescriptionPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus, paymentMethod, pharmacyNotes } = req.body;

        const prescription = await prisma.prescription.findFirst({
            where: { id }
        });

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Resep tidak ditemukan'
            });
        }

        const updatedPrescription = await prisma.prescription.update({
            where: { id },
            data: {
                paymentStatus: paymentStatus || prescription.paymentStatus,
                paymentMethod: paymentMethod || prescription.paymentMethod,
                pharmacyNotes: pharmacyNotes || prescription.pharmacyNotes,
                isPaid: paymentStatus === 'PAID',
                updatedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        fullName: true,
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

        // Create notification if paid
        if (paymentStatus === 'PAID') {
            await prisma.notification.create({
                data: {
                    userId: prescription.userId,
                    title: 'Pembayaran Resep Berhasil',
                    message: `Pembayaran resep ${prescription.prescriptionCode} telah berhasil diproses. Obat dapat diambil di apotek.`,
                    type: 'SYSTEM',
                    priority: 'MEDIUM',
                    actionUrl: `/prescription/${prescription.id}`
                },
            });
        }

        res.json({
            success: true,
            message: 'Status pembayaran resep berhasil diperbarui',
            data: updatedPrescription
        });

    } catch (error) {
        console.error('Update prescription payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui status pembayaran'
        });
    }
};

// Dispense prescription
const dispensePrescription = async (req, res) => {
    try {
        const { id } = req.params;
        const { pharmacyNotes } = req.body;

        const prescription = await prisma.prescription.findFirst({
            where: { id },
            include: {
                user: {
                    select: {
                        fullName: true
                    }
                }
            }
        });

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Resep tidak ditemukan'
            });
        }

        if (!prescription.isPaid) {
            return res.status(400).json({
                success: false,
                message: 'Resep belum dibayar, tidak dapat diserahkan'
            });
        }

        if (prescription.isDispensed) {
            return res.status(400).json({
                success: false,
                message: 'Resep sudah pernah diserahkan'
            });
        }

        // Check if prescription is expired
        if (new Date() > new Date(prescription.expiresAt)) {
            return res.status(400).json({
                success: false,
                message: 'Resep sudah kadaluarsa'
            });
        }

        const updatedPrescription = await prisma.prescription.update({
            where: { id },
            data: {
                isDispensed: true,
                dispensedAt: new Date(),
                dispensedBy: req.user.fullName,
                pharmacyNotes: pharmacyNotes || prescription.pharmacyNotes,
                updatedAt: new Date()
            }
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: prescription.userId,
                title: 'Obat Telah Diserahkan',
                message: `Obat untuk resep ${prescription.prescriptionCode} telah diserahkan. Pastikan minum obat sesuai petunjuk dokter.`,
                type: 'SYSTEM',
                priority: 'MEDIUM'
            },
        });

        res.json({
            success: true,
            message: 'Resep berhasil diserahkan',
            data: updatedPrescription
        });

    } catch (error) {
        console.error('Dispense prescription error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menyerahkan resep'
        });
    }
};

// Get prescription detail by ID
const getPrescriptionDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const prescription = await prisma.prescription.findFirst({
            where: { id },
            include: {
                user: {
                    select: {
                        fullName: true,
                        phone: true,
                        nik: true,
                        gender: true,
                        dateOfBirth: true,
                    },
                },
                consultation: {
                    select: {
                        type: true,
                        severity: true,
                        symptoms: true,
                        recommendation: true,
                    },
                },
                appointment: {
                    select: {
                        appointmentDate: true,
                        type: true,
                    },
                },
                doctor: {
                    select: {
                        name: true,
                        specialty: true,
                        licenseNumber: true
                    }
                }
            },
        });

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Resep tidak ditemukan'
            });
        }

        // Check if prescription is expired
        const isExpired = new Date() > new Date(prescription.expiresAt);

        res.json({
            success: true,
            message: 'Detail resep berhasil dimuat',
            data: {
                ...prescription,
                isExpired,
                daysUntilExpiry: isExpired ? 0 : Math.ceil((new Date(prescription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
            }
        });

    } catch (error) {
        console.error('Get prescription detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat detail resep'
        });
    }
};

// Get prescription history with filters
const getPrescriptionHistory = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            startDate, 
            endDate, 
            status, 
            paymentStatus,
            isDispensed 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Build where condition
        const whereCondition = {};

        if (startDate && endDate) {
            whereCondition.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (paymentStatus) {
            whereCondition.paymentStatus = paymentStatus;
        }

        if (isDispensed !== undefined) {
            whereCondition.isDispensed = isDispensed === 'true';
        }

        // Get prescriptions with pagination
        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where: whereCondition,
                include: {
                    user: {
                        select: {
                            fullName: true,
                            phone: true,
                            nik: true,
                            gender: true,
                        },
                    },
                    doctor: {
                        select: {
                            name: true,
                            specialty: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: parseInt(limit),
            }),
            prisma.prescription.count({ where: whereCondition })
        ]);

        // Calculate summary
        const summary = await prisma.prescription.aggregate({
            where: whereCondition,
            _count: {
                id: true
            },
            _sum: {
                totalAmount: true
            }
        });

        const paidCount = await prisma.prescription.count({
            where: { ...whereCondition, isPaid: true }
        });

        const dispensedCount = await prisma.prescription.count({
            where: { ...whereCondition, isDispensed: true }
        });

        const pendingCount = await prisma.prescription.count({
            where: { ...whereCondition, paymentStatus: 'PENDING' }
        });

        res.json({
            success: true,
            message: 'Riwayat resep berhasil dimuat',
            data: {
                prescriptions,
                summary: {
                    total: summary._count.id,
                    paid: paidCount,
                    dispensed: dispensedCount,
                    pending: pendingCount,
                    totalValue: summary._sum.totalAmount || 0
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get prescription history error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat riwayat resep'
        });
    }
};

module.exports = {
    searchMedications,
    getMedicationCategories,
    getMedicationDetail,
    getPrescriptionByCode,
    getPrescriptionDetail,
    getPrescriptionHistory,
    updatePrescriptionPayment,
    dispensePrescription,
};