import type {
  AcademicTerm,
  Activity,
  ActivityRecord,
  EvaluationBlockId,
  EvaluationComponent,
  SchoolData,
  StudentComponentScore,
  TermSettings,
  StudentExtraPoints,
} from "@/types";

export const ACADEMIC_TERMS: readonly AcademicTerm[] = [1, 2, 3];
export const LATE_ACTIVITY_FACTOR = 0.7;
export const FIXED_EVALUATION_BLOCKS: readonly EvaluationBlockId[] = ["AEP", "AL", "AV", "AG", "TESTE"];
export const EVALUATION_BLOCKS: readonly { id: EvaluationBlockId; label: string; maxPoints: number | null }[] = [
  { id: "AEP", label: "AEP", maxPoints: 20 },
  { id: "AL", label: "AL", maxPoints: 20 },
  { id: "AV", label: "AV", maxPoints: 20 },
  { id: "AG", label: "AG", maxPoints: 20 },
  { id: "TESTE", label: "Teste", maxPoints: 20 },
  { id: "PE", label: "P.E.", maxPoints: null },
];

export function evaluationComponentId(turmaId: string, term: AcademicTerm, blockId: EvaluationBlockId, suffix: string): string {
  return `eval:${turmaId}:${term}:${blockId}:${suffix}`;
}

export interface StudentTermSummary {
  activityCount: number;
  onTime: number;
  late: number;
  pending: number;
  totalPoints: number;
  activityValue: number;
  weightedPercentage: number;
  finalGrade: number;
  activityGrade: number;
  extraPoints: number;
}

export interface ActivityChanges {
  name?: string;
  term?: AcademicTerm;
}

export type ActivityRecordIndex = ReadonlyMap<string, ActivityRecord>;

export function normalizeAcademicTerm(value: unknown): AcademicTerm {
  const term = Number(value);
  return term === 1 || term === 2 || term === 3 ? term : 1;
}

