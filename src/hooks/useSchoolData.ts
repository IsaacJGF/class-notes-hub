import { useState, useEffect, useCallback } from "react";
import { SchoolData, Student, Turma, Activity, ActivityRecord } from "@/types";

const STORAGE_KEY = "school_control_data";

const defaultData: SchoolData = {
  students: [],
  turmas: [],
  activities: [],
  activityRecords: [],
};

function normalizeSchoolData(rawData: unknown): SchoolData {
  const parsedData = (rawData && typeof rawData === "object" ? rawData : {}) as Partial<SchoolData>;
  return {
    students: Array.isArray(parsedData.students) ? parsedData.students : [],
    turmas: Array.isArray(parsedData.turmas) ? parsedData.turmas : [],
    activities: Array.isArray(parsedData.activities) ? parsedData.activities : [],
    activityRecords: Array.isArray(parsedData.activityRecords) ? parsedData.activityRecords : [],
  };
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function useSchoolData() {
  const [data, setData] = useState<SchoolData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return normalizeSchoolData(JSON.parse(stored));
    } catch {}
    return defaultData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // --- Students ---
  const addStudent = useCallback((name: string, turmaId: string) => {
    setData((prev) => {
      const turma = prev.turmas.find((t) => t.id === turmaId);
      if (!turma) return prev;
      const student: Student = {
        id: generateId(),
        name: name.trim(),
        turma: turma.name,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, students: [...prev.students, student] };
    });
  }, []);

  const removeStudent = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
      activityRecords: prev.activityRecords.filter((r) => r.studentId !== id),
    }));
  }, []);

  // --- Turmas ---
  const addTurma = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const exists = data.turmas.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) return null;
    const turma: Turma = { id: generateId(), name: trimmedName };
    setData((prev) => {
      if (prev.turmas.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) return prev;
      return { ...prev, turmas: [...prev.turmas, turma] };
    });
    return turma;
  }, [data.turmas]);

  const removeTurma = useCallback((id: string) => {
    const turma = data.turmas.find((t) => t.id === id);
    if (!turma) return;
    setData((prev) => ({
      ...prev,
      turmas: prev.turmas.filter((t) => t.id !== id),
      students: prev.students.filter((s) => s.turma !== turma.name),
      activities: prev.activities.filter((a) => a.turmaId !== id),
    }));
  }, [data.turmas]);

  // --- Activities ---
  const addActivity = useCallback((turmaId: string, name: string, date: string, deadline?: string) => {
    const activityId = generateId();
    const activity: Activity = {
      id: activityId,
      turmaId,
      name: name.trim(),
      date,
      deadline: deadline || undefined,
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
  }, []);

  const removeActivity = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
      activityRecords: prev.activityRecords.filter((r) => r.activityId !== id),
    }));
  }, []);

  // --- Activity Records ---
  const toggleActivityRecord = useCallback((studentId: string, activityId: string) => {
    setData((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      const existing = prev.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );
      if (existing) {
        return {
          ...prev,
          activityRecords: prev.activityRecords.map((r) => {
            if (r.id !== existing.id) return r;
            const newDone = !r.done;
            return {
              ...r,
              done: newDone,
              markedAt: newDone ? today : undefined,
              overrideOnTime: newDone ? r.overrideOnTime : undefined,
            };
          }),
        };
      }
      const newRecord: ActivityRecord = {
        id: generateId(),
        studentId,
        activityId,
        done: true,
        markedAt: today,
      };
      return { ...prev, activityRecords: [...prev.activityRecords, newRecord] };
    });
  }, []);

  const setActivityOnTimeOverride = useCallback((studentId: string, activityId: string, override: boolean) => {
    setData((prev) => {
      const existing = prev.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );
      if (!existing) return prev;
      return {
        ...prev,
        activityRecords: prev.activityRecords.map((r) =>
          r.id === existing.id ? { ...r, overrideOnTime: override || undefined } : r
        ),
      };
    });
  }, []);

  const getActivityRecord = useCallback(
    (studentId: string, activityId: string): boolean | null => {
      const record = data.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );
      if (!record) return null;
      return record.done;
    },
    [data.activityRecords]
  );

  const getActivityRecordFull = useCallback(
    (studentId: string, activityId: string): ActivityRecord | null => {
      return (
        data.activityRecords.find(
          (r) => r.studentId === studentId && r.activityId === activityId
        ) ?? null
      );
    },
    [data.activityRecords]
  );

  return {
    data,
    addStudent,
    removeStudent,
    addTurma,
    removeTurma,
    addActivity,
    removeActivity,
    toggleActivityRecord,
    getActivityRecord,
    getActivityRecordFull,
    setActivityOnTimeOverride,
  };
}