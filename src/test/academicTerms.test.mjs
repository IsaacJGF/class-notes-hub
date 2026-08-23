import test from "node:test";
import assert from "node:assert/strict";
import {
  formatLocalDate,
  formatActivityExportResult,
  getActivityEarnedPoints,
  getActivityStatusLabel,
  getStudentTermSummary,
  getTermActivities,
  getTermTotalPoints,
  indexActivityRecords,
  isActivityLate,
  normalizeAcademicTerm,
  normalizeSchoolData,
} from "../lib/academicTerms.ts";

function activity(id, overrides = {}) {
  return {
    id,
    turmaId: "3A",
    name: `Atividade ${id}`,
    date: "2026-03-10",
    deadline: "2026-03-12",
    term: 1,
    createdAt: "2026-03-10T12:00:00.000Z",
    ...overrides,
  };
}

function record(activityId, overrides = {}) {
  return {
    id: `registro-${activityId}`,
    studentId: "ana",
    activityId,
    done: true,
    markedAt: "2026-03-12",
    ...overrides,
  };
}

test("mantém os três trimestres e associa registros antigos ao primeiro", () => {
  assert.equal(normalizeAcademicTerm(1), 1);
  assert.equal(normalizeAcademicTerm("2"), 2);
  assert.equal(normalizeAcademicTerm(3), 3);
  assert.equal(normalizeAcademicTerm(undefined), 1);
  assert.equal(normalizeAcademicTerm(4), 1);
});

test("migra atividades existentes para o primeiro trimestre sem descartar dados antigos", () => {
  const legacyData = {
    students: [{ id: "ana", name: "Ana", turma: "3A" }],
    turmas: [{ id: "3A", name: "3A" }],
    activities: [{ ...activity("a"), term: undefined }],
    activityRecords: [record("a")],
    attendanceRecords: [{ studentId: "ana", date: "2026-03-10", present: true }],
    classRecords: [{ studentId: "ana", participated: true }],
  };
  const migrated = normalizeSchoolData(legacyData);

  assert.equal(migrated.activities[0].term, 1);
  assert.deepEqual(migrated.termSettings, []);
  assert.deepEqual(migrated.attendanceRecords, legacyData.attendanceRecords);
  assert.deepEqual(migrated.classRecords, legacyData.classRecords);
});

test("normaliza configurações trimestrais inválidas sem aceitar valores negativos", () => {
  const migrated = normalizeSchoolData({
    termSettings: [
      { turmaId: "3A", term: "2", totalPoints: "4.5" },
      { turmaId: "3A", term: 3, totalPoints: -2 },
      { turmaId: null, term: 1, totalPoints: 10 },
    ],
  });

  assert.deepEqual(migrated.termSettings, [
    { turmaId: "3A", term: 2, totalPoints: 4.5 },
    { turmaId: "3A", term: 3, totalPoints: 0 },
  ]);
});

test("separa atividades por turma e trimestre em ordem cronológica", () => {
  const activities = [
    activity("b", { date: "2026-03-20" }),
    activity("outro-trimestre", { term: 2 }),
    activity("outra-turma", { turmaId: "2B" }),
    activity("a", { date: "2026-03-10" }),
  ];

  assert.deepEqual(getTermActivities(activities, "3A", 1).map((item) => item.id), ["a", "b"]);
});

test("permite valores diferentes para cada turma e trimestre", () => {
  const settings = [
    { turmaId: "3A", term: 1, totalPoints: 3 },
    { turmaId: "3A", term: 2, totalPoints: 4.5 },
    { turmaId: "2B", term: 1, totalPoints: 2 },
  ];

  assert.equal(getTermTotalPoints(settings, "3A", 1), 3);
  assert.equal(getTermTotalPoints(settings, "3A", 2), 4.5);
  assert.equal(getTermTotalPoints(settings, "2B", 1), 2);
  assert.equal(getTermTotalPoints(settings, "3A", 3), 0);
});

test("entregas no prazo recebem o valor integral", () => {
  const activities = [activity("a"), activity("b"), activity("c")];
  const records = indexActivityRecords([record("a"), record("b"), record("c")]);
  const summary = getStudentTermSummary("ana", activities, records, 3);

  assert.equal(summary.onTime, 3);
  assert.equal(summary.late, 0);
  assert.equal(summary.activityValue, 1);
  assert.equal(summary.weightedPercentage, 100);
  assert.equal(summary.finalGrade, 3);
});

