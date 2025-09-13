const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to get week boundaries
const getWeekBoundaries = (offset = 0) => {
  const now = new Date();
  const currentDay = now.getDay(); 
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDay + 1 + (offset * 7));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { startDate: monday, endDate: sunday };
};

// Helper function to get week number
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Helper function to determine schedule status
const getScheduleStatus = (date, startTime, endTime) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduleDate = new Date(date);
  
  // Parse time strings to get hours and minutes
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startDateTime = new Date(scheduleDate);
  startDateTime.setHours(startHour, startMinute, 0, 0);
  
  const endDateTime = new Date(scheduleDate);
  endDateTime.setHours(endHour, endMinute, 0, 0);
  
  if (scheduleDate < today) {
    return 'COMPLETED';
  } else if (scheduleDate.getTime() === today.getTime()) {
    if (now < startDateTime) {
      return 'UPCOMING';
    } else if (now >= startDateTime && now <= endDateTime) {
      return 'ONGOING';
    } else {
      return 'COMPLETED';
    }
  } else {
    return 'UPCOMING';
  }
};

// Helper function to convert appointment to schedule appointment format
const formatAppointmentForSchedule = (appointment) => {
  return {
    id: appointment.id,
    patientName: appointment.user?.fullName || 'Pasien',
    patientPhone: appointment.user?.phone || null,
    appointmentTime: appointment.startTime.toTimeString().slice(0, 8),
    duration: Math.round((appointment.endTime - appointment.startTime) / (1000 * 60)), // minutes
    status: appointment.status,
    type: appointment.type,
    notes: appointment.notes
  };
};

