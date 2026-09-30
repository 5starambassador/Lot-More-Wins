import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateEmployeeSchema } from '@lotmorewins/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid Employee ID format',
        },
        { status: 400 }
      );
    }

    const { employeeId, role } = parsed.data;

    // Look up in authoritative Achariya employee records
    const employee = await prisma.achariyaEmployee.findUnique({
      where: { employeeId },
    });

    if (!employee || !employee.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee ID "${employeeId}" not found in Achariya records. Please check and try again.`,
        },
        { status: 404 }
      );
    }

    // Role verification if requested
    if (role && employee.role !== role) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee ID "${employeeId}" is registered as ${employee.role}, not ${role}.`,
        },
        { status: 400 }
      );
    }

    // Check if this Employee ID is already registered to an existing partner
    const existingPartner = await prisma.partner.findFirst({
      where: { employeeId },
    });

    if (existingPartner) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee ID "${employeeId}" is already linked to an existing partner account.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Employee ID verified successfully',
        data: {
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role,
          department: employee.department,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in /api/partner/validate-employee:', error);
    return NextResponse.json(
      { success: false, message: 'Server error while validating employee record' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');
  const role = searchParams.get('role') as 'STAFF' | 'TEACHER' | undefined;

  if (!employeeId) {
    return NextResponse.json(
      { success: false, message: 'employeeId query parameter is required' },
      { status: 400 }
    );
  }

  const employee = await prisma.achariyaEmployee.findUnique({
    where: { employeeId: employeeId.trim().toUpperCase() },
  });

  if (!employee || !employee.isActive) {
    return NextResponse.json(
      { success: false, message: 'Employee ID not found in Achariya records' },
      { status: 404 }
    );
  }

  if (role && employee.role !== role) {
    return NextResponse.json(
      { success: false, message: `Employee ID is registered as ${employee.role}, not ${role}` },
      { status: 400 }
    );
  }

  const existingPartner = await prisma.partner.findFirst({
    where: { employeeId: employee.employeeId },
  });

  if (existingPartner) {
    return NextResponse.json(
      { success: false, message: 'Employee ID is already registered' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      department: employee.department,
    },
  });
}
