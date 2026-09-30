import { PrismaClient, AchariyaRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Authoritative Achariya Records ---');

  // Seed Staff and Teachers
  const employees = [
    {
      employeeId: 'ACH-STF-101',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@achariya.in',
      phone: '9876543210',
      role: AchariyaRole.STAFF,
      department: 'Administration',
    },
    {
      employeeId: 'ACH-STF-102',
      name: 'Priya Sharma',
      email: 'priya.sharma@achariya.in',
      phone: '9876543211',
      role: AchariyaRole.STAFF,
      department: 'Finance',
    },
    {
      employeeId: 'ACH-TCH-201',
      name: 'Anand Sundaram',
      email: 'anand.s@achariya.in',
      phone: '9876543212',
      role: AchariyaRole.TEACHER,
      department: 'Mathematics',
    },
    {
      employeeId: 'ACH-TCH-202',
      name: 'Kavitha Rangarajan',
      email: 'kavitha.r@achariya.in',
      phone: '9876543213',
      role: AchariyaRole.TEACHER,
      department: 'Science',
    },
  ];

  for (const emp of employees) {
    await prisma.achariyaEmployee.upsert({
      where: { employeeId: emp.employeeId },
      update: {
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        department: emp.department,
      },
      create: emp,
    });
  }
  console.log(`✅ Seeded ${employees.length} Achariya Employees (Staff & Teachers)`);

  // Seed Students / Admission Numbers
  const students = [
    {
      admissionNumber: 'ACH-ADM-3001',
      studentName: 'Aarav Sundaram',
      parentName: 'Sundaram Raman',
      parentEmail: 'sundaram.r@gmail.com',
      parentPhone: '9876543220',
      grade: 'Grade 8',
    },
    {
      admissionNumber: 'ACH-ADM-3002',
      studentName: 'Diya Rajesh',
      parentName: 'Rajesh V',
      parentEmail: 'rajesh.v@gmail.com',
      parentPhone: '9876543221',
      grade: 'Grade 5',
    },
    {
      admissionNumber: 'ACH-ADM-3003',
      studentName: 'Karthik Anand',
      parentName: 'Anand M',
      parentEmail: 'anand.m@gmail.com',
      parentPhone: '9876543222',
      grade: 'Grade 10',
    },
  ];

  for (const stu of students) {
    await prisma.achariyaStudent.upsert({
      where: { admissionNumber: stu.admissionNumber },
      update: {
        studentName: stu.studentName,
        parentName: stu.parentName,
        parentEmail: stu.parentEmail,
        parentPhone: stu.parentPhone,
        grade: stu.grade,
      },
      create: stu,
    });
  }
  console.log(`✅ Seeded ${students.length} Achariya Students`);

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
