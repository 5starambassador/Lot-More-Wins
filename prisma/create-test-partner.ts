import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Creates a partner login for app store reviewers / QA on the LIVE database, the same way
// /api/partner/onboarding does (partner code + the two permanent QR codes), minus the OTP.
// Raw SQL on purpose: the live DB can lag the local schema, so only base columns are written.
// Usage: TEST_PARTNER_PASSWORD=... pnpm exec tsx prisma/create-test-partner.ts
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TEST_PARTNER = {
  name: 'Test Partner (App Review)',
  mobile: '9000000001',
  email: 'apptest@lotmorewins.com',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
};

const token = (prefix: string, bytes: number) => `${prefix}${crypto.randomBytes(bytes).toString('hex').toUpperCase()}`;

async function main() {
  const url = process.env.LIVE_DATABASE_URL;
  if (!url) throw new Error('LIVE_DATABASE_URL is not set in .env');
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const { name, mobile, email, city, state, pincode } = TEST_PARTNER;
    const existing = await prisma.$queryRaw<{ partner_code: string; status: string }[]>`
      SELECT partner_code, status::text FROM partners WHERE mobile = ${mobile} OR email = ${email}`;
    if (existing.length) {
      console.log(`Already exists: ${existing[0].partner_code}, status ${existing[0].status}`);
      return;
    }

    const password = process.env.TEST_PARTNER_PASSWORD;
    if (!password) throw new Error('TEST_PARTNER_PASSWORD is not set');

    const id = crypto.randomUUID();
    const partnerCode = token('LMW-P-', 3);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.$executeRaw`
        INSERT INTO partners (id, partner_code, name, mobile, email, password_hash, city, state, pincode, status, created_at, updated_at)
        VALUES (${id}, ${partnerCode}, ${name}, ${mobile}, ${email}, ${passwordHash}, ${city}, ${state}, ${pincode},
                'ACTIVE'::"PartnerStatus", now(), now())`,
      prisma.$executeRaw`
        INSERT INTO qr_codes (id, partner_id, code, type, status, created_at, updated_at) VALUES
          (${crypto.randomUUID()}, ${id}, ${token('LMW-DISC-', 8)}, 'DEFAULT_DISCOUNT'::"QRCodeType", 'ACTIVE'::"QRCodeStatus", now(), now()),
          (${crypto.randomUUID()}, ${id}, ${token('LMW-REF-', 8)}, 'REFERRAL'::"QRCodeType", 'ACTIVE'::"QRCodeStatus", now(), now())`,
    ]);
    console.log(`Created ${partnerCode}: ${mobile} / ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
