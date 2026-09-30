import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import messagingService from '@/lib/messaging';
import { otpSendSchema, otpVerifySchema } from '@lotmorewins/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/otp — Generate and send OTP via the runtime messaging mode (Super Admin setting)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = otpSendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid input data',
          errors: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { identifier, name, email } = parsed.data;
    const cleanIdentifier = identifier.trim();

    // Check rate limit: maximum 5 requests in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await prisma.otpVerification.count({
      where: {
        identifier: cleanIdentifier,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentCount >= 5) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many OTP requests. Please wait a few minutes before trying again.',
        },
        { status: 429 }
      );
    }

    // Generate secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = bcrypt.hashSync(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    const mode = await messagingService.getMode();

    // The OTP record is keyed by the identifier; delivery goes to an address valid for the channel.
    const identifierIsEmail = cleanIdentifier.includes('@');
    let destination = cleanIdentifier;
    if (mode === 'email' && !identifierIsEmail) {
      if (!email) {
        return NextResponse.json(
          { success: false, message: 'An email address is required to receive the verification code.' },
          { status: 400 }
        );
      }
      destination = email;
    } else if (mode === 'whatsapp' && identifierIsEmail) {
      return NextResponse.json(
        { success: false, message: 'A mobile number is required to receive the verification code on WhatsApp.' },
        { status: 400 }
      );
    }

    // Store in database
    await prisma.otpVerification.create({
      data: {
        identifier: cleanIdentifier,
        channel: mode.toUpperCase(),
        codeHash,
        expiresAt,
        verified: false,
      },
    });

    // Send via centralized messaging service
    const sendResult = await messagingService.sendRegistrationOtp({
      to: destination,
      name,
      otp: rawOtp,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, message: 'Could not deliver the verification code. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `OTP sent successfully via ${mode === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
        channel: sendResult.channel,
        expiresAt: expiresAt.toISOString(),
        mode,
        // In non-production or when ENABLE_DEV_OTP=true, return devOtp for seamless testing/simulation
        devOtp: (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true') ? rawOtp : undefined,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/auth/otp:', error);
    return NextResponse.json(
      { success: false, message: 'Server error while generating OTP' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/otp — Verify OTP code
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = otpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid OTP payload',
        },
        { status: 400 }
      );
    }

    const { identifier, otp } = parsed.data;
    const cleanIdentifier = identifier.trim();

    // Find latest unexpired, unverified OTP record
    const record = await prisma.otpVerification.findFirst({
      where: {
        identifier: cleanIdentifier,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          message: 'No active OTP found or your OTP has expired. Please request a new code.',
        },
        { status: 400 }
      );
    }

    // Check maximum attempts (max 5)
    if (record.attempts >= 5) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many incorrect attempts. Please request a new OTP.',
        },
        { status: 400 }
      );
    }

    // Verify cryptographic hash
    const isValid = bcrypt.compareSync(otp, record.codeHash);

    if (!isValid) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid verification code. Please check and try again.',
        },
        { status: 400 }
      );
    }

    // Mark as verified
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'OTP verified successfully',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in PUT /api/auth/otp:', error);
    return NextResponse.json(
      { success: false, message: 'Server error while verifying OTP' },
      { status: 500 }
    );
  }
}
