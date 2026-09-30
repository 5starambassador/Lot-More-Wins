import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAdmissionSchema } from '@lotmorewins/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validateAdmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid Admission Number format',
        },
        { status: 400 }
      );
    }

    const { admissionNumber } = parsed.data;

    // Look up in authoritative Achariya student records
    const student = await prisma.achariyaStudent.findUnique({
      where: { admissionNumber },
    });

    if (!student || !student.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: `Admission Number "${admissionNumber}" not found in Achariya records. Please check and try again.`,
        },
        { status: 404 }
      );
    }

    // Check if this Admission Number is already registered to an existing partner
    const existingPartner = await prisma.partner.findFirst({
      where: { admissionNumber },
    });

    if (existingPartner) {
      return NextResponse.json(
        {
          success: false,
          message: `Admission Number "${admissionNumber}" is already linked to an existing partner account.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Admission Number verified successfully',
        data: {
          admissionNumber: student.admissionNumber,
          studentName: student.studentName,
          parentName: student.parentName,
          parentEmail: student.parentEmail,
          parentPhone: student.parentPhone,
          grade: student.grade,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in /api/partner/validate-admission:', error);
    return NextResponse.json(
      { success: false, message: 'Server error while validating student admission record' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admissionNumber = searchParams.get('admissionNumber');

  if (!admissionNumber) {
    return NextResponse.json(
      { success: false, message: 'admissionNumber query parameter is required' },
      { status: 400 }
    );
  }

  const student = await prisma.achariyaStudent.findUnique({
    where: { admissionNumber: admissionNumber.trim().toUpperCase() },
  });

  if (!student || !student.isActive) {
    return NextResponse.json(
      { success: false, message: 'Admission Number not found in Achariya records' },
      { status: 404 }
    );
  }

  const existingPartner = await prisma.partner.findFirst({
    where: { admissionNumber: student.admissionNumber },
  });

  if (existingPartner) {
    return NextResponse.json(
      { success: false, message: 'Admission Number is already registered' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      parentName: student.parentName,
      parentEmail: student.parentEmail,
      parentPhone: student.parentPhone,
      grade: student.grade,
    },
  });
}
