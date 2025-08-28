const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const familyMemberSeeder = async () => {
  console.log('  👨‍👩‍👧‍👦 Creating family relationships...');

  // Get users for creating family relationships
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    take: 5
  });

  if (users.length < 2) {
    console.log('  ⚠️ Not enough users to create family relationships');
    return;
  }

  const familyRelations = [
    {
      userId: users[0].id, // Budi Santoso as family head
      memberId: users[1].id, // Siti as spouse
      relation: 'SPOUSE',
      nickname: 'Istri',
      isEmergencyContact: true
    },
    {
      userId: users[1].id, // Siti as family head
      memberId: users[0].id, // Budi as spouse
      relation: 'SPOUSE',
      nickname: 'Suami',
      isEmergencyContact: true
    },
    {
      userId: users[0].id, // Budi as family head
      memberId: users[2].id, // Andi as sibling
      relation: 'SIBLING',
      nickname: 'Adik',
      isEmergencyContact: false
    },
    {
      userId: users[2].id, // Andi as family head
      memberId: users[3].id, // Lisa as spouse
      relation: 'SPOUSE',
      nickname: 'Istri',
      isEmergencyContact: true
    }
  ];

  for (const relation of familyRelations) {
    await prisma.familyMember.upsert({
      where: {
        userId_memberId: {
          userId: relation.userId,
          memberId: relation.memberId
        }
      },
      update: {},
      create: relation,
    });
  }

  console.log(`  ✅ ${familyRelations.length} family relationships created`);
};

module.exports = familyMemberSeeder;