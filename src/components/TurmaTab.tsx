import { useState, useMemo, useEffect, useRef } from "react";
import { SchoolData, Turma, Activity, MinTask, ActivityRecord } from "@/types";
import { Plus, Trash2, CheckCircle, XCircle, CalendarPlus, Download, Search, X, ClipboardList, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { matchesAccentAware } from "@/lib/textSearch";
import { MinTaskCsvImportModal } from "@/components/MinTaskCsvImportModal";

type SubTab = "diario" | "tarefa-minima";
type DeadlineMode = "none" | "date" | "days";

interface Props {
  turma: Turma;
  data: SchoolData;
  addActivity: (turmaId: string, name: string, date: string, deadline?: string) => Activity;
  removeActivity: (id: string) => void;
  toggleAttendance: (studentId: string, date: string) => void;
  getAttendance: (studentId: string, date: string) => boolean | null;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecord: (studentId: string, activityId: string) => boolean | null;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
  toggleParticipation: (studentId: string, date: string) => void;
  toggleExtraPoint: (studentId: string, date: string) => void;
  getParticipation: (studentId: string, date: string) => boolean;
  getExtraPoint: (studentId: string, date: string) => boolean;
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
  getActivityRecordFull,
  setActivityOnTimeOverride,
  toggleParticipation,
  toggleExtraPoint,
  getParticipation,
  getExtraPoint,
  addMinTask,
  removeMinTask,
  setMinTaskRecord,
  getMinTaskRecord,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("diario");
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityDate, setNewActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>("none");
  const [newActivityDeadline, setNewActivityDeadline] = useState("");
  const [newActivityDeadlineDays, setNewActivityDeadlineDays] = useState(7);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [newMinTaskName, setNewMinTaskName] = useState("");
  const [newMinTaskDate, setNewMinTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newMinTaskTotal, setNewMinTaskTotal] = useState(20);
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [showMinTaskImportModal, setShowMinTaskImportModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; studentId: string; activityId: string } | null>(null);

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

  const computeDeadline = (): string | undefined => {
    if (deadlineMode === "date") return newActivityDeadline || undefined;
    if (deadlineMode === "days") {
      const base = new Date(`${newActivityDate}T00:00:00`);
      base.setDate(base.getDate() + (newActivityDeadlineDays || 0));
      return base.toISOString().slice(0, 10);
    }
    return undefined;
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim() || !newActivityDate) return;
    const deadline = computeDeadline();
    if (deadlineMode === "date" && !deadline) return;
    addActivity(turma.id, newActivityName.trim(), newActivityDate, deadline);
    setNewActivityName("");
    setNewActivityDeadline("");
  };

  const getActivityStatus = (
    studentId: string,
    activity: Activity
  ): "pending" | "on-time" | "late" => {
    const rec = getActivityRecordFull(studentId, activity.id);
    if (!rec || !rec.done) return "pending";
    if (!activity.deadline) return "on-time";
    if (rec.overrideOnTime) return "on-time";
    const markedAt = rec.markedAt ?? activity.date;
    return markedAt > activity.deadline ? "late" : "on-time";
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

  const exportCombinedExcel = () => {
    const headers = ["Aluno", "Chamada", "Participação", "Ponto Extra", ...dailyActivities.map((a) => a.name)];
    const rows = turmaStudents.map((s) => {
      const attendance = getAttendance(s.id, attendanceDate);
      const attendanceLabel = attendance === true ? "P" : attendance === false ? "F" : "";

      const participationLabel = getParticipation(s.id, attendanceDate) ? "Sim" : "";
      const extraPointLabel = getExtraPoint(s.id, attendanceDate) ? "Sim" : "";

      const activities = dailyActivities.map((a) => {
        const done = getActivityRecord(s.id, a.id);
        return done === true ? "Feito" : done === false ? "Pendente" : "";
      });

      return [s.name, attendanceLabel, participationLabel, extraPointLabel, ...activities];
    });

    const ws = XLSX.utils.aoa_to_sheet([[`Turma ${turma.name} - ${formatDate(attendanceDate)}`], [], headers, ...rows]);

    const allRows = [[`Turma ${turma.name} - ${formatDate(attendanceDate)}`], [], headers, ...rows];
    const columnCount = headers.length;
    const columnWidths = headers.map((header, colIdx) => {
      const longestCell = allRows.reduce((maxLength, row) => {
        const cellValue = row[colIdx];
        const cellText = cellValue == null ? "" : String(cellValue);
        return Math.max(maxLength, cellText.length);
      }, String(header).length);

      return { wch: Math.max(10, Math.min(40, longestCell + 2)) };
    });

    ws["!cols"] = columnWidths;

    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx += 1) {
      for (let colIdx = 1; colIdx < columnCount; colIdx += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        const cell = ws[address];
        if (!cell) continue;
        cell.s = {
          ...(cell.s || {}),
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Turma");
    XLSX.writeFile(wb, `turma_${turma.name}_${formatShort(attendanceDate).replace("/", "-")}.xlsx`);
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
            {allTurmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s)
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

      {/* Sub-tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border p-1 overflow-x-auto scrollbar-hide" style={{ backgroundColor: "hsl(var(--muted))", width: "fit-content", maxWidth: "100%" }}>
        <button
          onClick={() => setSubTab("diario")}
          className="flex items-center gap-1.5 rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all min-h-[40px] touch-manipulation whitespace-nowrap"
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
          className="flex items-center gap-1.5 rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all min-h-[40px] touch-manipulation whitespace-nowrap"
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
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80 min-h-[36px] touch-manipulation"
                style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
              >
                <Download size={12} /> Exportar Excel
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4">
              <input
                type="date"
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] touch-manipulation"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
              <span className="text-xs sm:text-sm font-medium">{formatDate(attendanceDate)}</span>
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
              <span className="section-card-title">Planilha da Turma — {formatDate(attendanceDate)}</span>
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
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Chamada</th>
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Participação</th>
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Ponto Extra</th>
                      {dailyActivities.map((a) => (
                        <th key={a.id} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>
                          <div className="flex flex-col items-center gap-0.5">
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
                    {turmaStudents.map((student) => {
                      const attendanceStatus = getAttendance(student.id, attendanceDate);
                      return (
                        <tr key={student.id}>
                          <td
                            className="font-medium whitespace-nowrap sticky-first-col sticky left-0 z-10"
                            style={{ width: studentNameColWidth, minWidth: studentNameColWidth }}
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
                          <td className="text-center">
                            <button
                              onClick={() => toggleParticipation(student.id, attendanceDate)}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
                              style={
                                getParticipation(student.id, attendanceDate)
                                  ? { backgroundColor: "#fef08a", color: "#854d0e", borderColor: "#fde047" }
                                  : {
                                      backgroundColor: "hsl(var(--secondary))",
                                      color: "hsl(var(--secondary-foreground))",
                                      borderColor: "hsl(var(--border))",
                                    }
                              }
                            >
                              {getParticipation(student.id, attendanceDate) ? "✓ Participou" : "Marcar"}
                            </button>
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => toggleExtraPoint(student.id, attendanceDate)}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
                              style={
                                getExtraPoint(student.id, attendanceDate)
                                  ? { backgroundColor: "#bbf7d0", color: "#166534", borderColor: "#86efac" }
                                  : {
                                      backgroundColor: "hsl(var(--secondary))",
                                      color: "hsl(var(--secondary-foreground))",
                                      borderColor: "hsl(var(--border))",
                                    }
                              }
                            >
                              {getExtraPoint(student.id, attendanceDate) ? "✓ Extra" : "Marcar"}
                            </button>
                          </td>
                          {dailyActivities.map((a) => {
                            const status = getActivityStatus(student.id, a);
                            const rec = getActivityRecordFull(student.id, a.id);
                            const isLate = status === "late";
                            const isOnTime = status === "on-time";
                            const tooltip = isLate
                              ? `Feito fora do prazo${rec?.markedAt ? ` (marcado em ${formatDate(rec.markedAt)}, prazo ${formatDate(a.deadline!)})` : ""} — clique direito para corrigir`
                              : isOnTime && rec?.overrideOnTime
                                ? "Marcado manualmente como no prazo — clique direito para reverter"
                                : isOnTime
                                  ? "Feito no prazo"
                                  : "Pendente";
                            return (
                              <td key={a.id} className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => toggleActivityRecord(student.id, a.id)}
                                    onContextMenu={(e) => {
                                      if (status === "pending") return;
                                      e.preventDefault();
                                      setContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        studentId: student.id,
                                        activityId: a.id,
                                      });
                                    }}
                                    title={tooltip}
                                    className={isOnTime ? "btn-toggle-done" : "btn-toggle-pending"}
                                    style={
                                      isLate
                                        ? {
                                            backgroundColor: "hsl(38 92% 90%)",
                                            color: "hsl(25 95% 30%)",
                                            borderColor: "hsl(38 92% 60%)",
                                            borderWidth: "1px",
                                            borderStyle: "solid",
                                          }
                                        : undefined
                                    }
                                  >
                                    {isLate ? (
                                      <span className="inline-flex items-center gap-1">
                                        <AlertTriangle size={10} /> Atrasado
                                      </span>
                                    ) : isOnTime ? (
                                      "✓ Feito"
                                    ) : (
                                      "✗ Pendente"
                                    )}
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
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {turmaMinTasks.length} tarefa(s) mínima(s)
                </span>
                <button
                  onClick={() => setShowMinTaskImportModal(true)}
                  className="rounded border border-border px-2 py-1 text-xs font-semibold hover:opacity-80"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Importar CSV
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[70vh]">
              {turmaStudents.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhum aluno nesta turma.
                </div>
              ) : turmaMinTasks.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhuma tarefa mínima cadastrada. Adicione uma acima.
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
                      {turmaMinTasks.map((t) => (
                        <th key={t.id} className="sticky top-0 z-20 text-center min-w-24" style={{ backgroundColor: "hsl(var(--table-header))" }}>
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
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total Feitas</th>
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total Possível</th>
                      <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turmaStudents.map((student) => {
                      const totalDone = turmaMinTasks.reduce((sum, t) => sum + getMinTaskRecord(student.id, t.id), 0);
                      const totalPossible = turmaMinTasks.reduce((sum, t) => sum + t.totalQuestions, 0);
                      const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : null;
                      return (
                        <tr key={student.id}>
                          <td
                            className="font-medium whitespace-nowrap sticky-first-col sticky left-0 z-10"
                            style={{ width: studentNameColWidth, minWidth: studentNameColWidth }}
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

      <MinTaskCsvImportModal
        open={showMinTaskImportModal}
        onClose={() => setShowMinTaskImportModal(false)}
        turma={turma}
        students={allTurmaStudents}
        minTasks={turmaMinTasks}
        setMinTaskRecord={setMinTaskRecord}
      />

      {contextMenu && (() => {
        const rec = getActivityRecordFull(contextMenu.studentId, contextMenu.activityId);
        const activity = data.activities.find((a) => a.id === contextMenu.activityId);
        const isCurrentlyOverridden = !!rec?.overrideOnTime;
        const markedAt = rec?.markedAt ?? activity?.date ?? "";
        const isActuallyLate = !!(activity?.deadline && markedAt > activity.deadline);
        return (
          <div
            className="fixed z-50 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 text-xs font-semibold border-b border-border" style={{ color: "hsl(var(--muted-foreground))" }}>
              Status da entrega
            </div>
            {isActuallyLate && !isCurrentlyOverridden && (
              <button
                className="block w-full text-left rounded px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, true);
                  setContextMenu(null);
                }}
              >
                ✓ Marcar como feito no prazo
              </button>
            )}
            {isCurrentlyOverridden && (
              <button
                className="block w-full text-left rounded px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setActivityOnTimeOverride(contextMenu.studentId, contextMenu.activityId, false);
                  setContextMenu(null);
                }}
              >
                ⟲ Reverter para "atrasado"
              </button>
            )}
            {!isActuallyLate && !isCurrentlyOverridden && (
              <div className="px-3 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Esta entrega está dentro do prazo.
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
