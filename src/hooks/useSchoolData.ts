import { useState, useEffect } from "react";
import { SchoolData, Student, Turma, Activity, AttendanceRecord, ActivityRecord, ClassRecord, MinTask, MinTaskRecord } from "@/types";
import { parseSchoolDataCsv, serializeSchoolDataToCsv } from "@/lib/dataTransfer";

const STORAGE_KEY = "school_control_data";
const SCHEMA_VERSION = 1;

interface StoredData {
  schemaVersion: number;
  data: SchoolData;
}

const defaultData: SchoolData = {
  students: [],
  turmas: [],
  activities: [],
  attendanceRecords: [],
  activityRecords: [],
  classRecords: [],
  minTasks: [],
  minTaskRecords: [],
};

function normalizeSchoolData(rawData: unknown): SchoolData {
  const parsedData = (rawData && typeof rawData === "object" ? rawData : {}) as Partial<SchoolData>;

  return {
    students: Array.isArray(parsedData.students) ? parsedData.students : [],
    turmas: Array.isArray(parsedData.turmas) ? parsedData.turmas : [],
    activities: Array.isArray(parsedData.activities) ? parsedData.activities : [],
    attendanceRecords: Array.isArray(parsedData.attendanceRecords) ? parsedData.attendanceRecords : [],
    activityRecords: Array.isArray(parsedData.activityRecords) ? parsedData.activityRecords : [],
    classRecords: Array.isArray(parsedData.classRecords) ? parsedData.classRecords : [],
    minTasks: Array.isArray(parsedData.minTasks) ? parsedData.minTasks : [],
    minTaskRecords: Array.isArray(parsedData.minTaskRecords) ? parsedData.minTaskRecords : [],
  };
}

