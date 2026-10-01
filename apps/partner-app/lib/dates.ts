import { dateOfBirthSchema } from '@lotmorewins/validation';

/**
 * Date of birth is typed and shown as DD/MM/YYYY and sent to the API as YYYY-MM-DD.
 * It is a calendar date, so nothing here goes through a timezone conversion.
 */

/** Formats typed digits as DD/MM/YYYY while the user types. */
export function maskDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** DD/MM/YYYY -> YYYY-MM-DD, or null when it is not a complete, valid date of birth. */
export function dobInputToIso(input: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return dateOfBirthSchema.safeParse(iso).success ? iso : null;
}

/** YYYY-MM-DD -> DD/MM/YYYY */
export function isoToDobInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** YYYY-MM-DD -> a local Date at midnight (for the calendar picker). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** A Date picked in the local calendar -> YYYY-MM-DD */
export function localDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD -> "14 March 1992" */
export function formatDob(iso: string): string {
  return isoToLocalDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
