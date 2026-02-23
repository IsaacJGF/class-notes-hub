import { SchoolData } from "@/types";

const DATA_KEYS: Array<keyof SchoolData> = [
  "students",
  "turmas",
  "activities",
  "attendanceRecords",
  "activityRecords",
  "classRecords",
  "minTasks",
  "minTaskRecords",
];

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

export function serializeSchoolDataToCsv(data: SchoolData): string {
  const rows = ["entity,payload"];

  DATA_KEYS.forEach((key) => {
    data[key].forEach((entry) => {
      rows.push(`${key},${escapeCsvField(JSON.stringify(entry))}`);
    });
  });

  return rows.join("\n");
}

export function parseSchoolDataCsv(csvText: string): SchoolData {
  const normalized: SchoolData = {
    students: [],
    turmas: [],
    activities: [],
    attendanceRecords: [],
    activityRecords: [],
    classRecords: [],
    minTasks: [],
    minTaskRecords: [],
  };

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return normalized;
  }

  const [header, ...dataLines] = lines;
  if (header.toLowerCase() !== "entity,payload") {
    throw new Error("CSV inválido: cabeçalho esperado 'entity,payload'.");
  }

  dataLines.forEach((line, index) => {
    const [entity, payload] = parseCsvLine(line);

    if (!DATA_KEYS.includes(entity as keyof SchoolData)) {
      throw new Error(`CSV inválido: entidade desconhecida na linha ${index + 2}.`);
    }

    try {
      const parsed = JSON.parse(payload);
      (normalized[entity as keyof SchoolData] as unknown[]).push(parsed);
    } catch {
      throw new Error(`CSV inválido: payload malformado na linha ${index + 2}.`);
    }
  });

  return normalized;
}
