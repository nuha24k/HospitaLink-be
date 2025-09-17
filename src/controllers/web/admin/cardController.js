const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

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
    },

    // Download patient card as PDF
    downloadCardPdf: async (req, res) => {
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
                    role: true,
                    street: true,
                    village: true,
                    district: true,
                    regency: true,
                    province: true,
                    qrCode: true,
                    emailVerified: true,
                }
            });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Pasien tidak ditemukan'
                });
            }

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            
            // Set headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="patient-card-${patient.fullName}-${Date.now()}.pdf"`);
            
            // Pipe PDF to response
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('KARTU PASIEN - HospitaLink', { align: 'center' });
            doc.moveDown(1);

            // Add patient photo placeholder or actual photo
            const photoY = doc.y;
            doc.rect(50, photoY, 100, 120).stroke();
            doc.fontSize(10).text('Foto Pasien', 75, photoY + 55, { width: 50, align: 'center' });

            // Patient information
            const infoStartX = 170;
            doc.fontSize(14).text('INFORMASI PASIEN', infoStartX, photoY, { underline: true });
            
            let currentY = photoY + 25;
            const lineHeight = 20;

            const patientInfo = [
                ['Nama Lengkap', patient.fullName || '-'],
                ['NIK', patient.nik || '-'],
                ['Jenis Kelamin', patient.gender === 'MALE' ? 'Laki-laki' : patient.gender === 'FEMALE' ? 'Perempuan' : '-'],
                ['Tanggal Lahir', patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('id-ID') : '-'],
                ['Nomor Telepon', patient.phone || '-'],
                ['Email', patient.email || '-'],
                ['Status', patient.isActive ? 'Aktif' : 'Tidak Aktif'],
                ['Terdaftar', new Date(patient.createdAt).toLocaleDateString('id-ID')]
            ];

            doc.fontSize(10);
            patientInfo.forEach(([label, value]) => {
                doc.text(`${label}:`, infoStartX, currentY, { width: 120 });
                doc.text(value, infoStartX + 120, currentY, { width: 250 });
                currentY += lineHeight;
            });

            // Address section
            doc.moveDown(2);
            doc.fontSize(14).text('ALAMAT', 50, doc.y, { underline: true });
            doc.moveDown(0.5);

            const fullAddress = [
                patient.street,
                patient.village,
                patient.district,
                patient.regency,
                patient.province
            ].filter(Boolean).join(', ') || 'Alamat tidak tersedia';

            doc.fontSize(10).text(fullAddress, 50, doc.y, { width: 500 });

            // QR Code section (if available)
            if (patient.qrCode) {
                doc.moveDown(2);
                doc.fontSize(14).text('QR CODE', 50, doc.y, { underline: true });
                doc.moveDown(0.5);

                try {
                    // Generate QR code as buffer
                    const qrCodeBuffer = await QRCode.toBuffer(patient.qrCode, {
                        width: 100,
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });

                    // Add QR code image to PDF
                    doc.image(qrCodeBuffer, 50, doc.y, { width: 80, height: 80 });
                    
                    // Add text beside QR code
                    doc.fontSize(10).text(`Kode: ${patient.qrCode}`, 150, doc.y - 40);
                    doc.text('Scan QR code ini untuk verifikasi pasien', 150, doc.y - 25);
                    
                    doc.moveDown(3);
                } catch (qrError) {
                    console.error('QR Code generation error:', qrError);
                    doc.fontSize(10).text('QR Code: ' + patient.qrCode, 50, doc.y);
                    doc.moveDown(1);
                }
            }

            // Footer
            doc.moveDown(3);
            doc.fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50, doc.y);
            doc.text(`ID Pasien: ${patient.id}`, 50, doc.y + 10);

            // Finalize PDF
            doc.end();

        } catch (error) {
            console.error('Download PDF error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengunduh kartu pasien',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = cardController;