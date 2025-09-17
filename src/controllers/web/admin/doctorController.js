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
    },

    // Get doctors attendance
    getDoctorsAttendance: async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50, 
                search = '', 
                specialty = 'ALL',
                status = 'ALL' 
            } = req.query;
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Build where condition for doctors
            const where = {
                role: 'DOCTOR',
                isActive: true,
                ...(search && {
                    OR: [
                        { fullName: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search } },
                        { 
                            doctorProfile: {
                                licenseNumber: { contains: search, mode: 'insensitive' }
                            }
                        }
                    ]
                }),
                ...(specialty !== 'ALL' && {
                    doctorProfile: {
                        specialty: { equals: specialty, mode: 'insensitive' }
                    }
                })
            };

            // Add status filter
            if (status !== 'ALL') {
                if (status === 'ON_DUTY') {
                    where.doctorProfile = {
                        ...where.doctorProfile,
                        isOnDuty: true
                    };
                } else if (status === 'AVAILABLE') {
                    where.doctorProfile = {
                        ...where.doctorProfile,
                        isAvailable: true,
                        isOnDuty: false
                    };
                } else if (status === 'OFFLINE') {
                    where.doctorProfile = {
                        ...where.doctorProfile,
                        OR: [
                            { isAvailable: false },
                            { isOnDuty: false }
                        ]
                    };
                }
            }

            const [doctors, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        profilePicture: true,
                        isActive: true,
                        lastLogin: true,
                        createdAt: true,
                        doctorProfile: {
                            select: {
                                licenseNumber: true,
                                specialty: true,
                                consultationFee: true,
                                isAvailable: true,
                                isOnDuty: true,
                                bio: true,
                                updatedAt: true
                            }
                        }
                    },
                    orderBy: [
                        { doctorProfile: { isOnDuty: 'desc' } },
                        { doctorProfile: { isAvailable: 'desc' } },
                        { fullName: 'asc' }
                    ],
                    skip,
                    take: parseInt(limit)
                }),
                prisma.user.count({ where })
            ]);

            // Calculate statistics
            const allDoctors = await prisma.user.findMany({
                where: {
                    role: 'DOCTOR',
                    isActive: true
                },
                select: {
                    doctorProfile: {
                        select: {
                            specialty: true,
                            isAvailable: true,
                            isOnDuty: true
                        }
                    }
                }
            });

            const stats = {
                totalDoctors: allDoctors.length,
                onDutyCount: allDoctors.filter(d => d.doctorProfile?.isOnDuty).length,
                availableCount: allDoctors.filter(d => d.doctorProfile?.isAvailable && !d.doctorProfile?.isOnDuty).length,
                offlineCount: allDoctors.filter(d => !d.doctorProfile?.isAvailable && !d.doctorProfile?.isOnDuty).length,
                specialtyBreakdown: []
            };

            // Calculate specialty breakdown
            const specialtyMap = {};
            allDoctors.forEach(doctor => {
                const specialty = doctor.doctorProfile?.specialty || 'Unknown';
                if (!specialtyMap[specialty]) {
                    specialtyMap[specialty] = {
                        specialty,
                        total: 0,
                        onDuty: 0,
                        available: 0
                    };
                }
                specialtyMap[specialty].total++;
                if (doctor.doctorProfile?.isOnDuty) {
                    specialtyMap[specialty].onDuty++;
                } else if (doctor.doctorProfile?.isAvailable) {
                    specialtyMap[specialty].available++;
                }
            });

            stats.specialtyBreakdown = Object.values(specialtyMap);

            const totalPages = Math.ceil(totalCount / parseInt(limit));

            // Format response
            const formattedDoctors = doctors.map(doctor => ({
                ...doctor,
                lastLogin: doctor.lastLogin ? doctor.lastLogin.toISOString() : null,
                createdAt: doctor.createdAt.toISOString()
            }));

            res.json({
                success: true,
                message: 'Doctor attendance data retrieved successfully',
                data: {
                    doctors: formattedDoctors,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalCount,
                        hasNext: parseInt(page) < totalPages,
                        hasPrev: parseInt(page) > 1
                    },
                    stats
                }
            });
        } catch (error) {
            console.error('Get doctors attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat data kehadiran dokter',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Update doctor duty status
    updateDoctorDutyStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { isOnDuty } = req.body;

            // Validate input
            if (typeof isOnDuty !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Status bertugas harus berupa boolean'
                });
            }

            // Check if doctor exists
            const doctor = await prisma.user.findFirst({
                where: {
                    id,
                    role: 'DOCTOR',
                    isActive: true
                },
                include: {
                    doctorProfile: true
                }
            });

            if (!doctor || !doctor.doctorProfile) {
                return res.status(404).json({
                    success: false,
                    message: 'Dokter tidak ditemukan atau tidak memiliki profil'
                });
            }

            // Update doctor profile
            await prisma.doctor.update({
                where: { id: doctor.doctorProfile.id },
                data: {
                    isOnDuty,
                    // If going on duty, automatically set as available
                    ...(isOnDuty && { isAvailable: true }),
                    updatedAt: new Date()
                }
            });

            // Log activity (optional)
            await prisma.activityLog.create({
                data: {
                    userId: id,
                    action: isOnDuty ? 'DOCTOR_ON_DUTY' : 'DOCTOR_OFF_DUTY',
                    description: `Doctor ${isOnDuty ? 'went on' : 'went off'} duty`,
                    metadata: {
                        doctorId: id,
                        doctorName: doctor.fullName,
                        previousStatus: doctor.doctorProfile.isOnDuty,
                        newStatus: isOnDuty
                    }
                }
            }).catch(err => {
                console.warn('Failed to log activity:', err);
            });

            res.json({
                success: true,
                message: `Status bertugas dokter berhasil ${isOnDuty ? 'diaktifkan' : 'dinonaktifkan'}`,
                data: {
                    id,
                    fullName: doctor.fullName,
                    isOnDuty
                }
            });
        } catch (error) {
            console.error('Update doctor duty status error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengubah status bertugas dokter'
            });
        }
    },

    // Update doctor availability
    updateDoctorAvailability: async (req, res) => {
        try {
            const { id } = req.params;
            const { isAvailable } = req.body;

            // Validate input
            if (typeof isAvailable !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Status ketersediaan harus berupa boolean'
                });
            }

            // Check if doctor exists
            const doctor = await prisma.user.findFirst({
                where: {
                    id,
                    role: 'DOCTOR',
                    isActive: true
                },
                include: {
                    doctorProfile: true
                }
            });

            if (!doctor || !doctor.doctorProfile) {
                return res.status(404).json({
                    success: false,
                    message: 'Dokter tidak ditemukan atau tidak memiliki profil'
                });
            }

            // Update doctor profile
            await prisma.doctor.update({
                where: { id: doctor.doctorProfile.id },
                data: {
                    isAvailable,
                    // If going unavailable, also set off duty
                    ...(!isAvailable && { isOnDuty: false }),
                    updatedAt: new Date()
                }
            });

            // Log activity (optional)
            await prisma.activityLog.create({
                data: {
                    userId: id,
                    action: isAvailable ? 'DOCTOR_AVAILABLE' : 'DOCTOR_UNAVAILABLE',
                    description: `Doctor became ${isAvailable ? 'available' : 'unavailable'}`,
                    metadata: {
                        doctorId: id,
                        doctorName: doctor.fullName,
                        previousStatus: doctor.doctorProfile.isAvailable,
                        newStatus: isAvailable
                    }
                }
            }).catch(err => {
                console.warn('Failed to log activity:', err);
            });

            res.json({
                success: true,
                message: `Status ketersediaan dokter berhasil ${isAvailable ? 'diaktifkan' : 'dinonaktifkan'}`,
                data: {
                    id,
                    fullName: doctor.fullName,
                    isAvailable
                }
            });
        } catch (error) {
            console.error('Update doctor availability error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengubah status ketersediaan dokter'
            });
        }
    },

    // Get doctor schedule summary
    getDoctorScheduleSummary: async (req, res) => {
        try {
            const { date } = req.query;
            const targetDate = date ? new Date(date) : new Date();
            
            // Set to start of day
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            // Set to end of day
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const scheduleData = await prisma.user.findMany({
                where: {
                    role: 'DOCTOR',
                    isActive: true,
                    doctorProfile: {
                        isOnDuty: true
                    }
                },
                select: {
                    id: true,
                    fullName: true,
                    doctorProfile: {
                        select: {
                            specialty: true,
                            isOnDuty: true,
                            isAvailable: true
                        }
                    },
                    appointments: {
                        where: {
                            scheduledAt: {
                                gte: startOfDay,
                                lte: endOfDay
                            },
                            status: {
                                not: 'CANCELLED'
                            }
                        },
                        select: {
                            id: true,
                            scheduledAt: true,
                            status: true,
                            patient: {
                                select: {
                                    fullName: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    fullName: 'asc'
                }
            });

            res.json({
                success: true,
                message: 'Doctor schedule summary retrieved successfully',
                data: {
                    date: targetDate.toISOString().split('T')[0],
                    onDutyDoctors: scheduleData.length,
                    schedule: scheduleData.map(doctor => ({
                        id: doctor.id,
                        fullName: doctor.fullName,
                        specialty: doctor.doctorProfile?.specialty,
                        isOnDuty: doctor.doctorProfile?.isOnDuty,
                        isAvailable: doctor.doctorProfile?.isAvailable,
                        appointmentsCount: doctor.appointments.length,
                        appointments: doctor.appointments
                    }))
                }
            });
        } catch (error) {
            console.error('Get doctor schedule summary error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat ringkasan jadwal dokter'
            });
        }
    }
};

module.exports = doctorController;
