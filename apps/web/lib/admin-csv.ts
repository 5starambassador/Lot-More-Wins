import { NextResponse } from 'next/server';

/**
 * CSV export for the Super Admin lists. Every admin list route accepts `format=csv` and
 * answers with the whole filtered result (not one page) built through these helpers.
 */

/** Most rows a single export will contain. */
export const CSV_MAX_ROWS = 20_000;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  // Spreadsheet formula injection: text starting with = + - @ (or a tab / CR) is run as a
  // formula by Excel and Sheets, so it is prefixed with an apostrophe to keep it text.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  // BOM so Excel reads the file as UTF-8 (₹, names in Indian scripts); CRLF per RFC 4180.
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** IST timestamp for exports: 2026-10-01 14:05 */
export function csvDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

export function csvResponse(name: string, csv: string): NextResponse {
  const stamp = csvDateTime(new Date()).slice(0, 10);
  const fileName = `${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-${stamp}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
