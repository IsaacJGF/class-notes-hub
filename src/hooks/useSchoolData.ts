import { useState, useEffect, useCallback } from "react";
import { AcademicTerm, EvaluationComponent, SchoolData, Student, Turma, Activity, ActivityRecord, TermSettings } from "@/types";
import {
  EVALUATION_BLOCKS,
  formatLocalDate,
  normalizeSchoolData,
  roundGrade,
  updateActivityDetails,
  updateStudentExtraPoints,
  type ActivityChanges,
} from "@/lib/academicTerms";

const STORAGE_KEY = "school_control_data";

const defaultData: SchoolData = {
  schemaVersion: 2,
  students: [],
  turmas: [],
  activities: [],
  activityRecords: [],
  termSettings: [],
  studentExtraPoints: [],
  evaluationComponents: [],
  componentScores: [],
};

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function useSchoolData() {
  const [data, setData] = useState<SchoolData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return normalizeSchoolData(JSON.parse(stored));
    } catch {
      // O estado padrão mantém a aplicação iniciável se o armazenamento local estiver inválido.
    }
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
      studentExtraPoints: prev.studentExtraPoints.filter((entry) => entry.studentId !== id),
      activityRecords: prev.activityRecords.filter((r) => r.studentId !== id),
      componentScores: prev.componentScores.filter((score) => score.studentId !== id),
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
      return normalizeSchoolData({ ...prev, turmas: [...prev.turmas, turma] });
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
      const removedComponentIds = new Set(
        prev.evaluationComponents.filter((component) => component.turmaId === id).map((component) => component.id),
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
        studentExtraPoints: prev.studentExtraPoints.filter((entry) => !removedStudentIds.has(entry.studentId)),
        evaluationComponents: prev.evaluationComponents.filter((component) => component.turmaId !== id),
        componentScores: prev.componentScores.filter(
          (score) => !removedStudentIds.has(score.studentId) && !removedComponentIds.has(score.componentId),
        ),
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

  const setStudentExtraPoints = useCallback((studentId: string, term: AcademicTerm, points: number) => {
    setData((prev) => {
      if (!prev.students.some((student) => student.id === studentId)) return prev;
      return { ...prev, studentExtraPoints: updateStudentExtraPoints(prev.studentExtraPoints, studentId, term, points) };
    });
  }, []);

  const setStudentComponentScore = useCallback((studentId: string, componentId: string, score: number | null) => {
    const component = data.evaluationComponents.find((item) => item.id === componentId);
    if (!component) return "Subramificação não encontrada.";
    if (!data.students.some((student) => student.id === studentId)) return "Aluno não encontrado.";
    if (score !== null && (!Number.isFinite(score) || score < 0)) return "Digite uma nota igual ou maior que zero.";
    if (score !== null && component.maxPoints !== null && score > component.maxPoints) {
      return `O limite desta subramificação é ${component.maxPoints} pontos.`;
    }

    setData((prev) => {
      const remaining = prev.componentScores.filter((entry) => entry.studentId !== studentId || entry.componentId !== componentId);
      const componentScores = score === null ? remaining : [...remaining, { studentId, componentId, score }];
      const studentExtraPoints = component.blockId === "PE"
        ? updateStudentExtraPoints(
            prev.studentExtraPoints,
            studentId,
            component.term,
            componentScores
              .filter((entry) => entry.studentId === studentId && data.evaluationComponents.some((item) => item.id === entry.componentId && item.blockId === "PE" && item.term === component.term))
              .reduce((sum, entry) => sum + entry.score, 0),
          )
        : prev.studentExtraPoints;
      return {
        ...prev,
        componentScores,
        studentExtraPoints,
      };
    });
    return null;
  }, [data.evaluationComponents, data.students]);

  const saveEvaluationConfiguration = useCallback((turmaId: string, term: AcademicTerm, draftComponents: EvaluationComponent[]) => {
    const nextComponents = draftComponents.map((component) => ({ ...component }));
    for (const block of EVALUATION_BLOCKS) {
      const blockComponents = nextComponents.filter((component) => component.blockId === block.id).sort((a, b) => a.order - b.order);
      if (blockComponents.length === 0) return `Mantenha pelo menos um campo em ${block.label}.`;
      if (blockComponents.some((component) => !component.name.trim())) return `Informe o nome de todas as subramificações de ${block.label}.`;
      if (block.maxPoints !== null) {
        if (blockComponents.length === 1) blockComponents[0].maxPoints = 20;
        if (blockComponents.some((component) => component.maxPoints === null)) return `${block.label}: cada subramificação precisa ter um limite definido.`;
        const allocated = roundGrade(blockComponents.reduce((sum, component) => sum + (component.maxPoints ?? 0), 0));
        if (allocated !== 20) return `${block.label}: distribua exatamente 20 pontos entre as subramificações (atual: ${allocated}).`;
      }
      if (blockComponents.some((component) => component.maxPoints !== null && (!Number.isFinite(component.maxPoints) || component.maxPoints < 0))) {
        return `Há um limite inválido em ${block.label}.`;
      }
    }

    const currentComponents = data.evaluationComponents.filter((component) => component.turmaId === turmaId && component.term === term);
    const currentActivityIds = new Set(currentComponents.filter((component) => component.kind === "activities").map((component) => component.id));
    const nextIds = new Set(nextComponents.map((component) => component.id));
    if ([...currentActivityIds].some((id) => !nextIds.has(id))) return "A ramificação fixa Atividades do AEP deve permanecer configurada.";
    for (const component of nextComponents) {
      if (data.componentScores.some((score) => score.componentId === component.id && component.maxPoints !== null && score.score > component.maxPoints)) {
        return `Há uma nota acima do novo limite de ${component.name}. Ajuste-a antes de salvar a configuração.`;
      }
    }

    const scoped = nextComponents.map((component, order) => ({ ...component, turmaId, term, order }));
    const removedIds = new Set(currentComponents.filter((component) => !nextIds.has(component.id)).map((component) => component.id));
    const activityMaximum = scoped.find((component) => component.blockId === "AEP" && component.kind === "activities")?.maxPoints;
    setData((prev) => {
      const componentScores = prev.componentScores.filter((score) => !removedIds.has(score.componentId));
      const turmaName = data.turmas.find((item) => item.id === turmaId)?.name;
      const peIds = new Set(scoped.filter((component) => component.blockId === "PE").map((component) => component.id));
      let studentExtraPoints = prev.studentExtraPoints;
      if (turmaName) {
        for (const student of prev.students.filter((item) => item.turma === turmaName)) {
          const total = componentScores
            .filter((score) => score.studentId === student.id && peIds.has(score.componentId))
            .reduce((sum, score) => sum + score.score, 0);
          studentExtraPoints = updateStudentExtraPoints(studentExtraPoints, student.id, term, total);
        }
      }
      return {
        ...prev,
        evaluationComponents: [
          ...prev.evaluationComponents.filter((component) => component.turmaId !== turmaId || component.term !== term),
          ...scoped,
        ],
        componentScores,
        studentExtraPoints,
        termSettings: activityMaximum === undefined || activityMaximum === null
          ? prev.termSettings
          : prev.termSettings.some((setting) => setting.turmaId === turmaId && setting.term === term)
            ? prev.termSettings.map((setting) => setting.turmaId === turmaId && setting.term === term ? { ...setting, totalPoints: activityMaximum } : setting)
            : [...prev.termSettings, { turmaId, term, totalPoints: activityMaximum }],
      };
    });
    return null;
  }, [data.evaluationComponents, data.componentScores, data.turmas]);

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
    setStudentExtraPoints,
    setStudentComponentScore,
    saveEvaluationConfiguration,
    addActivity,
    updateActivity,
    removeActivity,
    toggleActivityRecord,
    getActivityRecord,
    getActivityRecordFull,
    setActivityOnTimeOverride,
  };
}
