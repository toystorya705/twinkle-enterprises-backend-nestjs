import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Prisma seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'aryan.gupta.ary@gmail.com')
    .toLowerCase()
    .trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required to seed the first administrator');
  }

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Super Admin',
      description: 'Full administrative access', 
    },
  });

  const adminCount = await prisma.user.count({
    where: {
      OR: [
        { roleId: superAdminRole.id },
        { UserRole: { some: { roleId: superAdminRole.id } } },
      ],
    },
  });

  if (adminCount > 0) {
    console.log('Super Admin already exists; seed skipped.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          roleId: superAdminRole.id,
          isActive: true,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          updatedAt: new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          id: randomUUID(),
          email: adminEmail,
          passwordHash: await hash(adminPassword, 12),
          name: 'Super Admin',
          isActive: true,
          emailVerifiedAt: new Date(),
          roleId: superAdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: user.id, roleId: superAdminRole.id },
  });

  console.log(`Super Admin ready: ${adminEmail}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
