import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { HttpError } from './auth';

export function ok<T>(data: T, status = 200, message?: string) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function fail(status: number, message: string, code?: string, details?: unknown) {
  return NextResponse.json({ success: false, message, code, details }, { status });
}

export function validationError(error: ZodError) {
  return fail(400, error.issues[0]?.message || 'Invalid request', 'VALIDATION_ERROR', error.flatten());
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON', 'INVALID_JSON');
  }
}

/** Maps known errors to responses; never leaks internal error messages. */
export function handleRouteError(error: unknown, context: string) {
  if (error instanceof HttpError) {
    return fail(error.status, error.message, error.code, error.details);
  }
  console.error(`Error in ${context}:`, error);
  return fail(500, 'Internal server error', 'INTERNAL_ERROR');
}
