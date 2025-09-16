const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const cardController = {
    // Get patient cards with pagination and search
    getCards: async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50, // Increased for card display
                search = '', 
                gender,
                isActive 
            } = req.query;
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Build where condition
            const where = {
                role: { in: ['USER', 'PATIENT'] }
            };
            
            if (search) {
                where.OR = [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { nik: { contains: search } },
                    { phone: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            if (gender && gender !== 'ALL') {
                where.gender = gender;
            }
            
            if (isActive !== undefined && isActive !== 'ALL') {
                where.isActive = isActive === 'true' || isActive === 'ACTIVE';
            }

            const [patients, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        fullName: true,
                        nik: true,
                        phone: true,
                        email: true,
                        gender: true,
                        dateOfBirth: true,
                        profilePicture: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true,
                        lastLogin: true,
                        role: true,
                        // Address fields for card
                        street: true,
                        village: true,
                        district: true,
                        regency: true,
                        province: true,
                        // Additional fields that might be useful
                        qrCode: true,
                        fingerprintData: true,
                        emailVerified: true
                    },
                    orderBy: {
                        fullName: 'asc'
                    },
                    skip,
                    take: parseInt(limit)
                }),
                prisma.user.count({ where })
            ]);

            // Format response to match frontend expectations
            const formattedPatients = patients.map(patient => ({
                ...patient,
                // Ensure dates are properly formatted
                dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
                createdAt: patient.createdAt.toISOString(),
                updatedAt: patient.updatedAt.toISOString(),
                lastLogin: patient.lastLogin ? patient.lastLogin.toISOString() : null,
            }));

            const totalPages = Math.ceil(totalCount / parseInt(limit));

            // Match the expected response structure from frontend
            res.json({
                success: true,
                message: 'Patient cards retrieved successfully',
                data: formattedPatients, // Changed from data.patients to data directly
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    limit: parseInt(limit),
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                }
            });
        } catch (error) {
            console.error('Get cards error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat data kartu pasien',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get specific patient card by ID
    getCardById: async (req, res) => {
        try {
            const { id } = req.params;

            const patient = await prisma.user.findFirst({
                where: {
                    id,
                    role: { in: ['USER', 'PATIENT'] }
                },
                select: {
                    id: true,
                    fullName: true,
                    nik: true,
                    phone: true,
                    email: true,
                    gender: true,
                    dateOfBirth: true,
                    profilePicture: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    lastLogin: true,
                    role: true,
                    street: true,
                    village: true,
                    district: true,
                    regency: true,
                    province: true,
                    qrCode: true,
                    fingerprintData: true,
                    emailVerified: true,
                }
            });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Pasien tidak ditemukan'
                });
            }

            // Format dates
            const formattedPatient = {
                ...patient,
                dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
                createdAt: patient.createdAt.toISOString(),
                updatedAt: patient.updatedAt.toISOString(),
                lastLogin: patient.lastLogin ? patient.lastLogin.toISOString() : null,
            };

            res.json({
                success: true,
                message: 'Patient card retrieved successfully',
                data: formattedPatient
            });
        } catch (error) {
            console.error('Get card by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat kartu pasien',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = cardController;