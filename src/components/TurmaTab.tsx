import { useState, useMemo, useEffect, useRef } from "react";
import { AcademicTerm, EvaluationComponent, SchoolData, Turma, Activity, ActivityRecord } from "@/types";
import { Plus, Trash2, CalendarPlus, Search, X, Pencil } from "lucide-react";
import { matchesAccentAware } from "@/lib/textSearch";
import { Gradebook } from "@/components/Gradebook";
import { ChartsSubpage } from "@/components/ChartsSubpage";
import {
  formatLocalDate,
  getTermActivities,
  getTermLabel,
  isActivityLate,
  type ActivityChanges,
} from "@/lib/academicTerms";

type DeadlineMode = "none" | "date" | "days";

interface Props {
  turma: Turma;
  data: SchoolData;
  selectedTerm: AcademicTerm;
  setStudentComponentScore: (studentId: string, componentId: string, score: number | null) => string | null;
  saveEvaluationConfiguration: (turmaId: string, term: AcademicTerm, components: EvaluationComponent[]) => string | null;
  addActivity: (turmaId: string, name: string, date: string, term: AcademicTerm, deadline?: string) => Activity;
  removeActivity: (id: string) => void;
  updateActivity: (id: string, changes: ActivityChanges) => void;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecord: (studentId: string, activityId: string) => boolean | null;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
}

