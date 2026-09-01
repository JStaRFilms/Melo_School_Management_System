/**
 * Tabular Spreadsheet / CSV Parser & Header Mapping Engine.
 * Intelligently matches messy spreadsheet columns to the Melo schema,
 * normalizes rows into RawImportRecord structures, and preserves unmapped columns in the metadata attic.
 */

import * as XLSX from "xlsx";
import { parseHumanName } from "./nameParser";
import { normalizePhoneNumber } from "./phoneNormalizer";

export interface ParsedSpreadsheetRow {
  rowNumber: number;
  rawPayload: Record<string, any>;
  parsedData: {
    firstName: string;
    lastName: string;
    middleName?: string;
    admissionNumber?: string;
    gender: string; // "Male" | "Female" | "Unspecified"
    dateOfBirth?: number;
    className: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    address?: string;
    customAttributes?: Record<string, string | number | boolean | null>;
    unmappedFields?: Record<string, string>;
    // Grade fields (for grade_record rows)
    subjectName?: string;
    ca1?: number;
    ca2?: number;
    exam?: number;
  };
  entityType: "student" | "grade_record";
  unrecognizedHeaders: Array<{ header: string; sampleValue?: string; detectedType: string }>;
}

export interface SpreadsheetParseResult {
  headers: string[];
  rows: ParsedSpreadsheetRow[];
  totalRows: number;
  unrecognizedHeaders: Array<{ header: string; sampleValue?: string; detectedType: string }>;
}

/**
 * Standardizes raw header strings for fuzzy matching.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Maps a raw column header to a known schema property key.
 */
export function matchHeaderToField(header: string): string | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;

  // First Name
  if (
    norm === "firstname" ||
    norm === "fname" ||
    norm === "first" ||
    norm === "givenname" ||
    norm === "studentfirstname"
  ) {
    return "firstName";
  }

  // Last Name / Surname
  if (
    norm === "lastname" ||
    norm === "lname" ||
    norm === "last" ||
    norm === "surname" ||
    norm === "familyname" ||
    norm === "studentsurname"
  ) {
    return "lastName";
  }

  // Full Name
  if (
    norm === "name" ||
    norm === "fullname" ||
    norm === "studentname" ||
    norm === "pupilname" ||
    norm === "names"
  ) {
    return "fullName";
  }

  // Middle Name
  if (
    norm === "middlename" ||
    norm === "mname" ||
    norm === "othernames" ||
    norm === "othername"
  ) {
    return "middleName";
  }

  // Admission Number / ID
  if (
    norm === "admissionnumber" ||
    norm === "admissionno" ||
    norm === "admno" ||
    norm === "regno" ||
    norm === "registrationnumber" ||
    norm === "regnumber" ||
    norm === "studentid" ||
    norm === "id" ||
    norm === "admnumber" ||
    norm === "matricno"
  ) {
    return "admissionNumber";
  }

  // Gender / Sex
  if (norm === "gender" || norm === "sex" || norm === "mf") {
    return "gender";
  }

  // Date of Birth
  if (
    norm === "dateofbirth" ||
    norm === "dob" ||
    norm === "birthdate" ||
    norm === "birthday"
  ) {
    return "dateOfBirth";
  }

  // Class / Grade
  if (
    norm === "class" ||
    norm === "classname" ||
    norm === "grade" ||
    norm === "currentclass" ||
    norm === "classarm" ||
    norm === "arm" ||
    norm === "level"
  ) {
    return "className";
  }

  // Guardian / Parent Name
  if (
    norm === "guardianname" ||
    norm === "guardian" ||
    norm === "parentname" ||
    norm === "parent" ||
    norm === "fathersname" ||
    norm === "mothersname" ||
    norm === "contactperson"
  ) {
    return "guardianName";
  }

  // Guardian Phone
  if (
    norm === "guardianphone" ||
    norm === "parentphone" ||
    norm === "phone" ||
    norm === "phonenumber" ||
    norm === "mobile" ||
    norm === "guardiancontact" ||
    norm === "parentcontact" ||
    norm === "telephone" ||
    norm === "guardianmobile" ||
    norm === "parentmobile"
  ) {
    return "guardianPhone";
  }

  // Guardian Email
  if (
    norm === "guardianemail" ||
    norm === "parentemail" ||
    norm === "email" ||
    norm === "emailaddress" ||
    norm === "parentemailaddress"
  ) {
    return "guardianEmail";
  }

  // Address / House
  if (
    norm === "address" ||
    norm === "homeaddress" ||
    norm === "residentialaddress" ||
    norm === "location"
  ) {
    return "address";
  }

  // Grades & Scores
  if (
    norm === "ca1" ||
    norm === "firsttest" ||
    norm === "test1" ||
    norm === "caone"
  ) {
    return "ca1";
  }

  if (
    norm === "ca2" ||
    norm === "secondtest" ||
    norm === "test2" ||
    norm === "catwo"
  ) {
    return "ca2";
  }

  if (norm === "exam" || norm === "examination" || norm === "examscore") {
    return "exam";
  }

  if (
    norm === "subject" ||
    norm === "subjectname" ||
    norm === "course" ||
    norm === "coursework"
  ) {
    return "subjectName";
  }

  return null;
}

