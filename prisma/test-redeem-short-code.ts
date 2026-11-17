/**
 * LOT MORE WINS — REDEEM SHORT CODES (TEST database: inserts two redeem_codes rows and deletes them)
 * The 8-character code under a redeem QR is typed at the outlet; the server turns it back into the QR.
 *
 *   npx tsx --env-file=.env prisma/test-redeem-short-code.ts
 */
import prisma from '../apps/web/lib/prisma';
import { formatShortCode, isRedeemInput, normalizeShortCode, resolveRedeemInput } from '../apps/web/lib/redemptions';

let failed = 0;
function assert(condition: boolean, name: string, details?: unknown) {
  if (condition) console.log(`  ✅ PASS: ${name}`);
  else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`, details ?? '');
  }
}

async function main() {
  if (!/ep-mute-poetry/.test(process.env.DATABASE_URL ?? '')) throw new Error('Run against the TEST database only');

  console.log('\nTyped forms');
  assert(normalizeShortCode('K7Q2-9XPA') === 'K7Q29XPA', 'with the dash');
  assert(normalizeShortCode(' k7q2 9xpa ') === 'K7Q29XPA', 'lower case and spaces');
  assert(normalizeShortCode('LMW-RDM.K7Q29XPA') === 'K7Q29XPA', 'with the LMW-RDM. prefix (current Outlet Admin builds)');
  assert(normalizeShortCode('K7Q2-9XP') === null, 'too short');
  assert(normalizeShortCode('K7Q2-9XP0') === null, 'look-alike 0 is not in codes');
  assert(normalizeShortCode('LMW-DISC-0123456789ABCDEF') === null, 'a discount QR is not a short code');
  assert(normalizeShortCode('LMW-RDM.eyJhbGciOi.abc.def') === null, 'a full redeem QR is not a short code');
  assert(isRedeemInput('K7Q2-9XPA') && isRedeemInput('LMW-RDM.eyJ.x.y') && !isRedeemInput('LMW-REF-0123456789ABCDEF'), 'routing');
  assert(formatShortCode('K7Q29XPA') === 'K7Q2-9XPA', 'shown as XXXX-XXXX');

  console.log('\nLookup');
  const live = 'ZZTEST23';
  const old = 'ZZTEST24';
  await prisma.redeemCode.deleteMany({ where: { code: { in: [live, old] } } });
  await prisma.redeemCode.createMany({
    data: [
      { code: live, qrCode: 'LMW-RDM.full-token-live', partnerId: 'test', expiresAt: new Date(Date.now() + 600_000) },
      { code: old, qrCode: 'LMW-RDM.full-token-old', partnerId: 'test', expiresAt: new Date(Date.now() - 1000) },
    ],
  });
  try {
    assert((await resolveRedeemInput('zzte-st23')) === 'LMW-RDM.full-token-live', 'a live code becomes its QR');
    assert((await resolveRedeemInput('LMW-DISC-0123456789ABCDEF')) === 'LMW-DISC-0123456789ABCDEF', 'other input is passed through');
    for (const [code, name] of [
      [old, 'an expired code is refused'],
      ['ZZTEST25', 'an unknown code is refused'],
    ] as const) {
      try {
        await resolveRedeemInput(code);
        assert(false, name);
      } catch (e) {
        assert((e as { code?: string }).code === 'REDEEM_QR_INVALID', name, e);
      }
    }
  } finally {
    await prisma.redeemCode.deleteMany({ where: { code: { in: [live, old] } } });
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
}

main().finally(() => prisma.$disconnect());