export function TurmaTab({
  turma,
  data,
  selectedTerm,
  setStudentComponentScore,
  saveEvaluationConfiguration,
  addActivity,
  removeActivity,
  updateActivity,
  toggleActivityRecord,
  getActivityRecord,
  getActivityRecordFull,
  setActivityOnTimeOverride,
}: Props) {
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityDate, setNewActivityDate] = useState(() => formatLocalDate());
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>("none");
  const [newActivityDeadline, setNewActivityDeadline] = useState("");
  const [newActivityDeadlineDays, setNewActivityDeadlineDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; studentId: string; activityId: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");

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

  const focusAndSelectSearchInput = () => {
    setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 50);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        focusAndSelectSearchInput();
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  const allTurmaStudents = useMemo(
    () => data.students
      .filter((s) => s.turma === turma.name)
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        return studentSortOrder === "asc" ? comparison : -comparison;
      }),
    [data.students, turma.name, studentSortOrder]
  );

  const turmaStudents = useMemo(() => {
    if (!searchQuery.trim()) return allTurmaStudents;
    return allTurmaStudents.filter((s) => matchesAccentAware(s.name, searchQuery));
  }, [allTurmaStudents, searchQuery]);

  const studentNameColWidth = useMemo(() => {
    const longestName = turmaStudents.reduce((max, student) => Math.max(max, student.name.length), 0);
    const widthInCh = Math.max(16, Math.min(34, longestName + 2));
    return `${widthInCh}ch`;
  }, [turmaStudents]);

  const turmaActivities = useMemo(
    () => getTermActivities(data.activities, turma.id, selectedTerm),
    [data.activities, turma.id, selectedTerm]
  );

  const dailyActivities = useMemo(
    () => turmaActivities.filter((a) => a.date === selectedDate),
    [turmaActivities, selectedDate]
  );

  const computeDeadline = (): string | undefined => {
    if (deadlineMode === "date") return newActivityDeadline || undefined;
    if (deadlineMode === "days") {
      const base = new Date(`${newActivityDate}T00:00:00`);
      base.setDate(base.getDate() + (newActivityDeadlineDays || 0));
      return formatLocalDate(base);
    }
    return undefined;
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim() || !newActivityDate) return;
    const deadline = computeDeadline();
    if (deadlineMode === "date" && !deadline) return;
    addActivity(turma.id, newActivityName.trim(), newActivityDate, selectedTerm, deadline);
    setNewActivityName("");
    setNewActivityDeadline("");
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const formatShort = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  return (
    <div className="space-y-3 sm:space-y-4 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            {turma.name}
          </div>
          <span className="text-xs sm:text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {allTurmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s) · {getTermLabel(selectedTerm)}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => setStudentSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="rounded border border-border px-2 py-1.5 text-xs font-medium hover:opacity-80 min-h-[36px] touch-manipulation"
            style={{ color: "hsl(var(--muted-foreground))" }}
            title="Alternar ordem alfabética"
          >
            {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
          </button>
          {showSearch ? (
            <div className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 flex-1 sm:flex-none">
              <Search size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar aluno..."
                className="bg-transparent text-sm outline-none w-full sm:w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="text-xs mr-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {turmaStudents.length}/{allTurmaStudents.length}
                </span>
              )}
              <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="rounded p-1 hover:opacity-70 min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowSearch(true); focusAndSelectSearchInput(); }}
              className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:opacity-80 min-h-[36px] touch-manipulation"
              style={{ color: "hsl(var(--muted-foreground))" }}
              title="Pesquisar (Ctrl+F)"
            >
              <Search size={12} /> Pesquisar
            </button>
          )}
        </div>
      </div>

      <Gradebook
        turma={turma}
        term={selectedTerm}
        data={data}
        setStudentComponentScore={setStudentComponentScore}
        saveEvaluationConfiguration={saveEvaluationConfiguration}
        searchQuery={searchQuery}
      />

      <details className="section-card">
        <summary className="section-card-header cursor-pointer select-none">
          <span className="section-card-title">Gráficos e análises</span>
        </summary>
        <div className="p-3 sm:p-4">
          <ChartsSubpage data={data} selectedTerm={selectedTerm} filterTurma={turma.name} filterDateFrom="" filterDateTo="" />
        </div>
      </details>

      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Data da Turma</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4">
          <input
            type="date"
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] touch-manipulation"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <span className="text-xs sm:text-sm font-medium">{formatDate(selectedDate)}</span>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {dailyActivities.length} atividade(s) neste dia
          </span>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <CalendarPlus size={14} />
            Nova Atividade — {getTermLabel(selectedTerm)}
          </span>
        </div>
        <div className="p-4">
          <form onSubmit={handleAddActivity} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                className="flex-1 min-w-40 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome da atividade (ex: Prova 1, Lista 2...)"
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
              />
              <input
                type="date"
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={newActivityDate}
                onChange={(e) => setNewActivityDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                Prazo:
              </label>
              <select
                className="rounded border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={deadlineMode}
                onChange={(e) => setDeadlineMode(e.target.value as DeadlineMode)}
              >
                <option value="none">Sem prazo</option>
                <option value="date">Data específica</option>
                <option value="days">Dias após</option>
              </select>
              {deadlineMode === "date" && (
                <input
                  type="date"
                  min={newActivityDate}
                  className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={newActivityDeadline}
                  onChange={(e) => setNewActivityDeadline(e.target.value)}
                />
              )}
              {deadlineMode === "days" && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newActivityDeadlineDays}
                    onChange={(e) => setNewActivityDeadlineDays(parseInt(e.target.value) || 1)}
                  />
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>dia(s)</span>
                </div>
              )}
              {deadlineMode !== "none" && computeDeadline() && (
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  → {formatDate(computeDeadline()!)}
                </span>
              )}
              <button
                type="submit"
                disabled={
                  !newActivityName.trim() ||
                  !newActivityDate ||
                  (deadlineMode === "date" && !newActivityDeadline)
                }
                className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ml-auto"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Registros das Atividades — {formatDate(selectedDate)}</span>
        </div>
        <div className="overflow-auto max-h-[70vh]">
          {turmaStudents.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Nenhum aluno nesta turma. Cadastre alunos na aba "Cadastro".
            </div>
          ) : (
            <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30"
                    style={{ backgroundColor: "hsl(var(--table-header))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                  >
                    Aluno
                  </th>
                  {dailyActivities.map((a) => (
                    <th key={a.id} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center justify-center gap-1">
                          {a.name}
                          <button
                            onClick={() => {
                              const nextName = window.prompt("Nome da atividade", a.name);
                              if (nextName?.trim()) updateActivity(a.id, { name: nextName });
                            }}
                            className="ml-1 rounded-full p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            title="Renomear atividade"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Apagar a atividade “${a.name}” e seus registros de entrega?`)) removeActivity(a.id);
                            }}
                            className="ml-1 rounded-full p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            title="Remover atividade"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        {a.deadline && (
                          <span className="text-[10px] font-normal opacity-70" title={`Prazo: ${formatDate(a.deadline)}`}>
                            Prazo: {formatShort(a.deadline)}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {turmaStudents.map((student) => (
                  <tr key={student.id}>
                    <td
                      className="font-medium whitespace-nowrap sticky-first-col sticky left-0 z-10"
                      style={{ width: studentNameColWidth, minWidth: studentNameColWidth }}
                    >
                      {student.name}
                    </td>
                    {dailyActivities.map((a) => {
                      const status = getActivityRecord(student.id, a.id);
                       const rec = getActivityRecordFull(student.id, a.id);
                       const isDone = status === true;
                       const late = isActivityLate(a, rec);
                       const tooltip = isDone
                         ? `${late ? "Atrasado — vale 70%" : "Feito no prazo"}${rec?.markedAt ? ` — registrado em ${formatDate(rec.markedAt)}` : ""}`
                        : status === false
                          ? "Pendente"
                          : "Marcar";
                      return (
                        <td key={a.id} className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleActivityRecord(student.id, a.id)}
                              onContextMenu={(event) => {
                                if (!isDone) return;
                                event.preventDefault();
                                setContextMenu({ x: event.clientX, y: event.clientY, studentId: student.id, activityId: a.id });
                              }}
                              title={tooltip}
                              className={isDone && !late ? "btn-toggle-done" : "btn-toggle-pending"}
                            >
                              {late ? "⚠ Atrasado" : isDone ? "✓ Feito" : <><span className="text-destructive text-base font-bold">✗</span> Pendente</>}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {contextMenu && (() => {
        const activity = data.activities.find((item) => item.id === contextMenu.activityId);
        const record = getActivityRecordFull(contextMenu.studentId, contextMenu.activityId);
        if (!activity) return null;
        const markedAt = record?.markedAt ?? activity.date;
        const isActuallyLate = !!activity.deadline && markedAt > activity.deadline;
        const overridden = !!record?.overrideOnTime;
        return (
          <div
            className="fixed z-50 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Status da entrega</div>
            {!activity.deadline ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Esta atividade não possui prazo definido.</div>
            ) : isActuallyLate && !overridden ? (
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => { setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, true); setContextMenu(null); }}
              >
                Marcar como feito no prazo
              </button>
            ) : overridden ? (
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => { setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, false); setContextMenu(null); }}
              >
                Reverter para atrasado
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">Esta entrega está dentro do prazo.</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