const scheduleController = {
  // Get current week schedule
  getCurrentWeekSchedule: async (req, res) => {
    try {
      console.log('🩺 Getting current week schedule for doctor:', req.user.id);
      
      // Get doctor profile
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id },
        include: { user: true }
      });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan'
        });
      }
      
      const { startDate, endDate } = getWeekBoundaries(0);
      
      // Get appointments for the week
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          appointmentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true
            }
          }
        },
        orderBy: [
          { appointmentDate: 'asc' },
          { startTime: 'asc' }
        ]
      });
      
      // Group appointments by date
      const appointmentsByDate = {};
      appointments.forEach(appointment => {
        const dateKey = appointment.appointmentDate.toISOString().split('T')[0];
        if (!appointmentsByDate[dateKey]) {
          appointmentsByDate[dateKey] = [];
        }
        appointmentsByDate[dateKey].push(appointment);
      });
      
      // Create schedule objects for each day with appointments
      const schedules = [];
      Object.keys(appointmentsByDate).forEach(dateKey => {
        const dayAppointments = appointmentsByDate[dateKey];
        const firstAppointment = dayAppointments[0];
        const lastAppointment = dayAppointments[dayAppointments.length - 1];
        
        // Calculate schedule bounds
        const startTime = firstAppointment.startTime.toTimeString().slice(0, 8);
        const endTime = lastAppointment.endTime.toTimeString().slice(0, 8);
        const date = new Date(dateKey);
        
        // Calculate duration in hours
        const startHour = firstAppointment.startTime.getHours();
        const endHour = lastAppointment.endTime.getHours();
        const duration = endHour - startHour;
        
        const schedule = {
          id: `schedule_${doctor.id}_${dateKey}`,
          doctorId: doctor.id,
          date: dateKey,
          dayOfWeek: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()],
          startTime,
          endTime,
          isAvailable: true,
          maxPatients: 30, // Default capacity
          currentPatients: dayAppointments.length,
          scheduleType: 'REGULAR',
          location: 'Ruang Praktik',
          notes: `${dayAppointments.length} janji temu terjadwal`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          duration,
          status: getScheduleStatus(dateKey, startTime, endTime),
          appointments: dayAppointments.map(formatAppointmentForSchedule)
        };
        
        schedules.push(schedule);
      });
      
      // Sort schedules by date
      schedules.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Calculate summary
      const summary = {
        totalSchedules: schedules.length,
        totalHours: schedules.reduce((total, s) => total + (s.duration || 0), 0),
        totalPatients: schedules.reduce((total, s) => total + (s.currentPatients || 0), 0),
        availableDays: schedules.length
      };
      
      res.json({
        success: true,
        data: {
          schedules,
          weekInfo: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            weekNumber: getWeekNumber(startDate),
            year: startDate.getFullYear()
          },
          summary
        }
      });
      
    } catch (error) {
      console.error('❌ Get current week schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat jadwal minggu ini'
      });
    }
  },

  // Get week schedule with offset
  getWeekSchedule: async (req, res) => {
    try {
      const offset = parseInt(req.query.offset) || 0;
      console.log('🩺 Getting week schedule with offset:', offset);
      
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan'
        });
      }
      
      const { startDate, endDate } = getWeekBoundaries(offset);
      
      // Get appointments for the week
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          appointmentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true
            }
          }
        },
        orderBy: [
          { appointmentDate: 'asc' },
          { startTime: 'asc' }
        ]
      });
      
      // Group appointments by date
      const appointmentsByDate = {};
      appointments.forEach(appointment => {
        const dateKey = appointment.appointmentDate.toISOString().split('T')[0];
        if (!appointmentsByDate[dateKey]) {
          appointmentsByDate[dateKey] = [];
        }
        appointmentsByDate[dateKey].push(appointment);
      });
      
      // Create schedule objects
      const schedules = [];
      Object.keys(appointmentsByDate).forEach(dateKey => {
        const dayAppointments = appointmentsByDate[dateKey];
        const firstAppointment = dayAppointments[0];
        const lastAppointment = dayAppointments[dayAppointments.length - 1];
        
        const startTime = firstAppointment.startTime.toTimeString().slice(0, 8);
        const endTime = lastAppointment.endTime.toTimeString().slice(0, 8);
        const date = new Date(dateKey);
        
        const startHour = firstAppointment.startTime.getHours();
        const endHour = lastAppointment.endTime.getHours();
        const duration = endHour - startHour;
        
        const schedule = {
          id: `schedule_${doctor.id}_${dateKey}`,
          doctorId: doctor.id,
          date: dateKey,
          dayOfWeek: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()],
          startTime,
          endTime,
          isAvailable: true,
          maxPatients: 30,
          currentPatients: dayAppointments.length,
          scheduleType: 'REGULAR',
          location: 'Ruang Praktik',
          notes: `${dayAppointments.length} janji temu terjadwal`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          duration,
          status: getScheduleStatus(dateKey, startTime, endTime),
          appointments: dayAppointments.map(formatAppointmentForSchedule)
        };
        
        schedules.push(schedule);
      });
      
      schedules.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const summary = {
        totalSchedules: schedules.length,
        totalHours: schedules.reduce((total, s) => total + (s.duration || 0), 0),
        totalPatients: schedules.reduce((total, s) => total + (s.currentPatients || 0), 0),
        availableDays: schedules.length
      };
      
      res.json({
        success: true,
        data: {
          schedules,
          weekInfo: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            weekNumber: getWeekNumber(startDate),
            year: startDate.getFullYear()
          },
          summary
        }
      });
      
    } catch (error) {
      console.error('❌ Get week schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat jadwal minggu'
      });
    }
  },

  // Get upcoming schedules with pagination
  getUpcomingSchedules: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(Date.now() + (90 * 24 * 60 * 60 * 1000));
      
      console.log('🩺 Getting upcoming schedules:', { page, limit, startDate, endDate });
      
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan'
        });
      }
      
      // Get all appointments in the date range
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          appointmentDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            not: 'CANCELLED'
          }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true
            }
          }
        },
        orderBy: [
          { appointmentDate: 'asc' },
          { startTime: 'asc' }
        ]
      });
      
      // Group by date
      const appointmentsByDate = {};
      appointments.forEach(appointment => {
        const dateKey = appointment.appointmentDate.toISOString().split('T')[0];
        if (!appointmentsByDate[dateKey]) {
          appointmentsByDate[dateKey] = [];
        }
        appointmentsByDate[dateKey].push(appointment);
      });
      
      // Create schedule objects
      const allSchedules = [];
      Object.keys(appointmentsByDate).forEach(dateKey => {
        const dayAppointments = appointmentsByDate[dateKey];
        const firstAppointment = dayAppointments[0];
        const lastAppointment = dayAppointments[dayAppointments.length - 1];
        
        const startTime = firstAppointment.startTime.toTimeString().slice(0, 8);
        const endTime = lastAppointment.endTime.toTimeString().slice(0, 8);
        const date = new Date(dateKey);
        
        const status = getScheduleStatus(dateKey, startTime, endTime);
        
        // Only include future schedules for upcoming view
        if (status === 'UPCOMING' || status === 'ONGOING') {
          const startHour = firstAppointment.startTime.getHours();
          const endHour = lastAppointment.endTime.getHours();
          const duration = endHour - startHour;
          
          const schedule = {
            id: `schedule_${doctor.id}_${dateKey}`,
            doctorId: doctor.id,
            date: dateKey,
            dayOfWeek: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()],
            startTime,
            endTime,
            isAvailable: true,
            maxPatients: 30,
            currentPatients: dayAppointments.length,
            scheduleType: 'REGULAR',
            location: 'Ruang Praktik',
            notes: `${dayAppointments.length} janji temu terjadwal`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            duration,
            status,
            appointments: dayAppointments.map(formatAppointmentForSchedule)
          };
          
          allSchedules.push(schedule);
        }
      });
      
      // Sort by date
      allSchedules.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Apply pagination
      const total = allSchedules.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const schedules = allSchedules.slice(offset, offset + limit);
      
      res.json({
        success: true,
        data: {
          schedules,
          pagination: {
            page,
            limit,
            total,
            totalPages
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Get upcoming schedules error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat jadwal mendatang'
      });
    }
  },

  // Get schedule by specific date
  getScheduleByDate: async (req, res) => {
    try {
      const date = req.params.date;
      console.log('🩺 Getting schedule for date:', date);
      
      if (!date || isNaN(Date.parse(date))) {
        return res.status(400).json({
          success: false,
          message: 'Format tanggal tidak valid'
        });
      }
      
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan'
        });
      }
      
      const targetDate = new Date(date);
      
      // Get appointments for specific date
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          appointmentDate: {
            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            lt: new Date(targetDate.setHours(23, 59, 59, 999))
          }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        }
      });
      
      let schedule = null;
      
      if (appointments.length > 0) {
        const firstAppointment = appointments[0];
        const lastAppointment = appointments[appointments.length - 1];
        
        const startTime = firstAppointment.startTime.toTimeString().slice(0, 8);
        const endTime = lastAppointment.endTime.toTimeString().slice(0, 8);
        
        const startHour = firstAppointment.startTime.getHours();
        const endHour = lastAppointment.endTime.getHours();
        const duration = endHour - startHour;
        
        schedule = {
          id: `schedule_${doctor.id}_${date}`,
          doctorId: doctor.id,
          date: date,
          dayOfWeek: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][targetDate.getDay()],
          startTime,
          endTime,
          isAvailable: true,
          maxPatients: 30,
          currentPatients: appointments.length,
          scheduleType: 'REGULAR',
          location: 'Ruang Praktik',
          notes: `${appointments.length} janji temu terjadwal`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          duration,
          status: getScheduleStatus(date, startTime, endTime),
          appointments: appointments.map(formatAppointmentForSchedule)
        };
      }
      
      res.json({
        success: true,
        data: {
          schedule
        }
      });
      
    } catch (error) {
      console.error('❌ Get schedule by date error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat jadwal tanggal tersebut'
      });
    }
  },

  // Get schedule statistics
  getScheduleStats: async (req, res) => {
    try {
      const period = req.query.period || 'week';
      console.log('🩺 Getting schedule stats for period:', period);
      
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Profil dokter tidak ditemukan'
        });
      }
      
      // Calculate date range based on period
      const now = new Date();
      let startDate, endDate;
      
      if (period === 'week') {
        const { startDate: weekStart, endDate: weekEnd } = getWeekBoundaries(0);
        startDate = weekStart;
        endDate = weekEnd;
      } else {
        // Month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      
      // Get appointments in the period
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          appointmentDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            not: 'CANCELLED'
          }
        }
      });
      
      // Group by date to calculate working days
      const dateMap = {};
      let totalMinutes = 0;
      
      appointments.forEach(appointment => {
        const dateKey = appointment.appointmentDate.toISOString().split('T')[0];
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = [];
        }
        dateMap[dateKey].push(appointment);
        
        // Calculate duration in minutes
        const duration = (appointment.endTime - appointment.startTime) / (1000 * 60);
        totalMinutes += duration;
      });
      
      const workingDays = Object.keys(dateMap).length;
      const totalHours = totalMinutes / 60;
      const totalPatients = appointments.length;
      const avgPatientsPerDay = workingDays > 0 ? totalPatients / workingDays : 0;
      
      // Calculate utilization rate (assuming 8 hours per working day as max)
      const maxPossibleHours = workingDays * 8;
      const utilizationRate = maxPossibleHours > 0 ? (totalHours / maxPossibleHours) * 100 : 0;
      
      const stats = {
        totalHours: Math.round(totalHours * 10) / 10,
        totalPatients,
        avgPatientsPerDay: Math.round(avgPatientsPerDay * 10) / 10,
        utilizationRate: Math.round(utilizationRate * 10) / 10
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('❌ Get schedule stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memuat statistik jadwal'
      });
    }
  }
};

module.exports = scheduleController;