/**
 * Normalizes gender value to "Male", "Female", or "Unspecified".
 */
export function normalizeGender(raw: unknown): "Male" | "Female" | "Unspecified" {
  if (!raw || typeof raw !== "string") return "Unspecified";
  const lower = raw.trim().toLowerCase();
  if (lower === "m" || lower === "male" || lower === "boy" || lower === "b") {
    return "Male";
  }
  if (lower === "f" || lower === "female" || lower === "girl" || lower === "g") {
    return "Female";
  }
  return "Unspecified";
}

/**
 * Parses date of birth string/number to Unix timestamp in milliseconds.
 */
export function parseDateOfBirth(raw: unknown): number | undefined {
  if (!raw) return undefined;
  if (typeof raw === "number" && raw > 0) {
    // If it's already a JS timestamp in ms or seconds
    if (raw > 1e11) return raw;
    if (raw > 1e8) return raw * 1000;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    // Handle common formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }

    const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashMatch) {
      const part1 = parseInt(slashMatch[1], 10);
      const part2 = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);

      // Assume DD/MM/YYYY if part1 > 12
      const day = part1 > 12 ? part1 : part2;
      const month = part1 > 12 ? part2 - 1 : part1 - 1;
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }
  }

  return undefined;
}

/**
 * Detects the data type of an unrecognized column value.
 */
export function detectType(val: unknown): "string" | "number" | "boolean" {
  if (val === null || val === undefined || val === "") return "string";
  if (typeof val === "boolean") return "boolean";
  if (typeof val === "number") return "number";

  const str = String(val).trim().toLowerCase();
  if (str === "true" || str === "false" || str === "yes" || str === "no") {
    return "boolean";
  }
  if (!isNaN(Number(str)) && str !== "") {
    return "number";
  }
  return "string";
}

/**
 * Pure CSV parser supporting standard quotes, commas/semicolons/tabs, and multiline records.
 */
