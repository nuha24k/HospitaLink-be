const { PrismaClient } = require('@prisma/client');

const userSeeder = require('./seeder/userSeeder');

const prisma = new PrismaClient();

const main = async () => {
  console.log('Starting seeding...');
  try {
    await userSeeder();
    console.log('Seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
};

main();