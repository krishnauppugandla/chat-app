import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const daysAgo = (days, hoursOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hoursOffset);
  return d;
};

async function main() {
  // Wipe existing data in correct dependency order
  await prisma.reaction.deleteMany();
  await prisma.messageStatus.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.create({
    data: {
      name: 'Alice Chen',
      email: 'alice@demo.com',
      password_hash: passwordHash,
      bio: 'Product engineer @ Startup. Coffee enthusiast.',
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Mehta',
      email: 'bob@demo.com',
      password_hash: passwordHash,
      bio: 'Backend dev. Golang, Postgres, k8s.',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Verma',
      email: 'charlie@demo.com',
      password_hash: passwordHash,
      bio: 'Design → Code. Figma is life.',
    },
  });

  // 1:1 chat between Alice and Bob
  const dmChat = await prisma.chat.create({
    data: {
      is_group: false,
      created_by: alice.id,
      updated_at: daysAgo(0, 2),
      members: {
        create: [
          { user_id: alice.id },
          { user_id: bob.id },
        ],
      },
    },
  });

  const dmMessages = [
    { sender: bob.id, content: "Hey Alice, quick question — is the PR ready for review?", offset: 6, hoursAgo: 2 },
    { sender: alice.id, content: "Almost! Just cleaning up the migration file. Give me 10 mins.", offset: 5, hoursAgo: 2 },
    { sender: bob.id, content: "No rush, take your time. I'll grab coffee and circle back.", offset: 4, hoursAgo: 2 },
    { sender: alice.id, content: "Done! Sent you the PR link in Slack. LGTM check on the auth middleware especially.", offset: 3, hoursAgo: 1 },
    { sender: bob.id, content: "Reviewed. Left two small comments but overall looks solid. Approved ✓", offset: 2, hoursAgo: 1 },
    { sender: alice.id, content: "Perfect, merging now. Thanks for the fast review 🙏", offset: 1, hoursAgo: 0 },
  ];

  for (const msg of dmMessages) {
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - msg.hoursAgo);
    createdAt.setMinutes(createdAt.getMinutes() - msg.offset);

    await prisma.message.create({
      data: {
        chat_id: dmChat.id,
        sender_id: msg.sender,
        content: msg.content,
        created_at: createdAt,
      },
    });
  }

  // Group chat with all three
  const groupChat = await prisma.chat.create({
    data: {
      name: 'Team Chat',
      is_group: true,
      created_by: alice.id,
      updated_at: daysAgo(0, 0),
      members: {
        create: [
          { user_id: alice.id, role: 'admin' },
          { user_id: bob.id },
          { user_id: charlie.id },
        ],
      },
    },
  });

  const groupMessages = [
    { sender: charlie.id, content: "Hey team — finished the new sidebar designs. Dropped them in Figma, link in the design channel.", daysAgo: 2, minOffset: 45 },
    { sender: alice.id, content: "Oh nice, I'll take a look after standup. Does it handle the mobile breakpoints?", daysAgo: 2, minOffset: 40 },
    { sender: charlie.id, content: "Yep, 3 breakpoints: 320, 768, 1280. Also dark mode variants included.", daysAgo: 2, minOffset: 35 },
    { sender: bob.id, content: "This looks really clean Charlie. Way better than what we had. +1 from me.", daysAgo: 1, minOffset: 60 },
    { sender: alice.id, content: "Agreed. Let's get this into the sprint. Bob, can you create the implementation ticket?", daysAgo: 1, minOffset: 55 },
    { sender: bob.id, content: "Already on it. Ticket created, assigned to Charlie. Due end of week.", daysAgo: 0, minOffset: 10 },
  ];

  for (const msg of groupMessages) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - msg.daysAgo);
    createdAt.setMinutes(createdAt.getMinutes() - msg.minOffset);

    await prisma.message.create({
      data: {
        chat_id: groupChat.id,
        sender_id: msg.sender,
        content: msg.content,
        created_at: createdAt,
      },
    });
  }

  console.log('✓ Seeded successfully');
  console.log('  Login with alice@demo.com / password123');
  console.log('  Or try bob@demo.com / password123');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
