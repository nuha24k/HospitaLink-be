const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function outside class
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Helper function to get patient IDs from doctor's consultations and appointments
const getDoctorPatientIds = async (doctorId) => {
  try {
    const [consultations, appointments] = await Promise.all([
      prisma.consultation.findMany({
        where: { doctorId },
        select: { userId: true },
        distinct: ['userId']
      }),
      prisma.appointment.findMany({
        where: { doctorId },
        select: { userId: true },
        distinct: ['userId']
      })
    ]);

    const patientIds = new Set();
    consultations.forEach(c => patientIds.add(c.userId));
    appointments.forEach(a => patientIds.add(a.userId));

    return Array.from(patientIds);
  } catch (error) {
    console.error('Get doctor patient IDs error:', error);
    return [];
  }
};

class PatientController {
  async getPatients(req, res) {
    try {
      console.log('=== Get Patients ===');
      console.log('User ID:', req.user.id);
      
      // Get current doctor
      const currentDoctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id },
      });

      if (!currentDoctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan',
        });
      }

      console.log('Doctor found:', currentDoctor.id);

      // Get patients from consultations, appointments, and medical records
      const [patientsFromConsultations, patientsFromAppointments] = await Promise.all([
        prisma.consultation.findMany({
          where: { 
            doctorId: currentDoctor.id 
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                nik: true,
                phone: true,
                gender: true,
                dateOfBirth: true,
                email: true
              }
            }
          },
          distinct: ['userId']
        }),
        prisma.appointment.findMany({
          where: { 
            doctorId: currentDoctor.id 
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                nik: true,
                phone: true,
                gender: true,
                dateOfBirth: true,
                email: true
              }
            }
          },
          distinct: ['userId']
        })
      ]);

      console.log('Consultations found:', patientsFromConsultations.length);
      console.log('Appointments found:', patientsFromAppointments.length);

      // Combine and deduplicate patients
      const allPatients = new Map();
      
      patientsFromConsultations.forEach(consultation => {
        if (consultation.user) {
          allPatients.set(consultation.user.id, consultation.user);
        }
      });

      patientsFromAppointments.forEach(appointment => {
        if (appointment.user) {
          allPatients.set(appointment.user.id, appointment.user);
        }
      });

      // Convert to array and add additional info
      const patients = Array.from(allPatients.values()).map(patient => ({
        id: patient.id,
        fullName: patient.fullName,
        nik: patient.nik,
        phone: patient.phone,
        gender: patient.gender,
        email: patient.email,
        age: calculateAge(patient.dateOfBirth),
        dateOfBirth: patient.dateOfBirth
      }));

      // Sort by name
      patients.sort((a, b) => a.fullName.localeCompare(b.fullName));

      console.log('Found patients:', patients.length);

      res.json({
        success: true,
        message: 'Patients retrieved successfully',
        data: patients,
        total: patients.length
      });

    } catch (error) {
      console.error('Get patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat data pasien',
        error: error.message
      });
    }
  }

  async searchPatients(req, res) {
    try {
      const { q, limit = 20 } = req.query;
      
      if (!q || q.length < 2) {
        return res.json({
          success: true,
          message: 'Query too short',
          data: [],
          total: 0
        });
      }

      console.log('=== Search Patients ===');
      console.log('Query:', q);
      console.log('User ID:', req.user.id);

      // Get current doctor
      const currentDoctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id },
      });

      if (!currentDoctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan',
        });
      }

      console.log('Doctor found:', currentDoctor.id);

      // Search in users with role USER/PATIENT who have had consultations or appointments
      const searchTerm = q.toLowerCase();
      
      // Get patient IDs from doctor's consultations and appointments - USE GLOBAL FUNCTION
      const doctorPatientIds = await getDoctorPatientIds(currentDoctor.id);

      console.log('Doctor patient IDs found:', doctorPatientIds.length);

      if (doctorPatientIds.length === 0) {
        return res.json({
          success: true,
          message: 'No patients found for this doctor',
          data: [],
          total: 0,
          query: q
        });
      }

      // MySQL compatible search (removed mode: 'insensitive')
      const patients = await prisma.user.findMany({
        where: {
          AND: [
            {
              id: {
                in: doctorPatientIds
              }
            },
            {
              role: {
                in: ['USER', 'PATIENT']
              }
            },
            {
              OR: [
                {
                  fullName: {
                    contains: searchTerm
                  }
                },
                {
                  nik: {
                    contains: searchTerm
                  }
                },
                {
                  phone: {
                    contains: searchTerm
                  }
                },
                {
                  email: {
                    contains: searchTerm
                  }
                }
              ]
            }
          ]
        },
        select: {
          id: true,
          fullName: true,
          nik: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          email: true
        },
        take: parseInt(limit),
        orderBy: {
          fullName: 'asc'
        }
      });

      const formattedPatients = patients.map(patient => ({
        id: patient.id,
        fullName: patient.fullName,
        nik: patient.nik,
        phone: patient.phone,
        gender: patient.gender,
        email: patient.email,
        age: calculateAge(patient.dateOfBirth),
        dateOfBirth: patient.dateOfBirth
      }));

      console.log('Search results:', formattedPatients.length);

      res.json({
        success: true,
        message: 'Search completed',
        data: formattedPatients,
        total: formattedPatients.length,
        query: q
      });

    } catch (error) {
      console.error('Search patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mencari pasien',
        error: error.message
      });
    }
  }

  async getAllPatients(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      
      console.log('=== Get All Patients ===');
      
      const where = {
        role: {
          in: ['USER', 'PATIENT']
        },
        isActive: true
      };

      if (search) {
        const searchTerm = search.toLowerCase();
        where.OR = [
          {
            fullName: {
              contains: searchTerm
            }
          },
          {
            nik: {
              contains: searchTerm
            }
          },
          {
            phone: {
              contains: searchTerm
            }
          },
          {
            email: {
              contains: searchTerm
            }
          }
        ];
      }

      const [patients, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            fullName: true,
            nik: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
            email: true,
            createdAt: true
          },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
          orderBy: {
            fullName: 'asc'
          }
        }),
        prisma.user.count({ where })
      ]);

      const formattedPatients = patients.map(patient => ({
        id: patient.id,
        fullName: patient.fullName,
        nik: patient.nik,
        phone: patient.phone,
        gender: patient.gender,
        email: patient.email,
        age: calculateAge(patient.dateOfBirth),
        dateOfBirth: patient.dateOfBirth,
        registeredAt: patient.createdAt
      }));

      res.json({
        success: true,
        message: 'All patients retrieved',
        data: formattedPatients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get all patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat semua pasien',
        error: error.message
      });
    }
  }
}

module.exports = new PatientController();