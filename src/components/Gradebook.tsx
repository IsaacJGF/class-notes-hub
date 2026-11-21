import { Fragment, useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, ChevronDown, Clock3, Download, History, Settings2, Plus, Trash2, Table2, Calculator, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { AcademicTerm, Activity, ActivityRecord, EvaluationBlockId, EvaluationComponent, SchoolData, Student, Turma } from "@/types";
import {
  EVALUATION_BLOCKS,
  formatPoints,
  getActivityStatusLabel,
  getStudentTermSummary,
  getTermActivities,
  getTermLabel,
  indexActivityRecords,
  isActivityLate,
  roundGrade,
  type ActivityChanges,
} from "@/lib/academicTerms";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchesAccentAware } from "@/lib/textSearch";
import { ActivitySummary } from "@/components/ActivitySummary";
import { TransferStudentDialog } from "@/components/TransferStudentDialog";

interface Props {
  turma: Turma;
  term: AcademicTerm;
  data: SchoolData;
  removeStudent: (id: string) => void;
  transferStudent: (studentId: string, targetTurmaId: string) => void;
  searchQuery: string;
  studentSortOrder: "asc" | "desc";
  setStudentComponentScore: (studentId: string, componentId: string, score: number | null) => string | null;
  saveEvaluationConfiguration: (turmaId: string, term: AcademicTerm, components: EvaluationComponent[]) => string | null;
  addActivity: (turmaId: string, name: string, date: string, term: AcademicTerm, deadline?: string) => Activity;
  updateActivity: (id: string, changes: ActivityChanges) => void;
  removeActivity: (id: string) => void;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
}

type StudentGrades = {
  blockTotals: Record<EvaluationBlockId, number>;
  activitySummary: ReturnType<typeof getStudentTermSummary>;
  finalTotal: number;
};

type HistoricalActivity = {
  activity: Activity;
  record: ActivityRecord;
  turmaId: string;
  turmaName: string;
};

function formatHistoryDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `component-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function orderedComponents(components: EvaluationComponent[]) {
  return [...components].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}

export function Gradebook({
  turma,
  term,
  data,
  removeStudent,
  transferStudent,
  searchQuery,
  studentSortOrder,
  setStudentComponentScore,
  saveEvaluationConfiguration,
  addActivity,
  updateActivity,
  removeActivity,
  toggleActivityRecord,
  getActivityRecordFull,
  setActivityOnTimeOverride,
}: Props) {
  const [configOpen, setConfigOpen] = useState(false);
  const [draftComponents, setDraftComponents] = useState<EvaluationComponent[]>([]);
  const [expandedHistoryStudentId, setExpandedHistoryStudentId] = useState<string | null>(null);
  const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);
  const allStudents = useMemo(
    () => data.students
      .filter((student) => student.turma === turma.name)
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        return studentSortOrder === "asc" ? comparison : -comparison;
      }),
    [data.students, turma.name, studentSortOrder],
  );
  const students = useMemo(
    () => searchQuery.trim() ? allStudents.filter((student) => matchesAccentAware(student.name, searchQuery)) : allStudents,
    [allStudents, searchQuery],
  );
  const historyByStudent = useMemo(() => {
    const studentIds = new Set(allStudents.map((student) => student.id));
    const activitiesById = new Map(data.activities.map((activity) => [activity.id, activity]));
    const turmaNamesById = new Map(data.turmas.map((item) => [item.id, item.name]));
    const history = new Map<string, HistoricalActivity[]>();

    for (const record of data.activityRecords) {
      if (!studentIds.has(record.studentId)) continue;
      const activity = activitiesById.get(record.activityId);
      if (!activity || activity.turmaId === turma.id) continue;
      const entries = history.get(record.studentId) ?? [];
      entries.push({
        activity,
        record,
        turmaId: activity.turmaId,
        turmaName: turmaNamesById.get(activity.turmaId) ?? "Turma anterior",
      });
      history.set(record.studentId, entries);
    }

    for (const entries of history.values()) entries.sort((first, second) => second.activity.date.localeCompare(first.activity.date));
    return history;
  }, [allStudents, data.activities, data.activityRecords, data.turmas, turma.id]);
  const components = useMemo(
    () => data.evaluationComponents
      .filter((component) => component.turmaId === turma.id && component.term === term)
      .sort((a, b) => EVALUATION_BLOCKS.findIndex((block) => block.id === a.blockId) - EVALUATION_BLOCKS.findIndex((block) => block.id === b.blockId) || a.order - b.order),
    [data.evaluationComponents, turma.id, term],
  );
  const activities = useMemo(() => getTermActivities(data.activities, turma.id, term), [data.activities, turma.id, term]);
  const recordIndex = useMemo(() => indexActivityRecords(data.activityRecords), [data.activityRecords]);
  const scoreByStudentComponent = useMemo(
    () => new Map(data.componentScores.map((score) => [`${score.studentId}:${score.componentId}`, score.score])),
    [data.componentScores],
  );
  const componentsByBlock = useMemo(() => EVALUATION_BLOCKS.map((block) => ({
    ...block,
    components: orderedComponents(components.filter((component) => component.blockId === block.id)),
  })), [components]);
  const activityComponent = components.find((component) => component.blockId === "AEP" && component.kind === "activities");
  const activityMaximum = activityComponent?.maxPoints ?? 0;

  const gradesByStudent = useMemo(() => {
    const result = new Map<string, StudentGrades>();
    for (const student of allStudents) {
      const activitySummary = getStudentTermSummary(student.id, activities, recordIndex, activityMaximum);
      const blockTotals = Object.fromEntries(EVALUATION_BLOCKS.map((block) => [block.id, 0])) as Record<EvaluationBlockId, number>;
      for (const component of components) {
        const value = component.kind === "activities"
          ? activitySummary.activityGrade
          : scoreByStudentComponent.get(`${student.id}:${component.id}`) ?? 0;
        blockTotals[component.blockId] += value;
      }
      const finalTotal = roundGrade(EVALUATION_BLOCKS.reduce((sum, block) => sum + blockTotals[block.id], 0));
      result.set(student.id, {
        blockTotals,
        activitySummary,
        finalTotal,
      });
    }
    return result;
  }, [allStudents, activities, recordIndex, activityMaximum, components, scoreByStudentComponent]);

  const openConfiguration = () => {
    setDraftComponents(components.map((component) => ({ ...component })));
    setConfigOpen(true);
  };

  const updateDraft = (id: string, changes: Partial<EvaluationComponent>) => {
    setDraftComponents((current) => current.map((component) => component.id === id ? { ...component, ...changes } : component));
  };

  const addDraftComponent = (blockId: EvaluationBlockId) => {
    const siblings = draftComponents.filter((component) => component.blockId === blockId);
    const block = EVALUATION_BLOCKS.find((item) => item.id === blockId);
    setDraftComponents((current) => [...current, {
      id: makeId(),
      turmaId: turma.id,
      term,
      blockId,
      name: "Nova subramificação",
      maxPoints: block?.maxPoints === null ? null : 0,
      kind: "manual",
      order: siblings.length,
    }]);
  };

  const removeDraftComponent = (component: EvaluationComponent) => {
    const siblings = draftComponents.filter((item) => item.blockId === component.blockId);
    if (siblings.length <= 1) {
      toast.error("Cada nota precisa manter pelo menos um campo de lançamento.");
      return;
    }
    if (component.kind === "activities") {
      toast.error("A ramificação fixa Atividades do AEP é necessária para manter os registros e cálculos atuais.");
      return;
    }
    if (data.componentScores.some((score) => score.componentId === component.id) && !window.confirm(`Excluir “${component.name}” também apagará as notas lançadas nessa subramificação. Continuar?`)) return;

    const remaining = siblings.filter((item) => item.id !== component.id).sort((a, b) => a.order - b.order);
    const removedMaximum = component.maxPoints ?? 0;
    setDraftComponents((current) => current
      .filter((item) => item.id !== component.id)
      .map((item) => {
        if (item.blockId !== component.blockId) return item;
        if (remaining.length === 1) return { ...item, maxPoints: component.blockId === "PE" ? null : 20, order: 0 };
        if (item.id === remaining[0].id && item.maxPoints !== null) return { ...item, maxPoints: item.maxPoints + removedMaximum };
        return item;
      }));
  };

  const changeDraftMaximum = (component: EvaluationComponent, value: string) => {
    const maximum = value.trim() === "" ? null : Number(value);
    const block = EVALUATION_BLOCKS.find((item) => item.id === component.blockId);
    if (block?.maxPoints !== null && maximum !== null) {
      const siblings = draftComponents.filter((item) => item.blockId === component.blockId);
      const total = siblings.reduce((sum, item) => sum + (item.id === component.id ? maximum : (item.maxPoints ?? 0)), 0);
      if (total > 20) {
        toast.error(`${block.label}: a soma das subramificações não pode passar de 20 pontos.`);
        return;
      }
    }
    updateDraft(component.id, { maxPoints: maximum });
  };

  const saveConfiguration = () => {
    const error = saveEvaluationConfiguration(turma.id, term, draftComponents);
    if (error) {
      toast.error(error);
      return;
    }
    setConfigOpen(false);
    toast.success("Divisões das notas salvas.");
  };

  const handleScoreChange = (studentId: string, component: EvaluationComponent, value: string) => {
    const score = value.trim() === "" ? null : Number(value);
    if (score !== null && !Number.isFinite(score)) return;
    const error = setStudentComponentScore(studentId, component.id, score);
    if (error) toast.error(error);
  };

  const exportWorkbook = () => {
    const gradeHeaders = [
      "Aluno",
      ...componentsByBlock.map((block) => block.id === "PE" ? "Pontuação extra" : block.label),
      "Nota final",
    ];
    const gradeRows = allStudents.map((student) => {
      const summary = gradesByStudent.get(student.id)!;
      return [
        student.name,
        ...componentsByBlock.map((block) => roundGrade(summary.blockTotals[block.id])),
        roundGrade(summary.finalTotal),
      ];
    });
    const gradeSheet = XLSX.utils.aoa_to_sheet([gradeHeaders, ...gradeRows]);
    gradeSheet["!cols"] = [
      { wch: 32 },
      ...componentsByBlock.map((block) => ({ wch: block.id === "PE" ? 18 : 12 })),
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, gradeSheet, "Notas");
    XLSX.writeFile(workbook, `notas_${turma.name}_${term}o_trimestre.xlsx`);
  };

  const componentScore = (studentId: string, component: EvaluationComponent) => component.kind === "activities"
    ? gradesByStudent.get(studentId)?.activitySummary.activityGrade ?? 0
    : scoreByStudentComponent.get(studentId + ":" + component.id);

  const renderBranchTable = (block: typeof EVALUATION_BLOCKS[number], component: EvaluationComponent) => component.kind === "activities" ? (
    <ActivitySummary
      turma={turma}
      term={term}
      data={data}
      students={students}
      activityMaximum={component.maxPoints ?? 0}
      addActivity={addActivity}
      updateActivity={updateActivity}
      removeActivity={removeActivity}
      toggleActivityRecord={toggleActivityRecord}
      getActivityRecordFull={getActivityRecordFull}
      setActivityOnTimeOverride={setActivityOnTimeOverride}
    />
  ) : (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{component.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {component.maxPoints === null ? "Sem limite de pontuação" : "Limite de " + formatPoints(component.maxPoints) + " pontos"}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="school-table min-w-full">
          <thead><tr>
            <th className="w-[42%]">Aluno</th>
            <th className="text-center">Nota</th>
          </tr></thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={2} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
            ) : students.map((student) => {
              const score = componentScore(student.id, component);
              return <tr key={student.id}>
                <td className="whitespace-nowrap font-medium">{student.name}</td>
                <td className="text-center">
                  <div className="mx-auto flex max-w-40 items-center justify-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={component.maxPoints ?? undefined}
                      step="0.01"
                      inputMode="decimal"
                      aria-label={student.name + " — " + block.label + " — " + component.name}
                      value={score ?? ""}
                      placeholder="—"
                      onChange={(event) => handleScoreChange(student.id, component, event.currentTarget.value)}
                      className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-center text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{component.maxPoints === null ? "pts" : "/ " + formatPoints(component.maxPoints)}</span>
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBlockDetailSheet = (block: typeof EVALUATION_BLOCKS[number] & { components: EvaluationComponent[] }) => (
    <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Table2 size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Planilha completa — {block.id === "PE" ? "Pontuação extra (P.E.)" : block.label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Recolhida. Expanda para consultar todas as ramificações e o total do bloco.</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3 sm:p-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="school-table min-w-full">
            <thead><tr>
              <th>Aluno</th>
              {block.components.map((component) => <th key={component.id} className="text-center">
                <span className="block">{component.name}</span>
                <span className="mt-0.5 block text-[10px] font-normal normal-case opacity-75">{component.kind === "activities" ? "calculada" : component.maxPoints === null ? "sem limite" : "até " + formatPoints(component.maxPoints) + " pts"}</span>
              </th>)}
              <th className="text-center">Total {block.label}</th>
            </tr></thead>
            <tbody>{students.length === 0 ? (
              <tr><td colSpan={block.components.length + 2} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
            ) : students.map((student) => <tr key={student.id}>
              <td className="whitespace-nowrap font-medium">{student.name}</td>
              {block.components.map((component) => {
                const score = componentScore(student.id, component);
                return <td key={component.id} className="text-center">{score === undefined ? <span className="text-muted-foreground">—</span> : formatPoints(score)}</td>;
              })}
              <td className="text-center font-bold">{formatPoints(gradesByStudent.get(student.id)!.blockTotals[block.id])}{block.maxPoints === null ? "" : " / 20"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </details>
  );

  return (
    <section className="section-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-primary/10 via-card to-card px-4 py-4 sm:px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Calculator size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold tracking-tight">Notas de {turma.name}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{getTermLabel(term)} · cinco avaliações de até 20 pontos e pontuação extra</div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button onClick={openConfiguration} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted sm:flex-none">
            <Settings2 size={14} /> Configurar divisões
          </button>
          <button onClick={exportWorkbook} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition hover:opacity-90 sm:flex-none" style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList aria-label="Blocos de notas" className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl border border-border bg-muted/60 p-1 sm:min-w-0">
              <TabsTrigger value="overview" className="min-h-10 rounded-lg px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Geral</TabsTrigger>
              {componentsByBlock.map((block) => <TabsTrigger key={block.id} value={block.id} className="min-h-10 rounded-lg px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">{block.id === "PE" ? "Pontuação extra" : block.label}</TabsTrigger>)}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold">Resumo geral das notas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="school-table min-w-full">
                  <thead><tr>
                    <th>Aluno</th>
                    {componentsByBlock.map((block) => <th key={block.id} className="text-center">{block.label}<span className="mt-0.5 block text-[10px] font-normal normal-case opacity-75">{block.maxPoints === null ? "extra" : "/ 20"}</span></th>)}
                    <th className="text-center">Nota final</th>
                    <th className="text-center">Ações</th>
                  </tr></thead>
                  <tbody>{students.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
                  ) : students.map((student) => {
                    const summary = gradesByStudent.get(student.id)!;
                    const history = historyByStudent.get(student.id) ?? [];
                    const historyGroups = new Map<string, HistoricalActivity[]>();
                    for (const entry of history) {
                      const key = `${entry.turmaId}:${entry.activity.term}`;
                      const group = historyGroups.get(key) ?? [];
                      group.push(entry);
                      historyGroups.set(key, group);
                    }
                    const historyExpanded = expandedHistoryStudentId === student.id;
                    return (
                      <Fragment key={student.id}>
                        <tr>
                          <td className="min-w-[220px] font-medium">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="whitespace-nowrap">{student.name}</span>
                              {history.length > 0 && (
                                <button
                                  onClick={() => setExpandedHistoryStudentId(historyExpanded ? null : student.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                                  aria-expanded={historyExpanded}
                                  aria-label={`${historyExpanded ? "Ocultar" : "Ver"} histórico de atividades de ${student.name}`}
                                >
                                  <History size={12} />Histórico ({history.length})
                                  <ChevronDown size={12} className={`transition-transform ${historyExpanded ? "rotate-180" : ""}`} />
                                </button>
                              )}
                            </div>
                          </td>
                          {componentsByBlock.map((block) => {
                            const belowAverage = block.id !== "PE" && summary.blockTotals[block.id] < 14;
                            return <td
                              key={block.id}
                              className={`text-center font-medium ${belowAverage ? "bg-destructive/10 font-semibold text-destructive" : ""}`}
                              title={belowAverage ? "Abaixo da média de 14 pontos neste bloco" : undefined}
                            >
                              {formatPoints(summary.blockTotals[block.id])}
                            </td>;
                          })}
                          <td className="text-center">
                            <span
                              className={`inline-flex min-w-16 justify-center rounded-full px-3 py-1 font-bold ${summary.finalTotal < 70 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                              title={summary.finalTotal < 70 ? "Nota final abaixo da média de 70 pontos" : undefined}
                            >
                              {formatPoints(summary.finalTotal)}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setStudentToTransfer(student)}
                                disabled={data.turmas.length < 2}
                                className="rounded p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Transferir para outra turma"
                                aria-label={`Transferir ${student.name} para outra turma`}
                              >
                                <ArrowLeftRight size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  const activityCount = data.activityRecords.filter((record) => record.studentId === student.id).length;
                                  const scoreCount = data.componentScores.filter((score) => score.studentId === student.id).length;
                                  if (window.confirm(`Excluir ${student.name}? Serão apagados ${activityCount} registro(s) de atividade e ${scoreCount} nota(s), incluindo o histórico. Essa ação não pode ser desfeita.`)) removeStudent(student.id);
                                }}
                                className="rounded p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                                title="Excluir aluno e seus registros"
                                aria-label={`Excluir ${student.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {historyExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-muted/20 p-3 sm:p-4">
                              <div className="space-y-4 rounded-lg border border-border bg-card p-3 sm:p-4">
                                <div>
                                  <p className="text-sm font-semibold">Histórico de atividades de {student.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">Registros mantidos da(s) turma(s) anterior(es). As atividades da turma atual continuam na planilha normal.</p>
                                </div>
                                {[...historyGroups.entries()].map(([key, entries]) => (
                                  <section key={key} className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                                      {entries[0].turmaName} · {getTermLabel(entries[0].activity.term)}
                                    </h4>
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {entries.map((entry) => {
                                        const late = isActivityLate(entry.activity, entry.record);
                                        const statusClass = !entry.record.done ? "border-destructive/20 bg-destructive/5 text-destructive" : late ? "border-amber-300/60 bg-amber-50 text-amber-700" : "border-emerald-300/60 bg-emerald-50 text-emerald-700";
                                        return (
                                          <div key={entry.activity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium">{entry.activity.name}</p>
                                              <p className="text-[11px] text-muted-foreground">
                                                Data: {formatHistoryDate(entry.activity.date)}
                                                {entry.activity.deadline ? ` · Prazo ${formatHistoryDate(entry.activity.deadline)}` : ""}
                                                {entry.record.markedAt ? ` · Feita em ${formatHistoryDate(entry.record.markedAt)}` : ""}
                                              </p>
                                            </div>
                                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass}`}>
                                              {!entry.record.done ? <XCircle size={13} /> : late ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
                                              {entry.record.done ? (late ? "Feita com atraso" : getActivityStatusLabel(entry.activity, entry.record)) : "Não entregue"}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </section>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {componentsByBlock.map((block) => (
            <TabsContent key={block.id} value={block.id} className="mt-0 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-muted/35 px-4 py-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bloco de avaliação</p><h2 className="mt-0.5 text-xl font-bold">{block.id === "PE" ? "Pontuação extra" : block.label}</h2></div>
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-right shadow-sm"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subramificações</p><p className="font-bold">{block.components.length}</p></div>
              </div>

              {renderBlockDetailSheet(block)}

              <Tabs key={block.id + "-" + block.components.map((component) => component.id).join("-")} defaultValue={block.components[0]?.id} className="space-y-3">
                <div className="overflow-x-auto pb-1">
                  <TabsList aria-label={"Ramificações de " + block.label} className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl border border-border bg-muted/60 p-1 sm:min-w-0">
                    {block.components.map((component) => <TabsTrigger key={component.id} value={component.id} className="min-h-10 max-w-64 gap-2 rounded-lg px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"><span className="truncate">{component.name}</span>{component.kind === "activities" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">automática</span>}</TabsTrigger>)}
                  </TabsList>
                </div>
                {block.components.map((component) => <TabsContent key={component.id} value={component.id} className="mt-0">{renderBranchTable(block, component)}</TabsContent>)}
              </Tabs>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <TransferStudentDialog
        open={studentToTransfer !== null}
        student={studentToTransfer}
        turmas={data.turmas}
        onOpenChange={(open) => { if (!open) setStudentToTransfer(null); }}
        onTransfer={transferStudent}
      />

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Configurar divisões — {turma.name}</DialogTitle>
            <DialogDescription>
              Ajuste as subramificações deste trimestre. Nas cinco notas regulares, os limites somam 20 pontos. A P.E. não tem limite geral.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {EVALUATION_BLOCKS.map((block) => {
              const blockComponents = orderedComponents(draftComponents.filter((component) => component.blockId === block.id));
              const allocated = roundGrade(blockComponents.reduce((sum, component) => sum + (component.maxPoints ?? 0), 0));
              return (
                <div key={block.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">{block.label}</h3>
                    <span className="text-xs text-muted-foreground">{block.maxPoints === null ? "Sem teto global; limite por ramificação é opcional" : `${formatPoints(allocated)} / 20 pts distribuídos`}</span>
                    <button onClick={() => addDraftComponent(block.id)} className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                      <Plus size={13} /> Adicionar ramificação
                    </button>
                  </div>
                  <div className="space-y-2">
                    {blockComponents.map((component) => (
                      <div key={component.id} className="grid grid-cols-[minmax(0,1fr)_8rem_2.5rem] items-center gap-2">
                        <input
                          aria-label={`Nome da ramificação ${component.name}`}
                          value={component.name}
                          onChange={(event) => updateDraft(component.id, { name: event.currentTarget.value })}
                          className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm"
                        />
                        {block.maxPoints === null ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={component.maxPoints ?? ""}
                            placeholder="Sem limite"
                            aria-label={`Limite de ${component.name}; vazio significa sem limite`}
                            onChange={(event) => changeDraftMaximum(component, event.currentTarget.value)}
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                          />
                        ) : blockComponents.length === 1 ? (
                          <div className="rounded bg-muted px-2 py-1.5 text-center text-sm">20 pts</div>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={component.maxPoints ?? 0}
                            aria-label={`Limite de ${component.name}`}
                            onChange={(event) => changeDraftMaximum(component, event.currentTarget.value)}
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                          />
                        )}
                        <button
                          onClick={() => removeDraftComponent(component)}
                          disabled={blockComponents.length <= 1 || component.kind === "activities"}
                          title={component.kind === "activities" ? "Ramificação fixa do AEP" : "Excluir ramificação"}
                          className="flex h-9 w-9 items-center justify-center rounded border border-border text-destructive disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <button onClick={() => setConfigOpen(false)} className="rounded border border-border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={saveConfiguration} className="rounded px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>Salvar divisões</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
