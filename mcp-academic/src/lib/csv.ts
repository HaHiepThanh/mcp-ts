/**
 * Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF, UTF-8 BOM).
 * Kept dependency-free so the whole data path is readable on a slide.
 */
export interface CsvTable {
    headers: string[];
    rows: Record<string, string>[];
}

export function parseCsv(text: string): CsvTable {
    const records: string[][] = [];
    let field = '';
    let record: string[] = [];
    let inQuotes = false;
    const input = text.replace(/^﻿/, '');

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (inQuotes) {
            if (char === '"' && input[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            record.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && input[i + 1] === '\n') i++;
            record.push(field);
            records.push(record);
            record = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field !== '' || record.length > 0) {
        record.push(field);
        records.push(record);
    }

    const nonEmpty = records.filter(r => r.some(cell => cell.trim() !== ''));
    const [headerRow = [], ...dataRows] = nonEmpty;
    const headers = headerRow.map(h => h.trim());
    const rows = dataRows.map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])));
    return { headers, rows };
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
    const escape = (value: unknown): string => {
        const text = value === undefined || value === null ? '' : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\n') + '\n';
}
