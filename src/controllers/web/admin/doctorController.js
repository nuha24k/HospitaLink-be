const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const doctorController = {
    // Get all doctors
    getDoctors: async (req, res) => {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const where = {
                role: 'DOCTOR',
                ...(search && {
                    OR: [
                        { fullName: { contains: search, mode: 'insensitive' } },
                        { nik: { contains: search } },
                        { phone: { contains: search } },
                        { email: { contains: search } }
                    ]
                })
            };

            const [doctors, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        nik: true,
                        phone: true,
                        gender: true,
                        isActive: true,
                        emailVerified: true,
                        createdAt: true,
                        doctorProfile: {
                            select: {
                                licenseNumber: true,
                                specialty: true,
                                consultationFee: true,
                                isAvailable: true,
                                isOnDuty: true
                            }
                        }
                    },
                    orderBy: { fullName: 'asc' },
                    skip,
                    take: parseInt(limit)
                }),
                prisma.user.count({ where })
            ]);

            const totalPages = Math.ceil(totalCount / parseInt(limit));

            res.json({
                success: true,
                message: 'Doctors retrieved successfully',
                data: {
                    doctors,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalCount,
                        hasNext: parseInt(page) < totalPages,
                        hasPrev: parseInt(page) > 1
                    }
                }
            });
        } catch (error) {
            console.error('Get doctors error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat data dokter'
            });
        }
    },

    // Get doctor by ID
    getDoctorById: async (req, res) => {
        try {
            const { id } = req.params;

            const doctor = await prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    nik: true,
                    phone: true,
                    gender: true,
                    dateOfBirth: true,
                    profilePicture: true,
                    isActive: true,
                    emailVerified: true,
                    street: true,
                    village: true,
                    district: true,
                    regency: true,
                    province: true,
                    createdAt: true,
                    updatedAt: true,
                    doctorProfile: {
                        select: {
                            licenseNumber: true,
                            name: true,
                            specialty: true,
                            consultationFee: true,
                            isAvailable: true,
                            isOnDuty: true,
                            bio: true,
                            schedule: true
                        }
                    }
                }
            });

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Dokter tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'Doctor retrieved successfully',
                data: doctor
            });
        } catch (error) {
            console.error('Get doctor by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat data dokter'
            });
        }
    },

    // Create new doctor
    createDoctor: async (req, res) => {
        try {
            const {
                email,
                password,
                fullName,
                nik,
                phone,
                gender,
                dateOfBirth,
                street,
                village,
                district,
                regency,
                province,
                // Doctor specific fields
                licenseNumber,
                specialty,
                consultationFee,
                bio,
                schedule
            } = req.body;

            // Check if email or NIK already exists
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email },
                        ...(nik ? [{ nik }] : [])
                    ]
                }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email atau NIK sudah terdaftar'
                });
            }

            // Check if license number already exists
            const existingDoctor = await prisma.doctor.findFirst({
                where: { licenseNumber }
            });

            if (existingDoctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Nomor lisensi dokter sudah terdaftar'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user and doctor profile in transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create user
                const user = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        role: 'DOCTOR',
                        fullName,
                        nik,
                        phone,
                        gender,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                        street,
                        village,
                        district,
                        regency,
                        province,
                        emailVerified: true
                    }
                });

                // Create doctor profile
                const doctorProfile = await tx.doctor.create({
                    data: {
                        userId: user.id,
                        licenseNumber,
                        name: fullName,
                        specialty,
                        phone,
                        email,
                        consultationFee: consultationFee ? parseFloat(consultationFee) : null,
                        bio,
                        schedule: schedule ? JSON.parse(schedule) : null
                    }
                });

                return { user, doctorProfile };
            });

            res.status(201).json({
                success: true,
                message: 'Dokter berhasil ditambahkan',
                data: {
                    id: result.user.id,
                    email: result.user.email,
                    fullName: result.user.fullName,
                    licenseNumber: result.doctorProfile.licenseNumber,
                    specialty: result.doctorProfile.specialty
                }
            });
        } catch (error) {
            console.error('Create doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menambahkan dokter'
            });
        }
    },

    // Update doctor
    updateDoctor: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                fullName,
                nik,
                phone,
                gender,
                dateOfBirth,
                street,
                village,
                district,
                regency,
                province,
                // Doctor specific fields
                licenseNumber,
                specialty,
                consultationFee,
                bio,
                schedule,
                isAvailable,
                isOnDuty
            } = req.body;

            // Check if doctor exists
            const existingUser = await prisma.user.findUnique({
                where: { id },
                include: { doctorProfile: true }
            });

            if (!existingUser || existingUser.role !== 'DOCTOR') {
                return res.status(404).json({
                    success: false,
                    message: 'Dokter tidak ditemukan'
                });
            }

            // Check if NIK is being changed and already exists
            if (nik && nik !== existingUser.nik) {
                const nikExists = await prisma.user.findFirst({
                    where: { nik, id: { not: id } }
                });

                if (nikExists) {
                    return res.status(400).json({
                        success: false,
                        message: 'NIK sudah terdaftar'
                    });
                }
            }

            // Check if license number is being changed and already exists
            if (licenseNumber && licenseNumber !== existingUser.doctorProfile?.licenseNumber) {
                const licenseExists = await prisma.doctor.findFirst({
                    where: { licenseNumber, id: { not: existingUser.doctorProfile?.id } }
                });

                if (licenseExists) {
                    return res.status(400).json({
                        success: false,
                        message: 'Nomor lisensi dokter sudah terdaftar'
                    });
                }
            }

            // Update user and doctor profile in transaction
            const result = await prisma.$transaction(async (tx) => {
                // Update user
                const user = await tx.user.update({
                    where: { id },
                    data: {
                        fullName,
                        nik,
                        phone,
                        gender,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                        street,
                        village,
                        district,
                        regency,
                        province
                    }
                });

                // Update doctor profile
                const doctorProfile = await tx.doctor.update({
                    where: { userId: id },
                    data: {
                        licenseNumber,
                        name: fullName,
                        specialty,
                        phone,
                        consultationFee: consultationFee ? parseFloat(consultationFee) : null,
                        bio,
                        schedule: schedule ? JSON.parse(schedule) : null,
                        isAvailable: isAvailable !== undefined ? isAvailable : undefined,
                        isOnDuty: isOnDuty !== undefined ? isOnDuty : undefined
                    }
                });

                return { user, doctorProfile };
            });

            res.json({
                success: true,
                message: 'Data dokter berhasil diperbarui',
                data: {
                    id: result.user.id,
                    fullName: result.user.fullName,
                    specialty: result.doctorProfile.specialty
                }
            });
        } catch (error) {
            console.error('Update doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui data dokter'
            });
        }
    },

    // Delete doctor (soft delete)
    deleteDoctor: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if doctor exists
            const existingUser = await prisma.user.findUnique({
                where: { id },
                include: { doctorProfile: true }
            });

            if (!existingUser || existingUser.role !== 'DOCTOR') {
                return res.status(404).json({
                    success: false,
                    message: 'Dokter tidak ditemukan'
                });
            }

            // Check if doctor has active appointments or consultations
            const hasActiveData = await prisma.appointment.findFirst({
                where: {
                    doctorId: id,
                    status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }
                }
            });

            if (hasActiveData) {
                return res.status(400).json({
                    success: false,
                    message: 'Tidak dapat menghapus dokter yang memiliki jadwal aktif'
                });
            }

            // Soft delete - deactivate user
            await prisma.user.update({
                where: { id },
                data: { isActive: false }
            });

            res.json({
                success: true,
                message: 'Dokter berhasil dinonaktifkan'
            });
        } catch (error) {
            console.error('Delete doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus dokter'
            });
        }
    },

    // Search doctors
    searchDoctors: async (req, res) => {
        try {
            const { q: query } = req.query;

            if (!query || query.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Query minimal 2 karakter'
                });
            }

            const doctors = await prisma.user.findMany({
                where: {
                    role: 'DOCTOR',
                    OR: [
                        { fullName: { contains: query, mode: 'insensitive' } },
                        { nik: { contains: query } },
                        { phone: { contains: query } },
                        { email: { contains: query } }
                    ]
                },
                select: {
                    id: true,
                    fullName: true,
                    nik: true,
                    phone: true,
                    email: true,
                    doctorProfile: {
                        select: {
                            specialty: true,
                            licenseNumber: true
                        }
                    }
                },
                orderBy: { fullName: 'asc' },
                take: 20
            });

            res.json({
                success: true,
                message: 'Doctors found',
                data: doctors
            });
        } catch (error) {
            console.error('Search doctors error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mencari dokter'
            });
        }
    }
};

module.exports = doctorController;
