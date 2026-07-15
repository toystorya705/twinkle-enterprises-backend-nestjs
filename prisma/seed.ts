import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';

console.log('========================================');
console.log('🌱 Prisma Seed Starting...');
console.log('========================================');

const databaseUrl = process.env.DATABASE_URL;

console.log('DATABASE_URL:', databaseUrl ? 'Loaded ✅' : 'Missing ❌');
console.log(
  'DATABASE_URL (masked):',
  databaseUrl
    ? databaseUrl.replace(/:\/\/(.*?):(.*?)@/, '://$1:********@')
    : 'N/A'
);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Prisma seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

async function main() {
  try {
    console.log('\n📌 Reading environment variables...');

    const adminEmail = (
      process.env.SEED_ADMIN_EMAIL ??
      'aryan.gupta.ary@gmail.com'
    )
      .toLowerCase()
      .trim();

    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    console.log('Admin Email:', adminEmail);
    console.log(
      'Admin Password:',
      adminPassword ? 'Loaded ✅' : 'Missing ❌'
    );

    if (!adminPassword) {
      throw new Error(
        'SEED_ADMIN_PASSWORD is required to seed the first administrator'
      );
    }

    console.log('\n📌 Upserting Super Admin role...');

    const superAdminRole = await prisma.role.upsert({
      where: {
        name: 'Super Admin',
      },
      update: {},
      create: {
        id: randomUUID(),
        name: 'Super Admin',
        description: 'Full administrative access',
      },
    });

    console.log('✅ Role Ready');
    console.log(superAdminRole);

    console.log('\n📌 Counting Super Admin users...');

    const adminCount = await prisma.user.count({
      where: {
        OR: [
          {
            roleId: superAdminRole.id,
          },
          {
            UserRole: {
              some: {
                roleId: superAdminRole.id,
              },
            },
          },
        ],
      },
    });

    console.log('Admin Count:', adminCount);

    if (adminCount > 0) {
      console.log('⚠️ Super Admin already exists.');
      console.log('Seed finished successfully.');
      return;
    }

    console.log('\n📌 Looking for existing user...');

    const existing = await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });

    console.log(
      existing
        ? 'Existing user found.'
        : 'No existing user found.'
    );

    let user;

    if (existing) {
      console.log('\n📌 Updating existing user...');

      user = await prisma.user.update({
        where: {
          id: existing.id,
        },
        data: {
          roleId: superAdminRole.id,
          isActive: true,
          emailVerifiedAt:
            existing.emailVerifiedAt ?? new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ Existing user updated.');
    } else {
      console.log('\n📌 Creating new Super Admin...');

      user = await prisma.user.create({
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

      console.log('✅ User created.');
    }

    console.log('\n📌 Upserting UserRole...');

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    });

    console.log('✅ UserRole Ready');

    console.log('\n🎉 Seed Completed Successfully!');
  } catch (error) {
    console.error('\n❌ Seed Failed');
    console.error(error);
    throw error;
  } finally {
    console.log('\n🔌 Disconnecting Prisma...');
    await prisma.$disconnect();
    console.log('✅ Disconnected');
  }
}

main();