function migrateData(stored: unknown): SchoolData {
  if (!stored || typeof stored !== "object") return defaultData;

  const obj = stored as Record<string, unknown>;
  if (typeof obj.schemaVersion === "number" && obj.data) {
    return normalizeSchoolData(obj.data);
  }

  return normalizeSchoolData(stored);
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function useSchoolData() {
  const [data, setData] = useState<SchoolData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return migrateData(JSON.parse(stored));
    } catch {}
    return defaultData;
  });

  const normalizedData = normalizeSchoolData(data);

  useEffect(() => {
    const payload: StoredData = { schemaVersion: SCHEMA_VERSION, data: normalizedData };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [normalizedData]);

  const addStudent = (name: string, turmaId: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 200) return;
    setData((prev) => {
      const turma = prev.turmas.find((t) => t.id === turmaId);
      if (!turma) return prev;

      const student: Student = {
        id: generateId(),
        name: trimmed,
        turma: turma.name,
        createdAt: new Date().toISOString(),
      };

      return { ...prev, students: [...prev.students, student] };
    });
  };

  const removeStudent = (id: string) => {
    setData((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
      attendanceRecords: prev.attendanceRecords.filter((r) => r.studentId !== id),
      activityRecords: prev.activityRecords.filter((r) => r.studentId !== id),
      classRecords: prev.classRecords.filter((r) => r.studentId !== id),
      minTaskRecords: prev.minTaskRecords.filter((r) => r.studentId !== id),
    }));
  };

  const addTurma = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) return null;

    const exists = normalizedData.turmas.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) return null;

    const turma: Turma = { id: generateId(), name: trimmedName };
    setData((prev) => {
      if (prev.turmas.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
        return prev;
      }
      return { ...prev, turmas: [...prev.turmas, turma] };
    });
    return turma;
  };

  const removeTurma = (id: string) => {
    const turma = normalizedData.turmas.find((t) => t.id === id);
    if (!turma) return;
    setData((prev) => ({
      ...prev,
      turmas: prev.turmas.filter((t) => t.id !== id),
      students: prev.students.filter((s) => s.turma !== turma.name),
      activities: prev.activities.filter((a) => a.turmaId !== id),
      minTasks: prev.minTasks.filter((t) => t.turmaId !== id),
      minTaskRecords: prev.minTaskRecords.filter((r) => {
        const task = prev.minTasks.find((t) => t.id === r.minTaskId);
        return !task || task.turmaId !== id;
      }),
    }));
  };

  const addActivity = (turmaId: string, name: string, date: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 200 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { id: "", turmaId, name: trimmed, date, createdAt: "" } as Activity;
    }

    const activityId = generateId();
    const activity: Activity = {
      id: activityId,
      turmaId,
      name: trimmed,
      date,
      createdAt: new Date().toISOString(),
    };

    setData((prev) => {
      const turma = prev.turmas.find((t) => t.id === turmaId);
      const turmaStudents = turma ? prev.students.filter((s) => s.turma === turma.name) : [];

      const pendingRecords: ActivityRecord[] = turmaStudents.map((student) => ({
        id: generateId(),
        studentId: student.id,
        activityId,
        done: false,
      }));

      return {
        ...prev,
        activities: [...prev.activities, activity],
        activityRecords: [...prev.activityRecords, ...pendingRecords],
      };
    });

    return activity;
  };

  const removeActivity = (id: string) => {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
      activityRecords: prev.activityRecords.filter((r) => r.activityId !== id),
    }));
  };

  const toggleAttendance = (studentId: string, date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setData((prev) => {
      const existing = prev.attendanceRecords.find((r) => r.studentId === studentId && r.date === date);
      if (existing) {
        return {
          ...prev,
          attendanceRecords: prev.attendanceRecords.map((r) =>
            r.id === existing.id ? { ...r, present: !r.present } : r
          ),
        };
      }
      const newRecord: AttendanceRecord = {
        id: generateId(),
        studentId,
        date,
        present: true,
      };
      return {
        ...prev,
        attendanceRecords: [...prev.attendanceRecords, newRecord],
      };
    });
  };

  const getAttendance = (studentId: string, date: string): boolean | null => {
    const record = normalizedData.attendanceRecords.find((r) => r.studentId === studentId && r.date === date);
    if (!record) return null;
    return record.present;
  };

  const toggleActivityRecord = (studentId: string, activityId: string) => {
    setData((prev) => {
      const existing = prev.activityRecords.find((r) => r.studentId === studentId && r.activityId === activityId);
      if (existing) {
        return {
          ...prev,
          activityRecords: prev.activityRecords.map((r) =>
            r.id === existing.id ? { ...r, done: !r.done } : r
          ),
        };
      }
      const newRecord: ActivityRecord = {
        id: generateId(),
        studentId,
        activityId,
        done: true,
      };
      return {
        ...prev,
        activityRecords: [...prev.activityRecords, newRecord],
      };
    });
  };

  const getActivityRecord = (studentId: string, activityId: string): boolean | null => {
    const record = normalizedData.activityRecords.find((r) => r.studentId === studentId && r.activityId === activityId);
    if (!record) return null;
    return record.done;
  };

  const setClassRecordField = (studentId: string, date: string, field: "participated" | "extraPoint") => {
    setData((prev) => {
      const existing = prev.classRecords.find((r) => r.studentId === studentId && r.date === date);

      if (existing) {
        return {
          ...prev,
          classRecords: prev.classRecords.map((r) =>
            r.id === existing.id ? { ...r, [field]: !r[field] } : r
          ),
        };
      }

      const newRecord: ClassRecord = {
        id: generateId(),
        studentId,
        date,
        participated: field === "participated",
        extraPoint: field === "extraPoint",
      };

      return {
        ...prev,
        classRecords: [...prev.classRecords, newRecord],
      };
    });
  };

  const toggleParticipation = (studentId: string, date: string) => {
    setClassRecordField(studentId, date, "participated");
  };

  const toggleExtraPoint = (studentId: string, date: string) => {
    setClassRecordField(studentId, date, "extraPoint");
  };

  const getParticipation = (studentId: string, date: string): boolean => {
    const record = normalizedData.classRecords.find((r) => r.studentId === studentId && r.date === date);
    return record?.participated ?? false;
  };

  const getExtraPoint = (studentId: string, date: string): boolean => {
    const record = normalizedData.classRecords.find((r) => r.studentId === studentId && r.date === date);
    return record?.extraPoint ?? false;
  };

  const addMinTask = (turmaId: string, name: string, date: string, totalQuestions: number) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 200 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || totalQuestions <= 0) {
      return { id: "", turmaId, name: trimmed, date, totalQuestions, createdAt: "" } as MinTask;
    }
    const minTask: MinTask = {
      id: generateId(),
      turmaId,
      name: trimmed,
      date,
      totalQuestions,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, minTasks: [...prev.minTasks, minTask] }));
    return minTask;
  };

  const removeMinTask = (id: string) => {
    setData((prev) => ({
      ...prev,
      minTasks: prev.minTasks.filter((t) => t.id !== id),
      minTaskRecords: prev.minTaskRecords.filter((r) => r.minTaskId !== id),
    }));
  };

  const setMinTaskRecord = (studentId: string, minTaskId: string, questionsDone: number) => {
    setData((prev) => {
      const existing = prev.minTaskRecords.find((r) => r.studentId === studentId && r.minTaskId === minTaskId);
      if (existing) {
        return {
          ...prev,
          minTaskRecords: prev.minTaskRecords.map((r) =>
            r.id === existing.id ? { ...r, questionsDone } : r
          ),
        };
      }
      const newRecord: MinTaskRecord = {
        id: generateId(),
        studentId,
        minTaskId,
        questionsDone,
      };
      return { ...prev, minTaskRecords: [...prev.minTaskRecords, newRecord] };
    });
  };

  const getMinTaskRecord = (studentId: string, minTaskId: string): number => {
    const record = normalizedData.minTaskRecords.find((r) => r.studentId === studentId && r.minTaskId === minTaskId);
    return record?.questionsDone ?? 0;
  };

  const exportToJson = () => JSON.stringify(normalizedData, null, 2);

  const exportToCsv = () => serializeSchoolDataToCsv(normalizedData);

  const importFromJson = (rawJson: string) => {
    const parsed = JSON.parse(rawJson);
    const normalized = normalizeSchoolData(parsed);
    setData(normalized);
  };

  const importFromCsv = (rawCsv: string) => {
    const parsed = parseSchoolDataCsv(rawCsv);
    const normalized = normalizeSchoolData(parsed);
    setData(normalized);
  };

  return {
    data: normalizedData,
    addStudent,
    removeStudent,
    addTurma,
    removeTurma,
    addActivity,
    removeActivity,
    toggleAttendance,
    getAttendance,
    toggleActivityRecord,
    getActivityRecord,
    toggleParticipation,
    toggleExtraPoint,
    getParticipation,
    getExtraPoint,
    addMinTask,
    removeMinTask,
    setMinTaskRecord,
    getMinTaskRecord,
    exportToJson,
    exportToCsv,
    importFromJson,
    importFromCsv,
  };
}
