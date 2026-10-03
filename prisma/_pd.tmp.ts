import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/web/.env.local' }); dotenv.config({ path: '.env.local' }); dotenv.config({ path: '.env' });
(async () => {
  const { default: prisma } = await import('../apps/web/lib/prisma');
  const { signToken } = await import('../apps/web/lib/auth');
  const admin = await prisma.superAdmin.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  const partner = await prisma.partner.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } });
  const token = signToken({ typ: 'super_admin', sub: admin!.id }, 300);
  const base = 'http://localhost:3000';
  const get = async (path: string) => {
    const res = await fetch(base + path, { headers: { cookie: `lmw_admin_session=${token}` }, redirect: 'manual' });
    const text = await res.text();
    return { status: res.status, text };
  };
  for (const path of [`/api/admin/partners/${partner!.id}`, `/api/admin/partners/${partner!.id}/activity?page=1&limit=20`, `/api/admin/outlets?view=options`, `/partners/${partner!.id}`]) {
    const r = await get(path);
    const err = /"message":"([^"]+)"/.exec(r.text)?.[1] ?? /<title>([^<]+)<\/title>/.exec(r.text)?.[1] ?? '';
    const digest = /(Error|error)[^<]{0,200}/.exec(r.text)?.[0] ?? '';
    console.log(r.status, path.replace(partner!.id, '<partner>'), '|', err, r.status >= 400 ? '| ' + digest.slice(0, 200) : '');
  }
  await prisma.$disconnect();
})();
