import { useState, useEffect, useCallback } from "react";
import { AcademicTerm, SchoolData, Student, Turma, Activity, ActivityRecord, TermSettings } from "@/types";
import {
  formatLocalDate,
  normalizeSchoolData,
  updateActivityDetails,
  type ActivityChanges,
} from "@/lib/academicTerms";

const STORAGE_KEY = "school_control_data";

const defaultData: SchoolData = {
  students: [],
  turmas: [],
  activities: [],
  activityRecords: [],
  termSettings: [],
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
      const pendingRecords: ActivityRecord[] = prev.activities
        .filter((activity) => activity.turmaId === turmaId)
        .map((activity) => ({
          id: generateId(),
          studentId: student.id,
          activityId: activity.id,
          done: false,
        }));

      return {
        ...prev,
        students: [...prev.students, student],
        activityRecords: [...prev.activityRecords, ...pendingRecords],
      };
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
    setData((prev) => {
      const turma = prev.turmas.find((item) => item.id === id);
      if (!turma) return prev;

      const removedStudentIds = new Set(
        prev.students.filter((student) => student.turma === turma.name).map((student) => student.id),
      );
      const removedActivityIds = new Set(
        prev.activities.filter((activity) => activity.turmaId === id).map((activity) => activity.id),
      );

      return {
        ...prev,
        turmas: prev.turmas.filter((item) => item.id !== id),
        students: prev.students.filter((student) => !removedStudentIds.has(student.id)),
        activities: prev.activities.filter((activity) => !removedActivityIds.has(activity.id)),
        activityRecords: prev.activityRecords.filter(
          (record) => !removedStudentIds.has(record.studentId) && !removedActivityIds.has(record.activityId),
        ),
        termSettings: prev.termSettings.filter((setting) => setting.turmaId !== id),
      };
    });
  }, []);

  const setTermTotalPoints = useCallback((turmaId: string, term: AcademicTerm, totalPoints: number) => {
    const safeTotalPoints = Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;

    setData((prev) => {
      const existing = prev.termSettings.find(
        (setting) => setting.turmaId === turmaId && setting.term === term,
      );
      const updatedSetting: TermSettings = { turmaId, term, totalPoints: safeTotalPoints };

      return {
        ...prev,
        termSettings: existing
          ? prev.termSettings.map((setting) =>
              setting.turmaId === turmaId && setting.term === term ? updatedSetting : setting,
            )
          : [...prev.termSettings, updatedSetting],
      };
    });
  }, []);

  // --- Activities ---
  const addActivity = useCallback((turmaId: string, name: string, date: string, term: AcademicTerm, deadline?: string) => {
    const activityId = generateId();
    const activity: Activity = {
      id: activityId,
      turmaId,
      name: name.trim(),
      date,
      term,
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

  const updateActivity = useCallback((id: string, changes: ActivityChanges) => {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((activity) =>
        activity.id === id ? updateActivityDetails(activity, changes) : activity,
      ),
    }));
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
      const today = formatLocalDate();
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
    setTermTotalPoints,
    addActivity,
    updateActivity,
    removeActivity,
    toggleActivityRecord,
    getActivityRecord,
    getActivityRecordFull,
    setActivityOnTimeOverride,
  };
}
