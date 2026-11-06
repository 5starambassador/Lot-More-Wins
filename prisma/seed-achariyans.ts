/**
 * Loads the Achariya college students list into the achariyans table. Safe to run again: rows
 * already loaded (matched by sheet + serial number) are left as they are.
 * The spreadsheet holds students' personal details, so it is gitignored and never committed.
 *
 *   pnpm exec tsx prisma/seed-achariyans.ts           (the database in DATABASE_URL, test locally)
 *   pnpm exec tsx prisma/seed-achariyans.ts --live    (LIVE_DATABASE_URL)
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// exceljs is a dependency of the web app.
const ExcelJS = createRequire(path.resolve(__dirname, '../apps/web/package.json'))('exceljs');

const FILE = path.resolve(__dirname, '../apps/web/assets/data/Achariya College Only Students .xlsx');
const COLLEGE_BY_SHEET: Record<string, string> = { ARTS: 'AASC', ACET: 'ACET' };
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const BATCH = 500;

/** "BCOM HONS - Year 2 - Semester I", "BA HONS ENGLISH Year 1 - Semester I", or just "DPPE". */
function parseCourse(course: string) {
  const match = course.match(/^(.*?)\s*-?\s*Year\s*(\d+)\s*-\s*Semester\s*([IVX]+)$/i);
  if (!match) return { degree: course, year: null, semester: null };
  const semester = ROMAN[match[3]!.toUpperCase()];
  if (!semester) throw new Error(`Unknown semester in "${course}"`);
  return { degree: match[1]!, year: Number(match[2]), semester };
}

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown };
    return String(cell.text ?? cell.result ?? '').trim();
  }
  return String(value).trim();
};

async function readStudents() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FILE);
  const students = [];
  for (const [sheet, college] of Object.entries(COLLEGE_BY_SHEET)) {
    const worksheet = workbook.getWorksheet(sheet);
    if (!worksheet) throw new Error(`Sheet ${sheet} not found`);
    // The sheets have no header row: columns are serial, college name, student name, mobile, course.
    worksheet.eachRow((row: { getCell(column: number): { value: unknown } }, rowNumber: number) => {
      const [serial, name, mobile, course] = [1, 3, 4, 5].map((column) => cellText(row.getCell(column).value));
      if (!name && !mobile && !course) return;
      if (!serial || !name || !mobile || !course) throw new Error(`${sheet} row ${rowNumber} is incomplete`);
      students.push({ category: 'STUDENT' as const, college, ...parseCourse(course), name, mobile, sourceRef: `${college}-${serial}` });
    });
  }
  if (new Set(students.map((s) => s.sourceRef)).size !== students.length) throw new Error('Serial numbers repeat within a sheet');
  return students;
}

async function main() {
  const live = process.argv.includes('--live');
  const url = live ? process.env.LIVE_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error(`${live ? 'LIVE_DATABASE_URL' : 'DATABASE_URL'} is not set`);
  console.log(`Database: ${new URL(url).hostname}`);

  const students = await readStudents();
  console.log(`Read ${students.length} students`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    let added = 0;
    for (let start = 0; start < students.length; start += BATCH) {
      const { count } = await prisma.achariyan.createMany({ data: students.slice(start, start + BATCH), skipDuplicates: true });
      added += count;
    }
    console.log(`Added ${added}, already there ${students.length - added}`);
    const totals = await prisma.achariyan.groupBy({ by: ['category', 'college'], _count: { _all: true }, orderBy: [{ category: 'asc' }, { college: 'asc' }] });
    for (const t of totals) console.log(`  ${t.category} ${t.college}: ${t._count._all}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