export function parseCSVToMatrix(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ""); // Strip BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  // Auto-detect delimiter from first line
  const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || "";
  let delimiter = ",";
  if (firstLine.includes("\t") && !firstLine.includes(",")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \n in \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses raw CSV string or matrix into structured SpreadsheetParseResult.
 */
export function parseSpreadsheetContent(
  content: string | string[][]
): SpreadsheetParseResult {
  const matrix = typeof content === "string" ? parseCSVToMatrix(content) : content;
  if (matrix.length === 0) {
    return { headers: [], rows: [], totalRows: 0, unrecognizedHeaders: [] };
  }

  const rawHeaders = matrix[0];
  const fieldMapping: Record<number, string | null> = {};
  const unrecognizedHeadersMap = new Map<
    string,
    { header: string; sampleValue?: string; detectedType: string }
  >();

  rawHeaders.forEach((header, index) => {
    const matchedField = matchHeaderToField(header);
    fieldMapping[index] = matchedField;
    if (!matchedField && header.trim()) {
      unrecognizedHeadersMap.set(header.trim(), {
        header: header.trim(),
        detectedType: "string",
      });
    }
  });

  const parsedRows: ParsedSpreadsheetRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || !row.some((cell) => cell.trim().length > 0)) continue;

    const rawPayload: Record<string, any> = {};
    let firstName = "";
    let lastName = "";
    let middleName: string | undefined = undefined;
    let admissionNumber: string | undefined = undefined;
    let gender = "Unspecified";
    let dateOfBirth: number | undefined = undefined;
    let className = "Unassigned";
    let guardianName: string | undefined = undefined;
    let guardianPhone: string | undefined = undefined;
    let guardianEmail: string | undefined = undefined;
    let address: string | undefined = undefined;
    let subjectName: string | undefined = undefined;
    let ca1: number | undefined = undefined;
    let ca2: number | undefined = undefined;
    let exam: number | undefined = undefined;

    const unmappedFields: Record<string, string> = {};
    const customAttributes: Record<string, string | number | boolean | null> = {};

    rawHeaders.forEach((rawHeader, idx) => {
      const cellVal = row[idx] ?? "";
      rawPayload[rawHeader] = cellVal;
      const matchedField = fieldMapping[idx];

      if (!matchedField) {
        if (cellVal.trim()) {
          unmappedFields[rawHeader] = cellVal.trim();
          const existing = unrecognizedHeadersMap.get(rawHeader.trim());
          if (existing && !existing.sampleValue) {
            existing.sampleValue = cellVal.trim();
            existing.detectedType = detectType(cellVal);
          }
        }
        return;
      }

      switch (matchedField) {
        case "firstName":
          firstName = cellVal.trim();
          break;
        case "lastName":
          lastName = cellVal.trim();
          break;
        case "middleName":
          middleName = cellVal.trim() || undefined;
          break;
        case "fullName": {
          const parsed = parseHumanName(cellVal);
          if (!firstName) firstName = parsed.firstName;
          if (!lastName) lastName = parsed.lastName;
          if (!middleName && parsed.middleName) middleName = parsed.middleName;
          break;
        }
        case "admissionNumber":
          admissionNumber = cellVal.trim() || undefined;
          break;
        case "gender":
          gender = normalizeGender(cellVal);
          break;
        case "dateOfBirth":
          dateOfBirth = parseDateOfBirth(cellVal);
          break;
        case "className":
          className = cellVal.trim() || "Unassigned";
          break;
        case "guardianName":
          guardianName = cellVal.trim() || undefined;
          break;
        case "guardianPhone":
          guardianPhone = normalizePhoneNumber(cellVal) ?? cellVal.trim() ?? undefined;
          break;
        case "guardianEmail":
          guardianEmail = cellVal.trim() || undefined;
          break;
        case "address":
          address = cellVal.trim() || undefined;
          break;
        case "ca1": {
          const num = parseFloat(cellVal);
          if (!isNaN(num)) ca1 = num;
          break;
        }
        case "ca2": {
          const num = parseFloat(cellVal);
          if (!isNaN(num)) ca2 = num;
          break;
        }
        case "exam": {
          const num = parseFloat(cellVal);
          if (!isNaN(num)) exam = num;
          break;
        }
        case "subjectName":
          subjectName = cellVal.trim() || undefined;
          break;
      }
    });

    const isGradeRecord = Boolean(
      subjectName || ca1 !== undefined || ca2 !== undefined || exam !== undefined
    );

    parsedRows.push({
      rowNumber: r + 1,
      rawPayload,
      parsedData: {
        firstName: firstName || "Unknown",
        lastName: lastName || "",
        middleName,
        admissionNumber,
        gender,
        dateOfBirth,
        className: className || "Unassigned",
        guardianName,
        guardianPhone,
        guardianEmail,
        address,
        customAttributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined,
        unmappedFields: Object.keys(unmappedFields).length > 0 ? unmappedFields : undefined,
        subjectName,
        ca1,
        ca2,
        exam,
      },
      entityType: isGradeRecord ? "grade_record" : "student",
      unrecognizedHeaders: Array.from(unrecognizedHeadersMap.values()),
    });
  }

  return {
    headers: rawHeaders,
    rows: parsedRows,
    totalRows: parsedRows.length,
    unrecognizedHeaders: Array.from(unrecognizedHeadersMap.values()),
  };
}

/**
 * Parses binary Excel (.xlsx, .xls) files into structured SpreadsheetParseResult.
 */
export function parseWorkbookBinary(data: ArrayBuffer | Uint8Array): SpreadsheetParseResult {
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], totalRows: 0, unrecognizedHeaders: [] };
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [], totalRows: 0, unrecognizedHeaders: [] };
  }
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const stringMatrix: string[][] = rawMatrix.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      cell !== null && cell !== undefined ? String(cell) : ""
    )
  );
  return parseSpreadsheetContent(stringMatrix);
}
