import { useState, useMemo, useEffect, useRef } from "react";
import { SchoolData, Turma, Activity, MinTask } from "@/types";
import { Plus, Trash2, CheckCircle, XCircle, CalendarPlus, Download, Star, Search, X, ClipboardList } from "lucide-react";
import * as XLSX from "xlsx";

type SubTab = "diario" | "tarefa-minima";

interface Props {
  turma: Turma;
  data: SchoolData;
  addActivity: (turmaId: string, name: string, date: string) => Activity;
  removeActivity: (id: string) => void;
  toggleAttendance: (studentId: string, date: string) => void;
  getAttendance: (studentId: string, date: string) => boolean | null;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecord: (studentId: string, activityId: string) => boolean | null;
  cycleActivityBonusTag: (studentId: string, activityId: string) => void;
  getActivityBonusTag: (studentId: string, activityId: string) => "yellow" | "green" | null;
  addMinTask: (turmaId: string, name: string, date: string, totalQuestions: number) => MinTask;
  removeMinTask: (id: string) => void;
  setMinTaskRecord: (studentId: string, minTaskId: string, questionsDone: number) => void;
  getMinTaskRecord: (studentId: string, minTaskId: string) => number;
}

export function TurmaTab({
  turma,
  data,
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
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("diario");
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityDate, setNewActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [newMinTaskName, setNewMinTaskName] = useState("");
  const [newMinTaskDate, setNewMinTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newMinTaskTotal, setNewMinTaskTotal] = useState(20);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
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
    () => data.students.filter((s) => s.turma === turma.name).sort((a, b) => a.name.localeCompare(b.name)),
    [data.students, turma.name]
  );

  const turmaStudents = useMemo(() => {
    if (!searchQuery.trim()) return allTurmaStudents;
    const q = searchQuery.toLowerCase();
    return allTurmaStudents.filter((s) => s.name.toLowerCase().includes(q));
  }, [allTurmaStudents, searchQuery]);

  const turmaActivities = useMemo(
    () => data.activities.filter((a) => a.turmaId === turma.id).sort((a, b) => a.date.localeCompare(b.date)),
    [data.activities, turma.id]
  );

  const dailyActivities = useMemo(
    () => turmaActivities.filter((a) => a.date === attendanceDate),
    [turmaActivities, attendanceDate]
  );

  const turmaMinTasks = useMemo(
    () => (data.minTasks || []).filter((t) => t.turmaId === turma.id).sort((a, b) => a.date.localeCompare(b.date)),
    [data.minTasks, turma.id]
  );

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim() || !newActivityDate) return;
    addActivity(turma.id, newActivityName.trim(), newActivityDate);
    setNewActivityName("");
  };

  const handleAddMinTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMinTaskName.trim() || !newMinTaskDate || newMinTaskTotal <= 0) return;
    addMinTask(turma.id, newMinTaskName.trim(), newMinTaskDate, newMinTaskTotal);
    setNewMinTaskName("");
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const formatShort = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const getAttendanceSummaryForDate = (date: string) => {
    const present = turmaStudents.filter((s) => getAttendance(s.id, date) === true).length;
    return { present, total: turmaStudents.length };
  };

  const bonusInfo = (tag: "yellow" | "green" | null) => {
    if (tag === "yellow") {
      return {
        label: "Extra: Amarelo",
        style: { backgroundColor: "#fef08a", color: "#854d0e", borderColor: "#fde047" },
        cellStyle: { backgroundColor: "#fefce8" },
      };
    }
    if (tag === "green") {
      return {
        label: "Extra: Verde",
        style: { backgroundColor: "#bbf7d0", color: "#166534", borderColor: "#86efac" },
        cellStyle: { backgroundColor: "#f0fdf4" },
      };
    }
    return {
      label: "Marcar Extra",
      style: {
        backgroundColor: "hsl(var(--secondary))",
        color: "hsl(var(--secondary-foreground))",
        borderColor: "hsl(var(--border))",
      },
      cellStyle: {},
    };
  };

  const exportCombinedExcel = () => {
    const headers = ["Aluno", "Chamada", ...dailyActivities.map((a) => a.name)];
    const rows = turmaStudents.map((s) => {
      const attendance = getAttendance(s.id, attendanceDate);
      const attendanceLabel = attendance === true ? "P" : attendance === false ? "F" : "";

      const activities = dailyActivities.map((a) => {
        const done = getActivityRecord(s.id, a.id);
        const tag = getActivityBonusTag(s.id, a.id);
        const doneLabel = done === true ? "Feito" : done === false ? "Pendente" : "";
        const bonusLabel = tag === "yellow" ? " (Extra Amarelo)" : tag === "green" ? " (Extra Verde)" : "";
        return `${doneLabel}${bonusLabel}`.trim();
      });

      return [s.name, attendanceLabel, ...activities];
    });

    const ws = XLSX.utils.aoa_to_sheet([[`Turma ${turma.name} - ${formatDate(attendanceDate)}`], [], headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Turma");
    XLSX.writeFile(wb, `turma_${turma.name}_${formatShort(attendanceDate).replace("/", "-")}.xlsx`);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {turma.name}
        </div>
        <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          {allTurmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s)
        </span>
        <div className="ml-auto flex items-center gap-2">
          {showSearch ? (
            <div className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1">
              <Search size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar aluno..."
                className="bg-transparent text-sm outline-none w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="text-xs mr-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {turmaStudents.length}/{allTurmaStudents.length}
                </span>
              )}
              <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="rounded p-0.5 hover:opacity-70">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:opacity-80"
              style={{ color: "hsl(var(--muted-foreground))" }}
              title="Pesquisar (Ctrl+F)"
            >
              <Search size={12} /> Pesquisar
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border p-1" style={{ backgroundColor: "hsl(var(--muted))", width: "fit-content" }}>
        <button
          onClick={() => setSubTab("diario")}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all"
          style={
            subTab === "diario"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { color: "hsl(var(--muted-foreground))" }
          }
        >
          <CalendarPlus size={14} /> Diário
        </button>
        <button
          onClick={() => setSubTab("tarefa-minima")}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all"
          style={
            subTab === "tarefa-minima"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { color: "hsl(var(--muted-foreground))" }
          }
        >
          <ClipboardList size={14} /> Tarefa Mínima
        </button>
      </div>

      {/* ── DIÁRIO ── */}
      {subTab === "diario" && (
        <>
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Data da Turma (Chamada + Atividades)</span>
              <button
                onClick={exportCombinedExcel}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
              >
                <Download size={12} /> Exportar Excel
              </button>
            </div>
            <div className="flex items-center gap-3 p-4">
              <input
                type="date"
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
              <span className="text-sm font-medium">{formatDate(attendanceDate)}</span>
              {turmaStudents.length > 0 && (
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {getAttendanceSummaryForDate(attendanceDate).present}/{turmaStudents.length} presentes
                </span>
              )}
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {dailyActivities.length} atividade(s) neste dia
              </span>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <CalendarPlus size={14} />
                Nova Atividade
              </span>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddActivity} className="flex flex-wrap gap-2">
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
                <button
                  type="submit"
                  disabled={!newActivityName.trim() || !newActivityDate}
                  className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </form>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Planilha da Turma — {formatDate(attendanceDate)}</span>
            </div>
            <div className="overflow-x-auto">
              {turmaStudents.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhum aluno nesta turma. Cadastre alunos na aba "Cadastro".
                </div>
              ) : (
                <table className="school-table" style={{ minWidth: "max-content" }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>#</th>
                      <th className="sticky left-8 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>Aluno</th>
                      <th className="text-center">Chamada</th>
                      {dailyActivities.map((a) => (
                        <th key={a.id} className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {a.name}
                            <button
                              onClick={() => removeActivity(a.id)}
                              className="ml-1 rounded-full p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                              title="Remover atividade"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {turmaStudents.map((student, idx) => {
                      const attendanceStatus = getAttendance(student.id, attendanceDate);
                      return (
                        <tr key={student.id}>
                          <td
                            className="text-xs sticky left-0 z-10"
                            style={{ color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--card))" }}
                          >
                            {idx + 1}
                          </td>
                          <td
                            className="font-medium whitespace-nowrap sticky left-8 z-10"
                            style={{ backgroundColor: "hsl(var(--card))" }}
                          >
                            {student.name}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {attendanceStatus === true && <span className="badge-present"><CheckCircle size={12} /> Presente</span>}
                              {attendanceStatus === false && <span className="badge-absent"><XCircle size={12} /> Falta</span>}
                              {attendanceStatus === null && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>—</span>}
                              <button
                                onClick={() => toggleAttendance(student.id, attendanceDate)}
                                className={attendanceStatus === true ? "btn-toggle-present" : attendanceStatus === false ? "btn-toggle-absent" : "btn-toggle-pending"}
                              >
                                {attendanceStatus === true ? "✓" : attendanceStatus === false ? "✗" : "Marcar"}
                              </button>
                            </div>
                          </td>
                          {dailyActivities.map((a) => {
                            const done = getActivityRecord(student.id, a.id);
                            const tag = getActivityBonusTag(student.id, a.id);
                            const visual = bonusInfo(tag);
                            return (
                              <td key={a.id} className="text-center" style={visual.cellStyle}>
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => toggleActivityRecord(student.id, a.id)}
                                    className={done === true ? "btn-toggle-done" : "btn-toggle-pending"}
                                  >
                                    {done === true ? "✓ Feito" : done === false ? "✗ Pendente" : "Marcar"}
                                  </button>
                                  <button
                                    onClick={() => cycleActivityBonusTag(student.id, a.id)}
                                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
                                    style={visual.style}
                                    title="Alternar pontuação extra: sem marcação, amarelo e verde"
                                  >
                                    <Star size={11} /> {visual.label}
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAREFA MÍNIMA ── */}
      {subTab === "tarefa-minima" && (
        <>
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <ClipboardList size={14} />
                Nova Tarefa Mínima
              </span>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddMinTask} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  className="flex-1 min-w-40 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Nome (ex: TM Semana 1, TM Cap. 3...)"
                  value={newMinTaskName}
                  onChange={(e) => setNewMinTaskName(e.target.value)}
                />
                <input
                  type="date"
                  className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={newMinTaskDate}
                  onChange={(e) => setNewMinTaskDate(e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Total:</label>
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newMinTaskTotal}
                    onChange={(e) => setNewMinTaskTotal(parseInt(e.target.value) || 1)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMinTaskName.trim() || !newMinTaskDate || newMinTaskTotal <= 0}
                  className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </form>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Planilha de Tarefas Mínimas</span>
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {turmaMinTasks.length} tarefa(s) mínima(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              {turmaStudents.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhum aluno nesta turma.
                </div>
              ) : turmaMinTasks.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhuma tarefa mínima cadastrada. Adicione uma acima.
                </div>
              ) : (
                <table className="school-table" style={{ minWidth: "max-content" }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>#</th>
                      <th className="sticky left-8 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>Aluno</th>
                      {turmaMinTasks.map((t) => (
                        <th key={t.id} className="text-center min-w-24">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <span>{t.name}</span>
                              <button
                                onClick={() => removeMinTask(t.id)}
                                className="ml-1 rounded-full p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                                title="Remover tarefa mínima"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                            <span className="text-xs opacity-70">{formatShort(t.date)} · {t.totalQuestions}q</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-center">Total Feitas</th>
                      <th className="text-center">Total Possível</th>
                      <th className="text-center">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turmaStudents.map((student, idx) => {
                      const totalDone = turmaMinTasks.reduce((sum, t) => sum + getMinTaskRecord(student.id, t.id), 0);
                      const totalPossible = turmaMinTasks.reduce((sum, t) => sum + t.totalQuestions, 0);
                      const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : null;
                      return (
                        <tr key={student.id}>
                          <td
                            className="text-xs sticky left-0 z-10"
                            style={{ color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--card))" }}
                          >
                            {idx + 1}
                          </td>
                          <td
                            className="font-medium whitespace-nowrap sticky left-8 z-10"
                            style={{ backgroundColor: "hsl(var(--card))" }}
                          >
                            {student.name}
                          </td>
                          {turmaMinTasks.map((t) => {
                            const done = getMinTaskRecord(student.id, t.id);
                            return (
                              <td key={t.id} className="text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={t.totalQuestions}
                                  value={done}
                                  onChange={(e) => {
                                    const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), t.totalQuestions);
                                    setMinTaskRecord(student.id, t.id, val);
                                  }}
                                  className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <span className="text-xs ml-1" style={{ color: "hsl(var(--muted-foreground))" }}>/{t.totalQuestions}</span>
                              </td>
                            );
                          })}
                          <td className="text-center font-semibold">{totalDone}</td>
                          <td className="text-center" style={{ color: "hsl(var(--muted-foreground))" }}>{totalPossible}</td>
                          <td className="text-center">
                            {pct !== null ? (
                              <span
                                className="rounded px-2 py-0.5 text-xs font-bold"
                                style={
                                  pct >= 75
                                    ? { backgroundColor: "hsl(var(--done-light, 142 76% 94%))", color: "hsl(var(--done, 142 76% 36%))" }
                                    : { backgroundColor: "hsl(var(--not-done-light, 0 84% 94%))", color: "hsl(var(--not-done, 0 84% 60%))" }
                                }
                              >
                                {pct}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
