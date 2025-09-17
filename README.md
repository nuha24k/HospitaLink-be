# 🏥 HospitaLink Backend System

HospitaLink adalah sistem manajemen rumah sakit yang komprehensif dengan arsitektur **Mobile App + Web Dashboard** yang mengintegrasikan fitur modern seperti QR code check-in, konsultasi online, resep digital, dan sistem pembayaran terintegrasi.

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v16 atau lebih tinggi)
- PostgreSQL Database
- NPM atau Yarn

### Installation Steps
```bash
# Clone repository
git clone <repository-url>
cd HospitaLink-be

# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Seed initial data
npm run seed

# Start server
npm start
# Server berjalan di http://localhost:5000
```

## 👤 Default Login Accounts

### **Admin Accounts**
| Email | Password | Role |
|-------|----------|------|
| `admin@hospitalink.com` | `admin123` | ADMIN |
| `sofwannuhaalfaruq@gmail.com` | `password123` | ADMIN |

### **Doctor Accounts**
| Email | NIK | Password | Spesialisasi |
|-------|-----|----------|-------------|
| `dr.sarah@hospitalink.com` | `3201010101010002` | `doctor123` | Spesialis Penyakit Dalam |
| `dr.ahmad@hospitalink.com` | `3201010101010003` | `doctor123` | Spesialis Anak |

### **Patient Accounts**
| Email | NIK | Password | QR Code |
|-------|-----|----------|---------|
| `budi.santoso@email.com` | `3201123456789001` | `password123` | `USER_001` |
| `siti.nurhaliza@email.com` | `3201123456789002` | `password123` | `USER_002` |
| `ahmad.fauzi@email.com` | `3201123456789003` | `password123` | `USER_003` |
| `lisa.permata@email.com` | `3201123456789004` | `password123` | `USER_004` |

## 🌟 Key Features

### **🔐 Multi-Platform Authentication System**
- **Login Methods**: Email, NIK (16 digit), Fingerprint support
- **Role-based Access Control**: Admin, Doctor, Patient
- **JWT Security**: 8 jam untuk web dashboard, 30 hari untuk mobile app
- **Separate Web Portals**: Admin dashboard & Doctor dashboard

### **👨‍⚕️ Admin Features**
1. **Comprehensive Patient Management**
   - Registrasi pasien baru dengan auto-generated email & unique QR code
   - Generate & print kartu pasien dalam format PDF
   - QR-based patient check-in system
   - Complete patient data management & history

2. **Doctor Management System**
   - Full CRUD operations untuk data dokter
   - Jadwal praktik management dengan time slots
   - Real-time doctor availability & duty status monitoring
   - Performance metrics & consultation tracking

3. **Intelligent Queue Management**
   - Automated queue system dengan estimasi waktu tunggu
   - QR code-based patient check-in
   - Call next patient functionality dengan notifications
   - Queue analytics & reporting

4. **Digital Prescription Management**
   - Verifikasi resep digital menggunakan unique codes
   - Integrated payment processing dengan Midtrans gateway
   - Medication inventory management dengan stock tracking
   - Prescription dispensing workflow

### **👩‍⚕️ Doctor Features**
1. **Real-time Queue Dashboard**
   - Live queue monitoring dengan patient details
   - Complete consultation workflow dengan diagnosis input
   - Access to comprehensive patient medical history
   - Consultation notes & follow-up scheduling

2. **Advanced Digital Prescription System**
   - Create digital prescriptions dengan extensive medication database
   - Auto-generate secure prescription verification codes
   - Direct integration dengan payment & pharmacy system
   - Prescription templates untuk efficiency

3. **Online Consultation Platform**
   - Real-time chat system dengan patients
   - AI-powered symptom analysis & recommendations
   - Appointment booking & scheduling system
   - Video consultation capabilities (future enhancement)

### **📱 Mobile API Features**
1. **Patient Portal**
   - Personal QR code untuk instant check-in
   - Complete medical history access dengan search functionality
   - Lab results viewer dengan AI-powered interpretations
   - Real-time prescription tracking & status updates

2. **Telemedicine System**
   - Online consultation booking dengan available doctors
   - Real-time messaging dengan healthcare providers
   - AI-powered symptom checker untuk preliminary assessment
   - Appointment reminders & notifications

3. **Integrated Payment System**
   - Midtrans payment gateway integration
   - Multiple payment methods (Virtual Account, QRIS, E-wallet, Credit Card)
   - Automatic prescription dispensing setelah payment confirmation
   - Payment history & digital receipts

## 🛠 API Documentation

### **Authentication Endpoints**
```
POST /api/auth/login                    # Mobile app authentication
POST /api/web/admin/login              # Admin web dashboard login  
POST /api/web/doctor/login             # Doctor web dashboard login
POST /api/auth/refresh                 # JWT token refresh
POST /api/auth/logout                  # Secure logout
```

### **Admin Management Endpoints**
```
# Patient Management
GET    /api/web/admin/patients         # List all patients
POST   /api/web/admin/patients         # Register new patient
PUT    /api/web/admin/patients/:id     # Update patient data
DELETE /api/web/admin/patients/:id     # Delete patient
GET    /api/web/admin/patients/:id/card # Generate patient card PDF

# Doctor Management
GET    /api/web/admin/doctors          # List all doctors
POST   /api/web/admin/doctors          # Add new doctor
PUT    /api/web/admin/doctors/:id      # Update doctor data
DELETE /api/web/admin/doctors/:id      # Remove doctor

# Queue Management
GET    /api/web/admin/queue            # Current queue status
POST   /api/web/admin/checkin          # QR-based patient check-in
PUT    /api/web/admin/queue/:id/call   # Call next patient
GET    /api/web/admin/queue/analytics  # Queue performance metrics

# Prescription Management
GET    /api/web/admin/prescriptions    # All prescriptions
POST   /api/web/admin/prescriptions/verify # Verify prescription code
PUT    /api/web/admin/prescriptions/:id/dispense # Dispense medication
```