export function normalizeSchoolData(rawData: unknown): SchoolData {
  const parsedData = (rawData && typeof rawData === "object" ? rawData : {}) as Partial<SchoolData>;
  const schemaVersion = Number(parsedData.schemaVersion) || 1;
  const students = Array.isArray(parsedData.students) ? parsedData.students : [];
  const turmas = Array.isArray(parsedData.turmas) ? parsedData.turmas : [];
  const activities = Array.isArray(parsedData.activities)
    ? parsedData.activities.map((activity) => ({ ...activity, term: normalizeAcademicTerm(activity.term) }))
    : [];
  const termSettings = Array.isArray(parsedData.termSettings)
    ? parsedData.termSettings
        .filter((setting) => typeof setting.turmaId === "string")
        .map((setting) => ({
          ...setting,
          term: normalizeAcademicTerm(setting.term),
          totalPoints: Number.isFinite(Number(setting.totalPoints)) ? Math.max(0, Number(setting.totalPoints)) : 0,
        }))
    : [];
  const studentExtraPoints = Array.isArray(parsedData.studentExtraPoints)
    ? parsedData.studentExtraPoints
        .filter((entry) => typeof entry.studentId === "string")
        .map((entry) => ({ ...entry, term: normalizeAcademicTerm(entry.term), points: sanitizeExtraPoints(Number(entry.points)) }))
    : [];
  const validBlockIds = new Set<EvaluationBlockId>(EVALUATION_BLOCKS.map((block) => block.id));
  const evaluationComponents: EvaluationComponent[] = Array.isArray(parsedData.evaluationComponents)
    ? parsedData.evaluationComponents
        .filter((component) =>
          typeof component.id === "string" &&
          typeof component.turmaId === "string" &&
          typeof component.name === "string" &&
          validBlockIds.has(component.blockId),
        )
        .map((component) => ({
          ...component,
          term: normalizeAcademicTerm(component.term),
          maxPoints: component.maxPoints === null
            ? null
            : Number.isFinite(Number(component.maxPoints)) ? Math.max(0, Number(component.maxPoints)) : 0,
          kind: component.kind === "activities" ? "activities" : "manual",
          order: Number.isFinite(Number(component.order)) ? Number(component.order) : 0,
        }))
    : [];
  const componentScores: StudentComponentScore[] = Array.isArray(parsedData.componentScores)
    ? parsedData.componentScores
        .filter((score) => typeof score.studentId === "string" && typeof score.componentId === "string" && Number.isFinite(Number(score.score)))
        .map((score) => ({ ...score, score: sanitizeExtraPoints(Number(score.score)) }))
    : [];

  const components = [...evaluationComponents];
  const migratedScores = [...componentScores];
  const migratingLegacyData = schemaVersion < 2;
  const repairingActivityMaximum = schemaVersion < 3;
  const componentExists = (turmaId: string, term: AcademicTerm, blockId: EvaluationBlockId) =>
    components.some((component) => component.turmaId === turmaId && component.term === term && component.blockId === blockId);

  for (const turma of turmas) {
    for (const term of ACADEMIC_TERMS) {
      const legacySetting = termSettings.find((setting) => setting.turmaId === turma.id && setting.term === term);
      const hasLegacyActivities = activities.some((activity) => activity.turmaId === turma.id && activity.term === term);
      const legacyActivityMaximum = legacySetting
        ? Math.min(20, legacySetting.totalPoints)
        : 10;

      if (!componentExists(turma.id, term, "AEP")) {
        const activityId = evaluationComponentId(turma.id, term, "AEP", "activities");
        components.push({
          id: activityId,
          turmaId: turma.id,
          term,
          blockId: "AEP",
          name: "Atividades",
          maxPoints: legacyActivityMaximum,
          kind: "activities",
          order: 0,
        });
        const remainingPoints = Math.max(0, 20 - legacyActivityMaximum);
        if (remainingPoints > 0) {
          components.push({
            id: evaluationComponentId(turma.id, term, "AEP", "feira"),
            turmaId: turma.id,
            term,
            blockId: "AEP",
            name: "Feira",
            maxPoints: remainingPoints,
            kind: "manual",
            order: 1,
          });
        }
      }

      if (repairingActivityMaximum && hasLegacyActivities) {
        const aepComponents = components.filter((component) => component.turmaId === turma.id && component.term === term && component.blockId === "AEP");
        const activityComponent = aepComponents.find((component) => component.kind === "activities");
        const feiraComponent = aepComponents.find((component) => component.id === evaluationComponentId(turma.id, term, "AEP", "feira"));
        const isUneditedDefaultSplit = aepComponents.length === 2 &&
          activityComponent?.id === evaluationComponentId(turma.id, term, "AEP", "activities") &&
          activityComponent.maxPoints === 0 &&
          feiraComponent?.kind === "manual" &&
          feiraComponent.maxPoints === 20;

        if (isUneditedDefaultSplit && activityComponent && feiraComponent && (!legacySetting || legacySetting.totalPoints > 0)) {
          const maximum = legacySetting ? Math.min(20, legacySetting.totalPoints) : 10;
          activityComponent.maxPoints = maximum;
          feiraComponent.maxPoints = 20 - maximum;
          if (!legacySetting) termSettings.push({ turmaId: turma.id, term, totalPoints: maximum });
        }
      }

      for (const block of EVALUATION_BLOCKS) {
        if (componentExists(turma.id, term, block.id)) continue;
        const id = evaluationComponentId(turma.id, term, block.id, "default");
        components.push({
          id,
          turmaId: turma.id,
          term,
          blockId: block.id,
          name: block.id === "PE" ? "Pontos extras" : block.label,
          maxPoints: block.maxPoints,
          kind: "manual",
          order: 0,
        });
      }

      if (migratingLegacyData) {
        const peComponent = components.find((component) => component.turmaId === turma.id && component.term === term && component.blockId === "PE");
        if (peComponent) {
          for (const legacyScore of studentExtraPoints) {
            const student = students.find((item) => item.id === legacyScore.studentId && item.turma === turma.name);
            if (!student || legacyScore.term !== term) continue;
            const alreadyMigrated = migratedScores.some((score) => score.studentId === student.id && score.componentId === peComponent.id);
            if (!alreadyMigrated && legacyScore.points > 0) {
              migratedScores.push({ studentId: student.id, componentId: peComponent.id, score: legacyScore.points });
            }
          }
        }
      }
    }
  }

  return {
    ...parsedData,
    schemaVersion: Math.max(3, schemaVersion),
    students,
    turmas,
    activities,
    activityRecords: Array.isArray(parsedData.activityRecords) ? parsedData.activityRecords : [],
    studentExtraPoints,
    termSettings,
    evaluationComponents: components,
    componentScores: migratedScores,
  };
}

export function getTermLabel(term: AcademicTerm): string {
  return `${term}º trimestre`;
}

export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(points);
}

