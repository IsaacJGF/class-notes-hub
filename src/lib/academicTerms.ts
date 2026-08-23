import type { AcademicTerm, Activity, ActivityRecord, SchoolData, TermSettings } from "@/types";

export const ACADEMIC_TERMS: readonly AcademicTerm[] = [1, 2, 3];
export const LATE_ACTIVITY_FACTOR = 0.7;

export interface StudentTermSummary {
  activityCount: number;
  onTime: number;
  late: number;
  pending: number;
  totalPoints: number;
  activityValue: number;
  weightedPercentage: number;
  finalGrade: number;
}

export type ActivityRecordIndex = ReadonlyMap<string, ActivityRecord>;

export function normalizeAcademicTerm(value: unknown): AcademicTerm {
  const term = Number(value);
  return term === 1 || term === 2 || term === 3 ? term : 1;
}

export function normalizeSchoolData(rawData: unknown): SchoolData {
  const parsedData = (rawData && typeof rawData === "object" ? rawData : {}) as Partial<SchoolData>;

  return {
    ...parsedData,
    students: Array.isArray(parsedData.students) ? parsedData.students : [],
    turmas: Array.isArray(parsedData.turmas) ? parsedData.turmas : [],
    activities: Array.isArray(parsedData.activities)
      ? parsedData.activities.map((activity) => ({
          ...activity,
          term: normalizeAcademicTerm(activity.term),
        }))
      : [],
    activityRecords: Array.isArray(parsedData.activityRecords) ? parsedData.activityRecords : [],
    termSettings: Array.isArray(parsedData.termSettings)
      ? parsedData.termSettings
          .filter((setting) => typeof setting.turmaId === "string")
          .map((setting) => ({
            ...setting,
            term: normalizeAcademicTerm(setting.term),
            totalPoints: Number.isFinite(Number(setting.totalPoints))
              ? Math.max(0, Number(setting.totalPoints))
              : 0,
          }))
      : [],
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
    finalGrade: activityCount > 0
      ? roundGrade((safeTotalPoints * weightedActivities) / activityCount)
      : 0,
  };
}