### **Doctor Portal Endpoints**
```
GET    /api/web/doctor/dashboard       # Doctor dashboard data
GET    /api/web/doctor/queue           # Current patient queue
POST   /api/web/doctor/consultations   # Complete consultation
GET    /api/web/doctor/patients/:id    # Patient medical history
POST   /api/web/doctor/prescriptions   # Create digital prescription
GET    /api/web/doctor/schedule        # Doctor schedule management
POST   /api/web/doctor/chat            # Online consultation chat
```

### **Mobile Application Endpoints**
```
# Patient Features
GET    /api/mobile/profile             # Patient profile data
GET    /api/mobile/medical-history     # Medical history
GET    /api/mobile/lab-results         # Lab results dengan AI analysis
GET    /api/mobile/prescriptions       # Active prescriptions
POST   /api/mobile/qr/checkin          # QR code check-in

# Consultation Features  
GET    /api/mobile/consultations       # Consultation history
POST   /api/mobile/consultations       # Book new consultation
GET    /api/mobile/doctors             # Available doctors
POST   /api/mobile/chat                # Real-time chat
POST   /api/mobile/symptoms/analyze    # AI symptom analysis

# Payment Features
POST   /api/mobile/payments            # Process payments
GET    /api/mobile/payments/history    # Payment history
POST   /api/mobile/payments/verify     # Verify payment status
```

## 💾 Database Schema Overview

### **Core Tables**
- **users**: Multi-role user management dengan fingerprint support
- **doctors**: Doctor profiles dengan specialization & schedules
- **patients**: Patient data dengan generated QR codes
- **queue**: Real-time queue management dengan time estimates
- **consultations**: Online & offline consultation records
- **prescriptions**: Digital prescriptions dengan verification codes
- **medications**: Medication inventory dengan pricing
- **payments**: Midtrans integration dengan transaction tracking
- **medical_history**: Comprehensive patient medical records
- **notifications**: Real-time system notifications

### **Key Relationships**
- Users dapat memiliki multiple roles (Patient/Doctor/Admin)
- Doctors memiliki jadwal praktik yang fleksibel
- Queue system terintegrasi dengan consultation workflow
- Prescriptions terhubung dengan payment & medication systems

## 🔧 Environment Configuration

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/hospitalink"

# JWT Security
JWT_SECRET="hospitalink-jwt-secret-key"
JWT_WEB_EXPIRES_IN="8h"
JWT_MOBILE_EXPIRES_IN="30d"

# Server Configuration
PORT=5000
NODE_ENV="development"

# Payment Gateway (Midtrans)
MIDTRANS_SERVER_KEY="your-midtrans-server-key"
MIDTRANS_CLIENT_KEY="your-midtrans-client-key"
MIDTRANS_IS_PRODUCTION=false

# AI Service Configuration
AI_API_KEY="your-ai-service-key"
AI_BASE_URL="https://api.openai.com/v1"

# Email Service (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

## 🎯 Technology Stack

### **Backend Framework**
- **Node.js** dengan Express.js
- **Prisma ORM** untuk database management
- **PostgreSQL** sebagai primary database
- **JWT** untuk authentication & authorization

### **Key Integrations**
- **Midtrans Payment Gateway**: Multi-method payment processing
- **AI Service Integration**: Symptom analysis & medical recommendations
- **QR Code System**: Patient identification & check-in automation
- **Real-time WebSocket**: Chat & notification system
- **PDF Generation**: Patient cards & medical reports

### **Security Features**
- **Bcrypt Password Hashing**: Secure password storage
- **JWT Token Management**: Role-based access control
- **Input Validation**: Comprehensive data validation
- **Rate Limiting**: API abuse prevention
- **CORS Configuration**: Cross-origin resource sharing

## 📊 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Admin Web      │    │  Doctor Web     │
│   (React Native)│    │  Dashboard      │    │  Dashboard      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  HospitaLink    │
                    │  Backend API    │
                    │  (Node.js)      │
                    └─────────┬───────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────▼───────┐ ┌─────────▼───────┐ ┌─────────▼───────┐
│   PostgreSQL    │ │    Midtrans     │ │   AI Service    │
│   Database      │ │   Payment       │ │   (OpenAI)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🚀 Deployment Guide

### **Development**
```bash
npm run dev          # Development server dengan auto-reload
npm run seed:dev     # Seed development data
npm run prisma:studio # Database GUI management
```

### **Production**
```bash
npm run build        # Build production assets
npm start           # Start production server
npm run migrate     # Run database migrations
```

### **Docker Deployment**
```bash
docker build -t hospitalink-be .
docker run -p 5000:5000 --env-file .env hospitalink-be
```

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:coverage      # Test coverage report
```

## 📈 Monitoring & Analytics

- **API Response Time Monitoring**
- **Database Query Performance**
- **Queue Management Analytics**
- **Payment Transaction Tracking**
- **User Engagement Metrics**

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 📞 Support & Contact

- **Email**: support@hospitalink.com
- **Documentation**: [API Documentation](https://api.hospitalink.com/docs)
- **Issues**: [GitHub Issues](https://github.com/hospitalink/backend/issues)

---

**HospitaLink Backend** - Revolutionizing Healthcare Management with Modern Technology 🏥✨