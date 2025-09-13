const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const medicationsData = [
  // Analgesik & Antipiretik
  {
    medicationCode: 'PAR001',
    genericName: 'Paracetamol',
    brandName: 'Panadol',
    category: 'Analgesik & Antipiretik',
    dosageForm: 'Tablet',
    strength: '500mg',
    unit: 'tablet',
    manufacturer: 'GSK',
    description: 'Obat pereda nyeri dan penurun demam',
    indications: 'Nyeri ringan hingga sedang, demam',
    dosageInstructions: '1-2 tablet setiap 4-6 jam, maksimal 8 tablet per hari',
    pricePerUnit: 1500,
    stock: 500,
    minStock: 50,
    isActive: true,
    requiresPrescription: false
  },
  {
    medicationCode: 'IBU001',
    genericName: 'Ibuprofen',
    brandName: 'Proris',
    category: 'Anti-inflamasi Non-steroid',
    dosageForm: 'Tablet',
    strength: '400mg',
    unit: 'tablet',
    manufacturer: 'Tempo Scan Pacific',
    description: 'Obat anti-inflamasi dan pereda nyeri',
    indications: 'Nyeri, inflamasi, demam',
    dosageInstructions: '1 tablet setiap 6-8 jam dengan makanan',
    pricePerUnit: 2500,
    stock: 300,
    minStock: 30,
    isActive: true,
    requiresPrescription: false
  },
  
  // Antibiotik
  {
    medicationCode: 'AMX001',
    genericName: 'Amoxicillin',
    brandName: 'Amoxsan',
    category: 'Antibiotik',
    dosageForm: 'Kapsul',
    strength: '500mg',
    unit: 'kapsul',
    manufacturer: 'Bernofarm',
    description: 'Antibiotik beta-laktam',
    indications: 'Infeksi bakteri saluran napas, kulit, dan jaringan lunak',
    contraindications: 'Alergi penisilin',
    dosageInstructions: '1 kapsul 3 kali sehari',
    pricePerUnit: 3500,
    stock: 200,
    minStock: 25,
    isActive: true,
    requiresPrescription: true
  },
  {
    medicationCode: 'AZI001',
    genericName: 'Azithromycin',
    brandName: 'Zithromax',
    category: 'Antibiotik',
    dosageForm: 'Tablet',
    strength: '500mg',
    unit: 'tablet',
    manufacturer: 'Pfizer',
    description: 'Antibiotik makrolida',
    indications: 'Infeksi saluran napas, kulit, dan kelamin',
    dosageInstructions: '1 tablet sekali sehari selama 3 hari',
    pricePerUnit: 15000,
    stock: 100,
    minStock: 15,
    isActive: true,
    requiresPrescription: true
  },
  
  // Vitamin & Suplemen
  {
    medicationCode: 'VIT001',
    genericName: 'Vitamin C',
    brandName: 'Redoxon',
    category: 'Vitamin & Suplemen',
    dosageForm: 'Tablet Effervescent',
    strength: '1000mg',
    unit: 'tablet',
    manufacturer: 'Bayer',
    description: 'Suplemen vitamin C untuk daya tahan tubuh',
    indications: 'Meningkatkan daya tahan tubuh, mencegah sariawan',
    dosageInstructions: '1 tablet per hari dilarutkan dalam air',
    pricePerUnit: 5000,
    stock: 150,
    minStock: 20,
    isActive: true,
    requiresPrescription: false
  },
  {
    medicationCode: 'VIT002',
    genericName: 'Multivitamin',
    brandName: 'Blackmores',
    category: 'Vitamin & Suplemen',
    dosageForm: 'Tablet',
    strength: 'Multi',
    unit: 'tablet',
    manufacturer: 'Blackmores',
    description: 'Suplemen multivitamin dan mineral',
    indications: 'Menjaga kesehatan tubuh secara umum',
    dosageInstructions: '1 tablet per hari setelah makan',
    pricePerUnit: 8000,
    stock: 100,
    minStock: 15,
    isActive: true,
    requiresPrescription: false
  },
  
  // Obat Lambung
  {
    medicationCode: 'OME001',
    genericName: 'Omeprazole',
    brandName: 'Losec',
    category: 'Obat Lambung',
    dosageForm: 'Kapsul',
    strength: '20mg',
    unit: 'kapsul',
    manufacturer: 'AstraZeneca',
    description: 'Penghambat pompa proton untuk asam lambung',
    indications: 'Tukak lambung, GERD, gastritis',
    dosageInstructions: '1 kapsul sekali sehari sebelum makan',
    pricePerUnit: 12000,
    stock: 80,
    minStock: 10,
    isActive: true,
    requiresPrescription: true
  },
  
  // Obat Batuk & Flu
  {
    medicationCode: 'DXM001',
    genericName: 'Dextromethorphan',
    brandName: 'Bisolvon Extra',
    category: 'Obat Batuk & Ekspektoran',
    dosageForm: 'Sirup',
    strength: '15mg/5ml',
    unit: 'botol',
    manufacturer: 'Boehringer Ingelheim',
    description: 'Obat batuk kering',
    indications: 'Batuk kering tidak berdahak',
    dosageInstructions: '1 sendok teh (5ml) 3 kali sehari',
    pricePerUnit: 25000,
    stock: 50,
    minStock: 10,
    isActive: true,
    requiresPrescription: false
  },
  
  // Antidiabetes
  {
    medicationCode: 'MET001',
    genericName: 'Metformin',
    brandName: 'Glucophage',
    category: 'Antidiabetes',
    dosageForm: 'Tablet',
    strength: '500mg',
    unit: 'tablet',
    manufacturer: 'Merck',
    description: 'Obat diabetes tipe 2',
    indications: 'Diabetes mellitus tipe 2',
    contraindications: 'Gagal ginjal, gagal jantung',
    dosageInstructions: '1 tablet 2-3 kali sehari dengan makanan',
    pricePerUnit: 4000,
    stock: 200,
    minStock: 30,
    isActive: true,
    requiresPrescription: true,
    isControlled: true
  },
  
  // Antihipertensi
  {
    medicationCode: 'AML001',
    genericName: 'Amlodipine',
    brandName: 'Norvasc',
    category: 'Antihipertensi',
    dosageForm: 'Tablet',
    strength: '5mg',
    unit: 'tablet',
    manufacturer: 'Pfizer',
    description: 'Obat tekanan darah tinggi',
    indications: 'Hipertensi, angina pektoris',
    dosageInstructions: '1 tablet sekali sehari',
    pricePerUnit: 6000,
    stock: 150,
    minStock: 20,
    isActive: true,
    requiresPrescription: true,
    isControlled: true
  }
];

async function seedMedications() {
  try {
    console.log('🌱 Seeding medications data...');
    
    for (const medication of medicationsData) {
      await prisma.medication.upsert({
        where: { medicationCode: medication.medicationCode },
        update: medication,
        create: medication
      });
    }
    
    console.log(`✅ Successfully seeded ${medicationsData.length} medications`);
    
    // Show summary by category
    const categories = await prisma.medication.groupBy({
      by: ['category'],
      _count: {
        id: true
      }
    });
    
    console.log('\n📊 Medications by category:');
    categories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count.id} items`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding medications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedMedications();
}

module.exports = { seedMedications };