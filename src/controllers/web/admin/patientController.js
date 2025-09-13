const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Generate token for web sessions
const generateWebToken = (userId, role = 'ADMIN') => {
  return jwt.sign(
    { userId, platform: 'web', role }, 
    process.env.JWT_SECRET || 'hospitalink-secret', 
    { expiresIn: '8h' }
  );
};

/**
 * Get all patients (users with PATIENT role)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPatients = async (req, res) => {
    try {
        // Query parameters for filtering and pagination
        const {
            page = 1,
            limit = 10,
            search = '',
            gender = '',
            isActive = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build where clause
        const where = {
            role: {
                in: ['PATIENT', 'USER'] // Include both PATIENT and USER roles as they can be patients
            },
            isActive: true
        };

        // Add search filter
        if (search) {
            where.OR = [
                { fullName: { contains: search } },
                { email: { contains: search } },
                { nik: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        // Add gender filter
        if (gender && (gender === 'MALE' || gender === 'FEMALE')) {
            where.gender = gender;
        }

        // Add isActive filter
        if (isActive !== '') {
            where.isActive = isActive === 'true';
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get patients with related data
        const patients = await prisma.user.findMany({
            where,
            include: {
                familyMembers: {
                    include: {
                        member: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true
                            }
                        }
                    }
                },
                appointments: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true
                            }
                        }
                    },
                    orderBy: {
                        appointmentDate: 'desc'
                    },
                    take: 5 // Only get latest 5 appointments
                },
                medicalRecords: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true
                            }
                        }
                    },
                    orderBy: {
                        visitDate: 'desc'
                    },
                    take: 5 // Only get latest 5 medical records
                },
                consultations: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 5 // Only get latest 5 consultations
                },
                notifications: {
                    where: {
                        isRead: false
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 10 // Only get latest 10 unread notifications
                }
            },
            orderBy: {
                [sortBy]: sortOrder
            },
            skip,
            take
        });

        // Get total count for pagination
        const totalPatients = await prisma.user.count({ where });

        // Calculate pagination info
        const totalPages = Math.ceil(totalPatients / take);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Remove password from response
        const patientsWithoutPassword = patients.map(patient => {
            const { password, ...patientData } = patient;
            return patientData;
        });

        res.json({
            success: true,
            data: {
                patients: patientsWithoutPassword,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalRecords: totalPatients,
                    hasNextPage,
                    hasPrevPage,
                    limit: take
                }
            },
            message: 'Patients retrieved successfully'
        });

    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({ 
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve patients" 
        });
    }
};

/**
 * Get patient by ID with detailed information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPatientById = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Validate ID format (UUID)
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                error: "Invalid patient ID format",
                message: "Patient ID must be a valid UUID string"
            });
        }

        const patient = await prisma.user.findUnique({
            where: { 
                id: id,
                role: {
                    in: ['PATIENT', 'USER']
                }
            },
            include: {
                // Family members
                familyMembers: {
                    include: {
                        member: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phone: true,
                                gender: true,
                                dateOfBirth: true,
                                profilePicture: true
                            }
                        }
                    }
                },
                familyOf: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phone: true
                            }
                        }
                    }
                },
                // Appointments with full details
                appointments: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true,
                                phone: true,
                                consultationFee: true
                            }
                        },
                        prescriptions: true,
                        queue: true
                    },
                    orderBy: {
                        appointmentDate: 'desc'
                    }
                },
                // Medical records with full details
                medicalRecords: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true,
                                licenseNumber: true
                            }
                        },
                        consultation: {
                            select: {
                                id: true,
                                type: true,
                                severity: true,
                                urgency: true,
                                symptoms: true,
                                aiAnalysis: true
                            }
                        },
                        labResults: {
                            orderBy: {
                                testDate: 'desc'
                            }
                        }
                    },
                    orderBy: {
                        visitDate: 'desc'
                    }
                },
                // Consultations with full details
                consultations: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true,
                                consultationFee: true
                            }
                        },
                        appointment: {
                            select: {
                                id: true,
                                appointmentDate: true,
                                startTime: true,
                                endTime: true
                            }
                        },
                        digitalPrescriptions: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                // Lab results
                labResults: {
                    include: {
                        medicalRecord: {
                            select: {
                                id: true,
                                visitDate: true,
                                diagnosis: true
                            }
                        }
                    },
                    orderBy: {
                        testDate: 'desc'
                    }
                },
                // Prescriptions
                prescriptions: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true
                            }
                        },
                        consultation: {
                            select: {
                                id: true,
                                type: true,
                                createdAt: true
                            }
                        },
                        appointment: {
                            select: {
                                id: true,
                                appointmentDate: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                // Queue history
                queues: {
                    include: {
                        doctor: {
                            select: {
                                id: true,
                                name: true,
                                specialty: true
                            }
                        },
                        appointment: {
                            select: {
                                id: true,
                                appointmentDate: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                // All notifications
                notifications: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                error: "Patient not found",
                message: "No patient found with the provided ID"
            });
        }

        // Remove password from response
        const { password, ...patientData } = patient;

        // Calculate summary statistics
        const summary = {
            totalAppointments: patient.appointments.length,
            completedAppointments: patient.appointments.filter(apt => apt.status === 'COMPLETED').length,
            totalConsultations: patient.consultations.length,
            totalMedicalRecords: patient.medicalRecords.length,
            totalLabResults: patient.labResults.length,
            totalPrescriptions: patient.prescriptions.length,
            unreadNotifications: patient.notifications.filter(notif => !notif.isRead).length,
            lastVisit: patient.medicalRecords.length > 0 ? patient.medicalRecords[0].visitDate : null,
            lastAppointment: patient.appointments.length > 0 ? patient.appointments[0].appointmentDate : null
        };

        res.json({
            success: true,
            data: {
                patient: patientData,
                summary
            },
            message: 'Patient details retrieved successfully'
        });

    } catch (error) {
        console.error("Error fetching patient by ID:", error);
        res.status(500).json({ 
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve patient details" 
        });
    }
};

/**
 * Create a new patient
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPatient = async (req, res) => {
    try {
        const {
            email,
            password,
            fullName,
            phone,
            nik,
            gender,
            dateOfBirth,
            street,
            village,
            district,
            regency,
            province
        } = req.body;

        // Validate required fields
        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                message: "Email, password, and full name are required"
            });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "Email already exists",
                message: "A user with this email already exists"
            });
        }

        // Check if NIK already exists (if provided)
        if (nik) {
            const existingNik = await prisma.user.findUnique({
                where: { nik }
            });

            if (existingNik) {
                return res.status(409).json({
                    success: false,
                    error: "NIK already exists",
                    message: "A user with this NIK already exists"
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create patient
        const newPatient = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                phone,
                nik,
                gender: gender || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                street,
                village,
                district,
                regency,
                province,
                role: 'PATIENT',
                isActive: true,
                emailVerified: false
            }
        });

        // Remove password from response
        const { password: _, ...patientData } = newPatient;

        res.status(201).json({
            success: true,
            data: {
                patient: patientData
            },
            message: 'Patient created successfully'
        });

    } catch (error) {
        console.error("Error creating patient:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to create patient"
        });
    }
};

/**
 * Update patient information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePatient = async (req, res) => {
    const { id } = req.params;
    
    try {
        const {
            fullName,
            phone,
            nik,
            gender,
            dateOfBirth,
            street,
            village,
            district,
            regency,
            province,
            isActive
        } = req.body;

        // Check if patient exists
        const existingPatient = await prisma.user.findUnique({
            where: { 
                id,
                role: {
                    in: ['PATIENT', 'USER']
                }
            }
        });

        if (!existingPatient) {
            return res.status(404).json({
                success: false,
                error: "Patient not found",
                message: "No patient found with the provided ID"
            });
        }

        // Check if NIK already exists for other users (if provided)
        if (nik && nik !== existingPatient.nik) {
            const existingNik = await prisma.user.findUnique({
                where: { nik }
            });

            if (existingNik) {
                return res.status(409).json({
                    success: false,
                    error: "NIK already exists",
                    message: "Another user with this NIK already exists"
                });
            }
        }

        // Update patient
        const updatedPatient = await prisma.user.update({
            where: { id },
            data: {
                ...(fullName && { fullName }),
                ...(phone && { phone }),
                ...(nik && { nik }),
                ...(gender && { gender }),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(street && { street }),
                ...(village && { village }),
                ...(district && { district }),
                ...(regency && { regency }),
                ...(province && { province }),
                ...(typeof isActive === 'boolean' && { isActive }),
                updatedAt: new Date()
            }
        });

        // Remove password from response
        const { password, ...patientData } = updatedPatient;

        res.json({
            success: true,
            data: {
                patient: patientData
            },
            message: 'Patient updated successfully'
        });

    } catch (error) {
        console.error("Error updating patient:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to update patient"
        });
    }
};

/**
 * Delete patient (soft delete by setting isActive to false)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deletePatient = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if patient exists
        const existingPatient = await prisma.user.findUnique({
            where: { 
                id,
                role: {
                    in: ['PATIENT', 'USER']
                }
            }
        });

        if (!existingPatient) {
            return res.status(404).json({
                success: false,
                error: "Patient not found",
                message: "No patient found with the provided ID"
            });
        }

        // Soft delete by setting isActive to false
        const deletedPatient = await prisma.user.update({
            where: { id },
            data: {
                isActive: false,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            data: {
                patientId: id
            },
            message: 'Patient deleted successfully'
        });

    } catch (error) {
        console.error("Error deleting patient:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to delete patient"
        });
    }
};

/**
 * Get patient statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPatientStats = async (req, res) => {
    try {
        console.log('📊 Fetching patient statistics...');

        // Get total patients
        const total = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true
            }
        });

        // Get gender statistics
        const genderStats = await prisma.user.groupBy({
            by: ['gender'],
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true,
                gender: { not: null }
            },
            _count: {
                gender: true
            }
        });

        let male = 0;
        let female = 0;
        
        genderStats.forEach(stat => {
            if (stat.gender === 'MALE') {
                male = stat._count.gender;
            } else if (stat.gender === 'FEMALE') {
                female = stat._count.gender;
            }
        });

        // Get recent patients (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentAdded = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true,
                createdAt: {
                    gte: sevenDaysAgo
                }
            }
        });

        // Get active/inactive counts
        const active = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true
            }
        });

        const inactive = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: false
            }
        });

        // Get patients with appointments
        const withAppointments = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true,
                appointments: {
                    some: {}
                }
            }
        });

        // Get patients with medical records
        const withMedicalRecords = await prisma.user.count({
            where: {
                role: { in: ['PATIENT', 'USER'] },
                isActive: true,
                medicalRecords: {
                    some: {}
                }
            }
        });

        const stats = {
            total,
            male,
            female,
            recentAdded,
            active,
            inactive,
            withAppointments,
            withMedicalRecords
        };

        console.log('✅ Patient statistics retrieved:', stats);

        res.json({
            success: true,
            message: 'Patient statistics retrieved successfully',
            data: stats
        });

    } catch (error) {
        console.error('❌ Get patient stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve patient statistics',
            error: error.message
        });
    }
};

module.exports = {
    getPatients,
    getPatientById,
    getPatientStats, // Export the new function
    createPatient,
    updatePatient,
    deletePatient,
    generateWebToken
};