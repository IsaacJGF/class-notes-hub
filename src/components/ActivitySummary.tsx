import { useEffect, useMemo, useState } from "react";
import { Activity, ActivityRecord, AcademicTerm, SchoolData, Student, Turma } from "@/types";
import { AlertTriangle, ArrowRightLeft, CalendarDays, CheckCircle, Download, MoreHorizontal, Plus, Pencil, Trash2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ACADEMIC_TERMS,
  formatActivityExportResult,
  formatLocalDate,
  formatPoints,
  getActivityStatusLabel,
  getIndexedActivityRecord,
  getStudentExtraPoints,
  getStudentTermSummary,
  getTermActivities,
  getTermLabel,
  indexActivityRecords,
  isActivityLate,
  roundGrade,
  type ActivityChanges,
} from "@/lib/academicTerms";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DeadlineMode = "none" | "date" | "days";

interface Props {
  turma: Turma;
  term: AcademicTerm;
  data: SchoolData;
  students: Student[];
  activityMaximum: number;
  addActivity: (turmaId: string, name: string, date: string, term: AcademicTerm, deadline?: string) => Activity;
  updateActivity: (id: string, changes: ActivityChanges) => void;
  removeActivity: (id: string) => void;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
}

export function ActivitySummary({
  turma,
  term,
  data,
  students,
  activityMaximum,
  addActivity,
  updateActivity,
  removeActivity,
  toggleActivityRecord,
  getActivityRecordFull,
  setActivityOnTimeOverride,
}: Props) {
  const [activityName, setActivityName] = useState("");
  const [activityDate, setActivityDate] = useState(() => formatLocalDate());
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>("none");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [editingActivity, setEditingActivity] = useState<{ id: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; studentId: string; activityId: string } | null>(null);
  const [activityThreshold, setActivityThreshold] = useState(() => {
    const saved = localStorage.getItem("alert_activity_threshold");
    const value = saved ? Number(saved) : 50;
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  });

  const activities = useMemo(
    () => getTermActivities(data.activities, turma.id, term),
    [data.activities, turma.id, term],
  );
  const recordIndex = useMemo(() => indexActivityRecords(data.activityRecords), [data.activityRecords]);
  const summaries = useMemo(() => new Map(
    students.map((student) => [student.id, getStudentTermSummary(student.id, activities, recordIndex, activityMaximum)]),
  ), [students, activities, recordIndex, activityMaximum]);
  const extraPointsByStudent = useMemo(() => {
    const peComponentIds = new Set(data.evaluationComponents
      .filter((component) => component.turmaId === turma.id && component.term === term && component.blockId === "PE")
      .map((component) => component.id));
    return new Map(students.map((student) => {
      const componentScores = data.componentScores.filter((score) => score.studentId === student.id && peComponentIds.has(score.componentId));
      const total = componentScores.length
        ? componentScores.reduce((sum, score) => sum + score.score, 0)
        : getStudentExtraPoints(data.studentExtraPoints, student.id, term);
      return [student.id, { total: roundGrade(total), hasValue: componentScores.length > 0 || total > 0 }];
    }));
  }, [students, data.evaluationComponents, data.componentScores, data.studentExtraPoints, turma.id, term]);
  const alerts = useMemo(() => students
    .map((student) => ({ student, summary: summaries.get(student.id) }))
    .filter((item) => item.summary && item.summary.activityCount > 0 && item.summary.weightedPercentage < activityThreshold)
    .sort((a, b) => (a.summary?.weightedPercentage ?? 0) - (b.summary?.weightedPercentage ?? 0)),
  [students, summaries, activityThreshold]);
  const alertedStudentIds = useMemo(() => new Set(alerts.map((item) => item.student.id)), [alerts]);

  useEffect(() => {
    localStorage.setItem("alert_activity_threshold", String(activityThreshold));
  }, [activityThreshold]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const computeDeadline = (): string | undefined => {
    if (deadlineMode === "date") return deadlineDate || undefined;
    if (deadlineMode === "days") {
      const base = new Date(`${activityDate}T00:00:00`);
      base.setDate(base.getDate() + deadlineDays);
      return formatLocalDate(base);
    }
    return undefined;
  };

  const formatDate = (date: string) => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatShortDate = (date: string) => {
    const [, month, day] = date.split("-");
    return `${day}/${month}`;
  };

  const formatTooltipDate = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return date;
    const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short" })
      .format(new Date(year, month - 1, day))
      .replace(/\./g, "");
    return `${String(day).padStart(2, "0")} ${monthLabel} ${year}`;
  };

  const handleAddActivity = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activityName.trim() || !activityDate) return;
    const deadline = computeDeadline();
    if (deadlineMode === "date" && !deadline) return;
    addActivity(turma.id, activityName.trim(), activityDate, term, deadline);
    setActivityName("");
    setDeadlineDate("");
    toast.success("Atividade adicionada à turma.");
  };

  const exportActivitiesExcel = () => {
    const headers = [
      "Aluno",
      "No prazo",
      "Atrasadas (70%)",
      "Pendentes",
      "Aproveitamento (%)",
      "Nota AEP — Atividades",
      "Máximo AEP — Atividades",
      "Pontuação extra (P.E.)",
      ...activities.map((activity) => {
        const deadline = activity.deadline ? ` | prazo ${formatDate(activity.deadline)}` : "";
        return `${formatDate(activity.date)} — ${activity.name}${deadline}`;
      }),
    ];
    const rows = students.map((student) => {
      const summary = summaries.get(student.id)!;
      const extra = extraPointsByStudent.get(student.id)!;
      return [
        student.name,
        summary.onTime,
        summary.late,
        summary.pending,
        summary.weightedPercentage,
        summary.activityGrade,
        summary.totalPoints,
        extra.hasValue ? extra.total : "",
        ...activities.map((activity) => formatActivityExportResult(
          activity,
          getIndexedActivityRecord(recordIndex, student.id, activity.id),
          summary.activityValue,
        )),
      ];
    });
    const tableData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(tableData);
    sheet["!cols"] = headers.map((header, column) => {
      const maxLength = Math.max(String(header).length, ...rows.map((row) => String(row[column] ?? "").length));
      return { wch: Math.min(40, Math.max(column === 0 ? 24 : 12, maxLength + 2)) };
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Atividade");
    XLSX.writeFile(workbook, `atividade_${turma.name.replace(/\s+/g, "_")}_${term}o_trimestre.xlsx`);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Atividade</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{getTermLabel(term)} · {activities.length} atividade(s) · nota máxima {formatPoints(activityMaximum)} pontos</p>
        </div>
        <button
          onClick={exportActivitiesExcel}
          disabled={students.length === 0}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
        >
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      <form onSubmit={handleAddActivity} className="grid gap-3 border-b border-border bg-background p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] sm:items-end sm:p-4">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Nome da atividade</span>
          <input
            type="text"
            required
            placeholder="Ex.: Prova 1, Lista 2..."
            value={activityName}
            onChange={(event) => setActivityName(event.currentTarget.value)}
            className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Data</span>
          <input
            type="date"
            required
            value={activityDate}
            onChange={(event) => setActivityDate(event.currentTarget.value)}
            className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-3 sm:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">Prazo</span>
              <select
                value={deadlineMode}
                onChange={(event) => setDeadlineMode(event.currentTarget.value as DeadlineMode)}
                className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
              >
                <option value="none">Sem prazo</option>
                <option value="date">Data específica</option>
                <option value="days">Dias após a atividade</option>
              </select>
            </label>
            {deadlineMode === "date" && <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">Data limite</span>
              <input type="date" min={activityDate} required value={deadlineDate} onChange={(event) => setDeadlineDate(event.currentTarget.value)} className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm" />
            </label>}
            {deadlineMode === "days" && <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="number" min={1} value={deadlineDays} onChange={(event) => setDeadlineDays(Math.max(1, Number(event.currentTarget.value) || 1))} className="w-20 rounded-lg border border-input bg-card px-2 py-1.5 text-sm" />
              dia(s) após a data da atividade
            </label>}
            {deadlineMode !== "none" && computeDeadline() && <span className="pb-2 text-xs text-muted-foreground">Vence em {formatDate(computeDeadline()!)}</span>}
          </div>
          <button type="submit" disabled={!activityName.trim() || (deadlineMode === "date" && !deadlineDate)} className="flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45" style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
            <Plus size={15} /> Adicionar atividade
          </button>
        </div>
      </form>

      {alerts.length > 0 && <details className="border-b border-warning-border bg-warning-light/70">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold text-warning-foreground">
          <AlertTriangle size={15} /> {alerts.length} alerta(s) de aproveitamento
          <span className="ml-auto text-xs font-normal">Limite atual: {activityThreshold}%</span>
        </summary>
        <div className="flex flex-wrap items-end gap-4 border-t border-warning-border bg-card/70 px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Alertar abaixo de
            <input type="number" min={0} max={100} value={activityThreshold} onChange={(event) => setActivityThreshold(Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)))} className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
            %
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {alerts.map(({ student, summary }) => <span key={student.id} className="font-medium text-warning-foreground">{student.name} · {formatPoints(summary!.weightedPercentage)}%</span>)}
          </div>
        </div>
      </details>}

      {students.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado. Confira a pesquisa ou cadastre alunos para esta turma.</div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Ainda não há atividades neste trimestre. Cadastre a primeira acima.</div>
      ) : (
        <TooltipProvider delayDuration={180}>
        <div className="max-h-[70vh] overflow-auto">
          <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
            <thead><tr>
              <th className="sticky left-0 top-0 z-30" style={{ backgroundColor: "hsl(var(--table-header))", minWidth: "16rem" }}>Aluno</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>No prazo</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Atrasadas</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Pendentes</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>% Aproveitamento</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Nota da atividade</th>
              <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>P.E.</th>
              {activities.map((activity) => <th key={activity.id} className="sticky top-0 z-20 relative text-center" style={{ backgroundColor: "hsl(var(--table-header))", minWidth: "9rem" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="absolute right-0.5 top-0.5 z-10 rounded p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100" title={`Opções da atividade ${activity.name}`} aria-label={`Opções da atividade ${activity.name}`}><MoreHorizontal size={15} /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setEditingActivity({ id: activity.id, name: activity.name })}><Pencil size={14} className="mr-2" />Renomear atividade</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-medium">Mover para</DropdownMenuLabel>
                    {ACADEMIC_TERMS.filter((otherTerm) => otherTerm !== term).map((otherTerm) => <DropdownMenuItem key={otherTerm} onSelect={() => updateActivity(activity.id, { term: otherTerm })}><ArrowRightLeft size={14} className="mr-2" />{getTermLabel(otherTerm)}</DropdownMenuItem>)}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
                      if (window.confirm(`Apagar “${activity.name}” e todos os registros de entrega desta atividade?`)) removeActivity(activity.id);
                    }}><Trash2 size={14} className="mr-2" />Excluir atividade</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="px-3">
                  <div>{formatShortDate(activity.date)}</div>
                  <div className="whitespace-normal break-words text-xs leading-tight opacity-85" title={activity.name}>{activity.name}</div>
                  {activity.deadline && <div className="mt-1 text-[10px] font-normal opacity-75" title={`Prazo: ${formatDate(activity.deadline)}`}>Prazo: {formatShortDate(activity.deadline)}</div>}
                </div>
              </th>)}
            </tr></thead>
            <tbody>{students.map((student) => {
              const summary = summaries.get(student.id)!;
              const extra = extraPointsByStudent.get(student.id)!;
              const isAlerted = alertedStudentIds.has(student.id);
              return <tr key={student.id} style={isAlerted ? { backgroundColor: "hsl(var(--warning-light))" } : undefined}>
                <td className="sticky left-0 z-10 whitespace-nowrap font-medium" style={{ backgroundColor: isAlerted ? "hsl(var(--warning-light))" : "hsl(var(--card))", minWidth: "16rem" }}>
                  <span className="flex items-center gap-1.5">{isAlerted && <AlertTriangle size={13} className="shrink-0 text-warning" />}{student.name}</span>
                </td>
                <td className="text-center font-semibold" style={{ color: "hsl(var(--done))" }}>{summary.onTime}</td>
                <td className="text-center font-semibold" style={{ color: "hsl(var(--warning))" }}>{summary.late}</td>
                <td className="text-center font-semibold" style={{ color: "hsl(var(--not-done))" }}>{summary.pending}</td>
                <td className="text-center">{summary.activityCount > 0 ? <span className="rounded px-2 py-0.5 text-xs font-bold" style={summary.weightedPercentage >= activityThreshold ? { backgroundColor: "hsl(var(--done-light))", color: "hsl(var(--done))" } : { backgroundColor: "hsl(var(--not-done-light))", color: "hsl(var(--not-done))" }}>{formatPoints(summary.weightedPercentage)}%</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="text-center"><span className="font-bold text-primary">{formatPoints(summary.activityGrade)}</span><span className="ml-1 text-[10px] text-muted-foreground">/ {formatPoints(summary.totalPoints)}</span></td>
                <td className="text-center">{extra.hasValue ? <span className="font-medium">{formatPoints(extra.total)}</span> : <span className="text-muted-foreground">—</span>}</td>
                {activities.map((activity) => {
                  const record = getIndexedActivityRecord(recordIndex, student.id, activity.id);
                  const isDone = record?.done === true;
                  const late = isActivityLate(activity, record);
                  const statusLabel = late ? "Atrasada" : isDone ? "No prazo" : "Pendente";
                  const StatusIcon = late ? AlertTriangle : isDone ? CheckCircle : XCircle;
                  return <td key={activity.id} className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleActivityRecord(student.id, activity.id)}
                          onContextMenu={(event) => {
                            if (!isDone) return;
                            event.preventDefault();
                            setContextMenu({ x: event.clientX, y: event.clientY, studentId: student.id, activityId: activity.id });
                          }}
                          aria-label={`${student.name}: ${activity.name} — ${getActivityStatusLabel(activity, record)}`}
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-muted"
                        >
                          <StatusIcon
                            size={17}
                            style={{ color: late ? "hsl(32 55% 46%)" : isDone ? "hsl(var(--present))" : "hsl(var(--absent))" }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="center" className="whitespace-nowrap">
                        <TooltipArrow className="fill-[#F8FAFC] stroke-[#DCE5EF]" />
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold ${late ? "bg-[#FEF3C7] text-[#92400E]" : isDone ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
                            <StatusIcon size={16} aria-hidden="true" />
                            {statusLabel}
                          </span>
                          <span aria-hidden="true" className="h-8 w-px shrink-0 bg-[#DCE5EF]" />
                          <span className="flex items-center gap-2">
                            <CalendarDays size={17} className="shrink-0 text-[#64748B]" aria-hidden="true" />
                            {isDone && record?.markedAt ? (
                              <span><span>Registrada em </span><strong className="font-semibold">{formatTooltipDate(record.markedAt)}</strong></span>
                            ) : activity.deadline ? (
                              <span><span>Prazo até </span><strong className="font-semibold">{formatTooltipDate(activity.deadline)}</strong></span>
                            ) : (
                              <span>Sem registro de entrega</span>
                            )}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </td>;
                })}
              </tr>;
            })}</tbody>
          </table>
        </div>
        </TooltipProvider>
      )}

      {contextMenu && (() => {
        const activity = data.activities.find((item) => item.id === contextMenu.activityId);
        const record = getActivityRecordFull(contextMenu.studentId, contextMenu.activityId);
        if (!activity) return null;
        const markedAt = record?.markedAt ?? activity.date;
        const actuallyLate = !!activity.deadline && markedAt > activity.deadline;
        const overridden = !!record?.overrideOnTime;
        return <div className="fixed z-50 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-lg" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(event) => event.stopPropagation()}>
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Status da entrega</div>
          {!activity.deadline ? <div className="px-3 py-2 text-xs text-muted-foreground">Esta atividade não possui prazo definido.</div>
            : actuallyLate && !overridden ? <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, true); setContextMenu(null); }}>Marcar como feita no prazo</button>
              : overridden ? <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, false); setContextMenu(null); }}>Reverter para atrasada</button>
                : <div className="px-3 py-2 text-xs text-muted-foreground">Esta entrega está dentro do prazo.</div>}
        </div>;
      })()}

      <Dialog open={editingActivity !== null} onOpenChange={(open) => { if (!open) setEditingActivity(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Renomear atividade</DialogTitle><DialogDescription>A data, o prazo e os registros dos alunos serão preservados.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (!editingActivity?.name.trim()) return;
            updateActivity(editingActivity.id, { name: editingActivity.name });
            setEditingActivity(null);
          }}>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Nome da atividade</span><input autoFocus required value={editingActivity?.name ?? ""} onChange={(event) => setEditingActivity((current) => current ? { ...current, name: event.currentTarget.value } : null)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <DialogFooter><button type="button" onClick={() => setEditingActivity(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={!editingActivity?.name.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>Salvar</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
