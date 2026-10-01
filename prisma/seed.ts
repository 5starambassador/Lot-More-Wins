import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Lot More Wins ---');

  // Super Admin credentials come only from the environment; nothing is hardcoded.
  const adminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 8) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SUPER_ADMIN_PASSWORD must be at least 8 characters');
      }
      console.warn('⚠️  SUPER_ADMIN_PASSWORD is shorter than 8 characters — allowed outside production only');
    }
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    await prisma.superAdmin.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
      create: {
        email: adminEmail,
        name: process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin',
        passwordHash,
      },
    });
    console.log(`✅ Super Admin ensured for ${adminEmail}`);
  } else {
    console.log('ℹ️  SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping Super Admin seed');
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
