const { PrismaClient, Prisma } = require('@prisma/client');
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
    console.log('🔍 Getting patient IDs for doctor:', doctorId);
    
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

    console.log('📊 Consultations found:', consultations.length);
    console.log('📊 Appointments found:', appointments.length);
    
    // Debug: Log actual user IDs
    console.log('Consultation user IDs:', consultations.map(c => c.userId));
    console.log('Appointment user IDs:', appointments.map(a => a.userId));

    const patientIds = new Set();
    consultations.forEach(c => patientIds.add(c.userId));
    appointments.forEach(a => patientIds.add(a.userId));

    const result = Array.from(patientIds);
    console.log('📋 Combined unique patient IDs:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Get doctor patient IDs error:', error);
    return [];
  }
};

class PatientController {
  async getPatients(req, res) {
    try {
      console.log('=== Get Patients ===');
      console.log('👤 User ID:', req.user.id);
      console.log('👤 User Role:', req.user.role);
      
      // Get current doctor
      const currentDoctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id },
      });

      if (!currentDoctor) {
        console.log('❌ Doctor profile not found for user:', req.user.id);
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan',
        });
      }

      console.log('👨‍⚕️ Doctor found:', currentDoctor.id, currentDoctor.name);

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

      console.log('📊 Consultations found:', patientsFromConsultations.length);
      console.log('📊 Appointments found:', patientsFromAppointments.length);

      // Debug: Log patient names
      patientsFromConsultations.forEach(c => {
        console.log('Consultation patient:', c.user?.fullName);
      });
      patientsFromAppointments.forEach(a => {
        console.log('Appointment patient:', a.user?.fullName);
      });

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

      console.log('✅ Total unique patients found:', patients.length);
      console.log('Patient names:', patients.map(p => p.fullName));

      res.json({
        success: true,
        message: 'Patients retrieved successfully',
        data: patients,
        total: patients.length
      });

    } catch (error) {
      console.error('❌ Get patients error:', error);
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
      console.log('🔍 Query:', q);
      console.log('👤 User ID:', req.user.id);

      // Get current doctor
      const currentDoctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id },
      });

      if (!currentDoctor) {
        console.log('❌ Doctor profile not found');
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan',
        });
      }

      console.log('👨‍⚕️ Doctor found:', currentDoctor.id, currentDoctor.name);

      // Get patient IDs from doctor's consultations and appointments
      const doctorPatientIds = await getDoctorPatientIds(currentDoctor.id);

      console.log('📋 Doctor patient IDs found:', doctorPatientIds.length);

      if (doctorPatientIds.length === 0) {
        console.log('⚠️ No patients found for this doctor');
        return res.json({
          success: true,
          message: 'No patients found for this doctor',
          data: [],
          total: 0,
          query: q
        });
      }

      // First, let's get all patients for this doctor to debug
      const allDoctorPatients = await prisma.user.findMany({
        where: {
          id: {
            in: doctorPatientIds
          }
        },
        select: {
          id: true,
          fullName: true,
          nik: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          email: true
        }
      });

      console.log('👥 All doctor patients:');
      allDoctorPatients.forEach(patient => {
        console.log(`- ${patient.fullName} (ID: ${patient.id})`);
      });

      // ✅ FIX: Use JavaScript filter instead of raw SQL for simplicity
      const searchTerm = q.toLowerCase();
      console.log('🔍 Searching for term:', searchTerm);

      // Filter patients in JavaScript for case-insensitive search
      const matchingPatients = allDoctorPatients.filter(patient => {
        const fullNameLower = (patient.fullName || '').toLowerCase();
        const nikLower = (patient.nik || '').toLowerCase();
        const phoneLower = (patient.phone || '').toLowerCase();
        const emailLower = (patient.email || '').toLowerCase();
        
        return fullNameLower.includes(searchTerm) ||
               nikLower.includes(searchTerm) ||
               phoneLower.includes(searchTerm) ||
               emailLower.includes(searchTerm);
      }).slice(0, parseInt(limit));

      const formattedPatients = matchingPatients.map(patient => ({
        id: patient.id,
        fullName: patient.fullName,
        nik: patient.nik,
        phone: patient.phone,
        gender: patient.gender,
        email: patient.email,
        age: calculateAge(patient.dateOfBirth),
        dateOfBirth: patient.dateOfBirth
      }));

      console.log('🎯 Search results found:', formattedPatients.length);
      formattedPatients.forEach(patient => {
        console.log(`- Match: ${patient.fullName}`);
      });

      res.json({
        success: true,
        message: 'Search completed',
        data: formattedPatients,
        total: formattedPatients.length,
        query: q,
        debug: {
          searchTerm,
          totalDoctorPatients: doctorPatientIds.length,
          allPatientNames: allDoctorPatients.map(p => p.fullName),
          searchMatches: formattedPatients.map(p => p.fullName)
        }
      });

    } catch (error) {
      console.error('❌ Search patients error:', error);
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
        // ✅ FIX: Use Prisma contains for search instead of raw SQL
        const searchWhere = {
          ...where,
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { nik: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        };

        const [patients, total] = await Promise.all([
          prisma.user.findMany({
            where: searchWhere,
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
            orderBy: { fullName: 'asc' }
          }),
          prisma.user.count({ where: searchWhere })
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

        return res.json({
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
      console.error('❌ Get all patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat semua pasien',
        error: error.message
      });
    }
  }
}

module.exports = new PatientController();