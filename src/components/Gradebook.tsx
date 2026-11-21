import { Fragment, useMemo, useState } from "react";
import { Download, Settings2, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { AcademicTerm, EvaluationBlockId, EvaluationComponent, SchoolData, Turma } from "@/types";
import {
  EVALUATION_BLOCKS,
  FIXED_EVALUATION_BLOCKS,
  formatActivityExportResult,
  formatPoints,
  getStudentTermSummary,
  getTermActivities,
  getTermLabel,
  indexActivityRecords,
  roundGrade,
} from "@/lib/academicTerms";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { matchesAccentAware } from "@/lib/textSearch";

interface Props {
  turma: Turma;
  term: AcademicTerm;
  data: SchoolData;
  searchQuery: string;
  setStudentComponentScore: (studentId: string, componentId: string, score: number | null) => string | null;
  saveEvaluationConfiguration: (turmaId: string, term: AcademicTerm, components: EvaluationComponent[]) => string | null;
}

type StudentGrades = {
  blockTotals: Record<EvaluationBlockId, number>;
  activitySummary: ReturnType<typeof getStudentTermSummary>;
  baseTotal: number;
  extraTotal: number;
  finalTotal: number;
};

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `component-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function orderedComponents(components: EvaluationComponent[]) {
  return [...components].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}

export function Gradebook({ turma, term, data, searchQuery, setStudentComponentScore, saveEvaluationConfiguration }: Props) {
  const [configOpen, setConfigOpen] = useState(false);
  const [draftComponents, setDraftComponents] = useState<EvaluationComponent[]>([]);
  const allStudents = useMemo(
    () => data.students
      .filter((student) => student.turma === turma.name)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [data.students, turma.name],
  );
  const students = useMemo(
    () => searchQuery.trim() ? allStudents.filter((student) => matchesAccentAware(student.name, searchQuery)) : allStudents,
    [allStudents, searchQuery],
  );
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
      const baseTotal = roundGrade(FIXED_EVALUATION_BLOCKS.reduce((sum, blockId) => sum + blockTotals[blockId], 0));
      const extraTotal = roundGrade(blockTotals.PE);
      result.set(student.id, {
        blockTotals,
        activitySummary,
        baseTotal,
        extraTotal,
        finalTotal: roundGrade(baseTotal + extraTotal),
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
    const gradeHeaders: (string | number)[] = ["Aluno", "Turma", "Trimestre"];
    for (const block of componentsByBlock) {
      for (const component of block.components) {
        gradeHeaders.push(`${block.label} — ${component.name} (${component.maxPoints === null ? "sem limite" : `${formatPoints(component.maxPoints)} pts`})`);
      }
      gradeHeaders.push(`Total ${block.label}${block.maxPoints === null ? "" : " / 20"}`);
    }
    gradeHeaders.push("Nota regular / 100", "Total final com P.E.");
    const gradeRows = allStudents.map((student) => {
      const summary = gradesByStudent.get(student.id)!;
      const row: (string | number)[] = [student.name, turma.name, getTermLabel(term)];
      for (const block of componentsByBlock) {
        for (const component of block.components) {
          const value = component.kind === "activities"
            ? summary.activitySummary.activityGrade
            : scoreByStudentComponent.get(`${student.id}:${component.id}`);
          row.push(value === undefined ? "" : roundGrade(value));
        }
        row.push(roundGrade(summary.blockTotals[block.id]));
      }
      row.push(summary.baseTotal, summary.finalTotal);
      return row;
    });
    const gradeSheet = XLSX.utils.aoa_to_sheet([[`Notas da turma ${turma.name} — ${getTermLabel(term)}`], [], gradeHeaders, ...gradeRows]);
    gradeSheet["!cols"] = gradeHeaders.map((header, index) => {
      const maxLength = Math.max(String(header).length, ...gradeRows.map((row) => String(row[index] ?? "").length));
      return { wch: Math.min(36, Math.max(index === 0 ? 28 : 14, maxLength + 2)) };
    });

    const activityHeaders = ["Aluno", "Turma", "No prazo", "Atrasadas (70%)", "Pendentes", "Aproveitamento (%)", "Nota AEP — Atividades", "Máximo", ...activities.map((activity) => `${activity.date} — ${activity.name}${activity.deadline ? ` (prazo ${activity.deadline})` : ""}`)];
    const activityRows = allStudents.map((student) => {
      const summary = gradesByStudent.get(student.id)!.activitySummary;
      return [
        student.name,
        turma.name,
        summary.onTime,
        summary.late,
        summary.pending,
        summary.weightedPercentage,
        summary.activityGrade,
        summary.totalPoints,
        ...activities.map((activity) => formatActivityExportResult(
          activity,
          recordIndex.get(`${student.id}:${activity.id}`),
          summary.activityValue,
        )),
      ];
    });
    const activitySheet = XLSX.utils.aoa_to_sheet([[`Atividades AEP — ${turma.name} — ${getTermLabel(term)}`], [], activityHeaders, ...activityRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, gradeSheet, "Notas");
    XLSX.utils.book_append_sheet(workbook, activitySheet, "Atividades AEP");
    XLSX.writeFile(workbook, `notas_${turma.name}_${term}o_trimestre.xlsx`);
  };

  const tableColumns = componentsByBlock.reduce((count, block) => count + block.components.length + 1, 3);

  return (
    <section className="section-card">
      <div className="section-card-header flex-wrap gap-2">
        <div>
          <div className="section-card-title">Planilha de Notas — {turma.name}</div>
          <div className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {getTermLabel(term)} · AEP, AL, AV, AG e Teste somam até 100 pontos; P.E. é somada à parte.
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={openConfiguration} className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Settings2 size={14} /> Configurar divisões
          </button>
          <button onClick={exportWorkbook} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold hover:opacity-80" style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30" style={{ backgroundColor: "hsl(var(--table-header))", minWidth: "16rem" }}>Aluno</th>
              {componentsByBlock.map((block) => (
                <th key={block.id} colSpan={block.components.length + 1} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>
                  {block.label} {block.maxPoints === null ? "(Pontos Extras)" : "(20 pts)"}
                </th>
              ))}
              <th rowSpan={2} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Nota regular / 100</th>
              <th rowSpan={2} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total com P.E.</th>
            </tr>
            <tr>
              {componentsByBlock.map((block) => (
                <Fragment key={block.id}>
                  {block.components.map((component) => (
                    <th key={component.id} className="sticky top-10 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))", minWidth: "9rem" }}>
                      <div>{component.name}</div>
                      <div className="text-[10px] font-normal opacity-75">{component.kind === "activities" ? `${formatPoints(component.maxPoints ?? 0)} pts · calculada` : component.maxPoints === null ? "sem limite" : `até ${formatPoints(component.maxPoints)} pts`}</div>
                    </th>
                  ))}
                  <th className="sticky top-10 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total {block.label}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={tableColumns} className="p-8 text-center text-sm">Nenhum aluno nesta turma.</td></tr>
            ) : students.map((student) => {
              const summary = gradesByStudent.get(student.id)!;
              return (
                <tr key={student.id}>
                  <td className="sticky left-0 z-10 whitespace-nowrap font-medium" style={{ backgroundColor: "hsl(var(--card))" }}>{student.name}</td>
                  {componentsByBlock.map((block) => (
                    <Fragment key={`${student.id}-${block.id}`}>
                      {block.components.map((component) => {
                        const score = scoreByStudentComponent.get(`${student.id}:${component.id}`);
                        return (
                          <td key={component.id} className="text-center">
                            {component.kind === "activities" ? (
                              <span className="font-semibold" title="Calculada pelos registros de atividades">
                                {formatPoints(summary.activitySummary.activityGrade)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={component.maxPoints ?? undefined}
                                step="0.01"
                                inputMode="decimal"
                                aria-label={`${student.name} — ${block.label} — ${component.name}`}
                                value={score ?? ""}
                                placeholder="—"
                                onChange={(event) => handleScoreChange(student.id, component, event.currentTarget.value)}
                                className="w-24 rounded border border-border bg-background px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center font-semibold">{formatPoints(summary.blockTotals[block.id])}</td>
                    </Fragment>
                  ))}
                  <td className="text-center font-bold" style={{ color: "hsl(var(--primary))" }}>{formatPoints(summary.baseTotal)} / 100</td>
                  <td className="text-center font-bold" style={{ color: "hsl(var(--primary))" }}>{formatPoints(summary.finalTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