export function roundGrade(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitizeExtraPoints(points: number): number {
  return Number.isFinite(points) ? roundGrade(Math.max(0, points)) : 0;
}

export function getStudentExtraPoints(entries: readonly StudentExtraPoints[], studentId: string, term: AcademicTerm): number {
  return sanitizeExtraPoints(entries.find((entry) => entry.studentId === studentId && entry.term === term)?.points ?? 0);
}

export function updateStudentExtraPoints(entries: readonly StudentExtraPoints[], studentId: string, term: AcademicTerm, points: number): StudentExtraPoints[] {
  const remaining = entries.filter((entry) => entry.studentId !== studentId || entry.term !== term);
  const safePoints = sanitizeExtraPoints(points);
  return safePoints > 0 ? [...remaining, { studentId, term, points: safePoints }] : remaining;
}

export function getTermTotalPoints(
  settings: readonly TermSettings[],
  turmaId: string,
  term: AcademicTerm,
): number {
  const totalPoints = settings.find((setting) => setting.turmaId === turmaId && setting.term === term)?.totalPoints;

  return typeof totalPoints === "number" && Number.isFinite(totalPoints)
    ? Math.max(0, totalPoints)
    : 0;
}

export function getTermActivities(
  activities: readonly Activity[],
  turmaId: string,
  term: AcademicTerm,
): Activity[] {
  return activities
    .filter((activity) => activity.turmaId === turmaId && normalizeAcademicTerm(activity.term) === term)
    .sort((first, second) => first.date.localeCompare(second.date));
}

export function updateActivityDetails(activity: Activity, changes: ActivityChanges): Activity {
  const name = changes.name === undefined ? activity.name : changes.name.trim();

  if (!name) return activity;

  return {
    ...activity,
    name,
    term: changes.term === undefined ? activity.term : normalizeAcademicTerm(changes.term),
  };
}

export function indexActivityRecords(records: readonly ActivityRecord[]): ActivityRecordIndex {
  return new Map(
    records.map((record) => [`${record.studentId}:${record.activityId}`, record]),
  );
}

export function getIndexedActivityRecord(
  recordIndex: ActivityRecordIndex,
  studentId: string,
  activityId: string,
): ActivityRecord | undefined {
  return recordIndex.get(`${studentId}:${activityId}`);
}

export function isActivityLate(activity: Activity, record?: ActivityRecord | null): boolean {
  return Boolean(
    record?.done &&
      activity.deadline &&
      record.markedAt &&
      !record.overrideOnTime &&
      record.markedAt > activity.deadline,
  );
}

export function getActivityStatusLabel(activity: Activity, record?: ActivityRecord | null): string {
  if (!record?.done) return "Pendente";
  return isActivityLate(activity, record) ? "Atrasado (70%)" : "No prazo";
}

export function getActivityEarnedPoints(
  activity: Activity,
  record: ActivityRecord | null | undefined,
  activityValue: number,
): number {
  if (!record?.done || !Number.isFinite(activityValue) || activityValue <= 0) return 0;

  return activityValue * (isActivityLate(activity, record) ? LATE_ACTIVITY_FACTOR : 1);
}

export function formatActivityExportResult(
  activity: Activity,
  record: ActivityRecord | null | undefined,
  activityValue: number,
): string {
  const points = getActivityEarnedPoints(activity, record, activityValue);
  return `${getActivityStatusLabel(activity, record)} (${formatPoints(roundGrade(points))})`;
}

export function getStudentTermSummary(
  studentId: string,
  activities: readonly Activity[],
  recordIndex: ActivityRecordIndex,
  totalPoints: number,
  extraPoints: number = 0,
): StudentTermSummary {
  let onTime = 0;
  let late = 0;

  for (const activity of activities) {
    const record = getIndexedActivityRecord(recordIndex, studentId, activity.id);
    if (!record?.done) continue;

    if (isActivityLate(activity, record)) {
      late += 1;
    } else {
      onTime += 1;
    }
  }

  const activityCount = activities.length;
  const safeTotalPoints = Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;
  const weightedActivities = onTime + late * LATE_ACTIVITY_FACTOR;
  const safeExtraPoints = sanitizeExtraPoints(extraPoints);
  const activityGrade = activityCount > 0 ? roundGrade((safeTotalPoints * weightedActivities) / activityCount) : 0;
  const weightedPercentage = activityCount > 0
    ? roundGrade((weightedActivities / activityCount) * 100)
    : 0;

  return {
    activityCount,
    onTime,
    late,
    pending: Math.max(0, activityCount - onTime - late),
    totalPoints: safeTotalPoints,
    activityValue: activityCount > 0 ? safeTotalPoints / activityCount : 0,
    weightedPercentage,
    activityGrade,
    extraPoints: safeExtraPoints,
    finalGrade: roundGrade(activityGrade + safeExtraPoints),
  };
}
