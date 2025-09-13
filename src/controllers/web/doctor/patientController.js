const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const patientController = {
  // Get all patients (simplified for prescription creation)
  getPatients: async (req, res) => {
    try {
      const patients = await prisma.user.findMany({
        where: {
          role: 'USER'
        },
        select: {
          id: true,
          fullName: true,
          nik: true,
          phone: true,
          email: true,
          gender: true,
          dateOfBirth: true
        },
        orderBy: {
          fullName: 'asc'
        },
        take: 100 // Limit for performance
      });

      res.json({
        success: true,
        message: 'Patients retrieved successfully',
        data: patients
      });
    } catch (error) {
      console.error('Get patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat data pasien'
      });
    }
  },

  // Search patients
  searchPatients: async (req, res) => {
    try {
      const { q: query } = req.query;
      
      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Query minimal 2 karakter'
        });
      }

      const patients = await prisma.user.findMany({
        where: {
          role: 'USER',
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { nik: { contains: query } },
            { phone: { contains: query } }
          ]
        },
        select: {
          id: true,
          fullName: true,
          nik: true,
          phone: true,
          email: true
        },
        orderBy: {
          fullName: 'asc'
        },
        take: 20
      });

      res.json({
        success: true,
        message: 'Patients found',
        data: patients
      });
    } catch (error) {
      console.error('Search patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mencari pasien'
      });
    }
  }
};

module.exports = patientController;