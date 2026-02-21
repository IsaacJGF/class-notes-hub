import { useState, useEffect, useCallback } from "react";
import { SchoolData, Student, Turma, Activity, AttendanceRecord, ActivityRecord, MinTask, MinTaskRecord } from "@/types";

const STORAGE_KEY = "school_control_data";

const defaultData: SchoolData = {
  students: [],
  turmas: [],
  activities: [],
  attendanceRecords: [],
  activityRecords: [],
  minTasks: [],
  minTaskRecords: [],
};

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function useSchoolData() {
  const [data, setData] = useState<SchoolData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
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
      attendanceRecords: prev.attendanceRecords.filter((r) => r.studentId !== id),
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
      if (prev.turmas.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
        return prev;
      }
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
  const addActivity = useCallback((turmaId: string, name: string, date: string) => {
    const activity: Activity = {
      id: generateId(),
      turmaId,
      name: name.trim(),
      date,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, activities: [...prev.activities, activity] }));
    return activity;
  }, []);

  const removeActivity = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
      activityRecords: prev.activityRecords.filter((r) => r.activityId !== id),
    }));
  }, []);

  // --- Attendance ---
  const toggleAttendance = useCallback((studentId: string, date: string) => {
    setData((prev) => {
      const existing = prev.attendanceRecords.find(
        (r) => r.studentId === studentId && r.date === date
      );
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
  }, []);

  const getAttendance = useCallback(
    (studentId: string, date: string): boolean | null => {
      const record = data.attendanceRecords.find(
        (r) => r.studentId === studentId && r.date === date
      );
      if (!record) return null;
      return record.present;
    },
    [data.attendanceRecords]
  );

  // --- Activity Records ---
  const toggleActivityRecord = useCallback((studentId: string, activityId: string) => {
    setData((prev) => {
      const existing = prev.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );
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
        bonusTag: null,
      };
      return {
        ...prev,
        activityRecords: [...prev.activityRecords, newRecord],
      };
    });
  }, []);

  const cycleActivityBonusTag = useCallback((studentId: string, activityId: string) => {
    setData((prev) => {
      const existing = prev.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );

      if (existing) {
        const nextBonusTag =
          existing.bonusTag === "yellow" ? "green" : existing.bonusTag === "green" ? null : "yellow";
        return {
          ...prev,
          activityRecords: prev.activityRecords.map((r) =>
            r.id === existing.id ? { ...r, bonusTag: nextBonusTag } : r
          ),
        };
      }

      const newRecord: ActivityRecord = {
        id: generateId(),
        studentId,
        activityId,
        done: false,
        bonusTag: "yellow",
      };

      return {
        ...prev,
        activityRecords: [...prev.activityRecords, newRecord],
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

  const getActivityBonusTag = useCallback(
    (studentId: string, activityId: string): "yellow" | "green" | null => {
      const record = data.activityRecords.find(
        (r) => r.studentId === studentId && r.activityId === activityId
      );
      return record?.bonusTag ?? null;
    },
    [data.activityRecords]
  );

  // --- Min Tasks ---
  const addMinTask = useCallback((turmaId: string, name: string, date: string, totalQuestions: number) => {
    const minTask: MinTask = {
      id: generateId(),
      turmaId,
      name: name.trim(),
      date,
      totalQuestions,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, minTasks: [...prev.minTasks, minTask] }));
    return minTask;
  }, []);

  const removeMinTask = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      minTasks: prev.minTasks.filter((t) => t.id !== id),
      minTaskRecords: prev.minTaskRecords.filter((r) => r.minTaskId !== id),
    }));
  }, []);

  const setMinTaskRecord = useCallback((studentId: string, minTaskId: string, questionsDone: number) => {
    setData((prev) => {
      const existing = prev.minTaskRecords.find(
        (r) => r.studentId === studentId && r.minTaskId === minTaskId
      );
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
  }, []);

  const getMinTaskRecord = useCallback(
    (studentId: string, minTaskId: string): number => {
      const record = data.minTaskRecords.find(
        (r) => r.studentId === studentId && r.minTaskId === minTaskId
      );
      return record?.questionsDone ?? 0;
    },
    [data.minTaskRecords]
  );

  return {
    data,
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
    cycleActivityBonusTag,
    getActivityBonusTag,
    addMinTask,
    removeMinTask,
    setMinTaskRecord,
    getMinTaskRecord,
  };
}