test("entregas atrasadas recebem 70% do valor da atividade", () => {
  const activities = [activity("a"), activity("b"), activity("c")];
  const records = indexActivityRecords([
    record("a"),
    record("b", { markedAt: "2026-03-13" }),
  ]);
  const summary = getStudentTermSummary("ana", activities, records, 3);

  assert.equal(summary.onTime, 1);
  assert.equal(summary.late, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.weightedPercentage, 56.67);
  assert.equal(summary.finalGrade, 1.7);
});

test("calcula a nota do trimestre com oito entregas, um atraso e uma pendência", () => {
  const activities = Array.from({ length: 10 }, (_, index) => activity(String(index + 1)));
  const records = indexActivityRecords([
    ...activities.slice(0, 8).map((item) => record(item.id)),
    record("9", { markedAt: "2026-03-13" }),
  ]);
  const summary = getStudentTermSummary("ana", activities, records, 3);

  assert.equal(summary.onTime, 8);
  assert.equal(summary.late, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.weightedPercentage, 87);
  assert.equal(summary.finalGrade, 2.61);
});

test("prepara a exportação Excel com situação e nota proporcional", () => {
  const currentActivity = activity("a");
  const onTimeRecord = record("a");
  const lateRecord = record("a", { markedAt: "2026-03-15" });

  assert.equal(getActivityEarnedPoints(currentActivity, lateRecord, 0.3), 0.21);
  assert.equal(formatActivityExportResult(currentActivity, onTimeRecord, 0.3), "No prazo (0,30)");
  assert.equal(formatActivityExportResult(currentActivity, lateRecord, 0.3), "Atrasado (70%) (0,21)");
  assert.equal(formatActivityExportResult(currentActivity, undefined, 0.3), "Pendente (0,00)");
});

test("arredonda somente a nota final após distribuir parcelas fracionárias", () => {
  const activities = [activity("a"), activity("b"), activity("c")];
  const records = indexActivityRecords([
    record("a"),
    record("b", { markedAt: "2026-03-13" }),
  ]);
  const summary = getStudentTermSummary("ana", activities, records, 1);

  assert.equal(summary.activityValue, 1 / 3);
  assert.equal(summary.finalGrade, 0.57);
});

test("correção manual de atraso devolve 100% da parcela", () => {
  const currentActivity = activity("a");
  const acceptedRecord = record("a", {
    markedAt: "2026-03-15",
    overrideOnTime: true,
  });
  const summary = getStudentTermSummary(
    "ana",
    [currentActivity],
    indexActivityRecords([acceptedRecord]),
    2.5,
  );

  assert.equal(isActivityLate(currentActivity, acceptedRecord), false);
  assert.equal(summary.finalGrade, 2.5);
});

test("atividade entregue no último dia do prazo não sofre desconto", () => {
  const currentActivity = activity("a");

  assert.equal(isActivityLate(currentActivity, record("a")), false);
});

test("atividade sem prazo sempre recebe a pontuação integral quando concluída", () => {
  const currentActivity = activity("a", { deadline: undefined });
  const currentRecord = record("a", { markedAt: "2026-12-20" });

  assert.equal(isActivityLate(currentActivity, currentRecord), false);
  assert.equal(getActivityStatusLabel(currentActivity, currentRecord), "No prazo");
});

test("atividades pendentes recebem nota zero", () => {
  const activities = [activity("a"), activity("b")];
  const records = indexActivityRecords([
    record("a", { done: false, markedAt: undefined }),
  ]);
  const summary = getStudentTermSummary("ana", activities, records, 4);

  assert.equal(summary.pending, 2);
  assert.equal(summary.finalGrade, 0);
  assert.equal(summary.weightedPercentage, 0);
});

test("trimestre sem atividades não divide a nota por zero", () => {
  const summary = getStudentTermSummary("ana", [], indexActivityRecords([]), 3);

  assert.equal(summary.activityCount, 0);
  assert.equal(summary.activityValue, 0);
  assert.equal(summary.finalGrade, 0);
});

test("formata datas usando o calendário local", () => {
  assert.equal(formatLocalDate(new Date(2026, 7, 23, 21, 30)), "2026-08-23");
});
