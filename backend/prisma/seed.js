require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

const adapter = new PrismaBetterSqlite3({
  url: DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.gameAttempt.deleteMany();
  await prisma.roomPlayer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.question.deleteMany();
  await prisma.questionSet.deleteMany();
  await prisma.user.deleteMany();

  const teacherPasswordHash = await bcrypt.hash('teacher123', 10);
  const studentPasswordHash = await bcrypt.hash('student123', 10);

  await prisma.user.createMany({
    data: [
      {
        username: 'teacher1',
        name: 'Teacher One',
        role: 'teacher',
        passwordHash: teacherPasswordHash,
      },
      {
        username: 'student1',
        name: 'Student One',
        role: 'student',
        passwordHash: studentPasswordHash,
      },
    ],
  });

  const questionSet = await prisma.questionSet.create({
    data: {
      title: 'ชุดคำถามพื้นฐาน',
      description: 'คำถามตัวอย่างสำหรับทดสอบระบบ',
      createdBy: 'teacher1',
      timeLimit: 30,
      map: '/map1.png',
      questions: {
        create: [
          {
            question: 'เมืองหลวงของประเทศไทยคืออะไร?',
            type: 'multiple-choice',
            options: ['เชียงใหม่', 'กรุงเทพมหานคร', 'ขอนแก่น', 'ภูเก็ต'],
            correctAnswer: 'กรุงเทพมหานคร',
            points: 100,
          },
          {
            question: '2 + 2 เท่ากับข้อใด?',
            type: 'multiple-choice',
            options: ['3', '4', '5', '6'],
            correctAnswer: '4',
            points: 100,
          },
          {
            question: 'สีของท้องฟ้าในวันที่อากาศดีคือสีอะไร?',
            type: 'multiple-choice',
            options: ['แดง', 'น้ำเงิน', 'เขียว', 'ม่วง'],
            correctAnswer: 'น้ำเงิน',
            points: 100,
          },
        ],
      },
    },
  });

  const room = await prisma.room.create({
    data: {
      code: 'ROOM01',
      name: 'ห้องทดสอบระบบ',
      status: 'waiting',
      isActive: true,
      questionSetId: questionSet.id,
    },
  });

  await prisma.roomPlayer.createMany({
    data: [
      { roomId: room.id, name: 'นักเรียน A' },
      { roomId: room.id, name: 'นักเรียน B' },
    ],
  });

  await prisma.gameAttempt.createMany({
    data: [
      {
        roomId: room.id,
        playerId: 'student-001',
        playerName: 'นักเรียน A',
        score: 200,
        rank: 1,
        totalPlayers: 2,
      },
      {
        roomId: room.id,
        playerId: 'student-002',
        playerName: 'นักเรียน B',
        score: 100,
        rank: 2,
        totalPlayers: 2,
      },
    ],
  });

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
