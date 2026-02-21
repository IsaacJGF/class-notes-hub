import { useState, useMemo, useEffect, useRef } from "react";
import { SchoolData } from "@/types";
import { CheckCircle, XCircle, Circle, Download, BarChart2, TableIcon, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import { ChartsSubpage } from "@/components/ChartsSubpage";

interface Props {
  data: SchoolData;
}

type MainView = "tabelas" | "graficos";

export function SummaryTab({ data }: Props) {
  const [mainView, setMainView] = useState<MainView>("tabelas");
  const [filterTurma, setFilterTurma] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [activeView, setActiveView] = useState<"attendance" | "activities" | "mintasks">("attendance");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const allFilteredStudents = useMemo(() => {
    if (filterTurma === "all") return data.students;
    return data.students.filter((s) => s.turma === filterTurma);
  }, [data.students, filterTurma]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allFilteredStudents;
    const q = searchQuery.toLowerCase();
    return allFilteredStudents.filter((s) => s.name.toLowerCase().includes(q));
  }, [allFilteredStudents, searchQuery]);

  const studentNameColWidth = useMemo(() => {
    const longestName = filteredStudents.reduce((max, student) => Math.max(max, student.name.length), 0);
    const widthInCh = Math.max(16, Math.min(34, longestName + 2));
    return `${widthInCh}ch`;
  }, [filteredStudents]);

  const attendanceDates = useMemo(() => {
    let dates = Array.from(new Set(data.attendanceRecords.map((r) => r.date))).sort();
    if (filterDateFrom) dates = dates.filter((d) => d >= filterDateFrom);
    if (filterDateTo) dates = dates.filter((d) => d <= filterDateTo);
    return dates;
  }, [data.attendanceRecords, filterDateFrom, filterDateTo]);

  const filteredActivities = useMemo(() => {
    let acts = data.activities;
    if (filterTurma !== "all") {
      const turma = data.turmas.find((t) => t.name === filterTurma);
      if (turma) acts = acts.filter((a) => a.turmaId === turma.id);
    }
    if (filterDateFrom) acts = acts.filter((a) => a.date >= filterDateFrom);
    if (filterDateTo) acts = acts.filter((a) => a.date <= filterDateTo);
    return acts.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.activities, data.turmas, filterTurma, filterDateFrom, filterDateTo]);

  const getClassDatesForStudent = (studentId: string, turmaName: string) => {
    const turma = data.turmas.find((t) => t.name === turmaName);
    if (!turma) return [] as string[];

    const attendanceDatesForStudent = data.attendanceRecords
      .filter((r) => r.studentId === studentId)
      .map((r) => r.date);

    const activityDatesForTurma = data.activities
      .filter((a) => a.turmaId === turma.id)
      .map((a) => a.date);

    const classRecordDatesForStudent = (data.classRecords || [])
      .filter((r) => r.studentId === studentId)
      .map((r) => r.date);

    let dates = Array.from(new Set([...attendanceDatesForStudent, ...activityDatesForTurma, ...classRecordDatesForStudent])).sort();
    if (filterDateFrom) dates = dates.filter((d) => d >= filterDateFrom);
    if (filterDateTo) dates = dates.filter((d) => d <= filterDateTo);
    return dates;
  };

  const getAttendanceStatus = (studentId: string, date: string) => {
    const record = data.attendanceRecords.find(
      (r) => r.studentId === studentId && r.date === date
    );
    if (!record) return null;
    return record.present;
  };

  const getActivityStatus = (studentId: string, activityId: string) => {
    const record = data.activityRecords.find(
      (r) => r.studentId === studentId && r.activityId === activityId
    );
    if (!record) return null;
    return record.done;
  };

  const getAttendanceSummary = (studentId: string) => {
    const relevant = data.attendanceRecords.filter((r) => {
      if (r.studentId !== studentId) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      return true;
    });
    const present = relevant.filter((r) => r.present).length;
    const total = attendanceDates.length;
    return { present, total };
  };

  const getParticipationCount = (studentId: string) => {
    return (data.classRecords || []).filter((r) => {
      if (r.studentId !== studentId) return false;
      if (!r.participated) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      return true;
    }).length;
  };

  const getExtraPointCount = (studentId: string) => {
    return (data.classRecords || []).filter((r) => {
      if (r.studentId !== studentId) return false;
      if (!r.extraPoint) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      return true;
    }).length;
  };

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const getColumnWidths = (tableData: Array<Array<string | number>>) => {
    const columnCount = tableData[0]?.length ?? 0;

    return Array.from({ length: columnCount }, (_, colIdx) => {
      const longestCell = tableData.reduce((maxLength, row) => {
        const cellValue = row[colIdx];
        const cellText = cellValue == null ? "" : String(cellValue);
        return Math.max(maxLength, cellText.length);
      }, 0);

      return { wch: Math.max(10, Math.min(40, longestCell + 2)) };
    });
  };

  const centerColumnsExceptStudent = (ws: XLSX.WorkSheet, tableData: Array<Array<string | number>>) => {
    const rowCount = tableData.length;
    const columnCount = tableData[0]?.length ?? 0;

    for (let rowIdx = 0; rowIdx < rowCount; rowIdx += 1) {
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
  };

  // ---- Export Excel ----
  const exportAttendanceExcel = () => {
    const headers = ["Aluno", "Turma", "Presença", "Faltas", "% Presença", "Participações", "Part./Aulas", "Pontos Extra", ...attendanceDates.map(formatDate)];
    const rows = filteredStudents.map((student) => {
      const { present, total } = getAttendanceSummary(student.id);
      const classDatesForStudent = getClassDatesForStudent(student.id, student.turma);
      const participationCount = getParticipationCount(student.id);
      const extraPointCount = getExtraPointCount(student.id);
      const pct = total > 0 ? Math.round((present / total) * 100) : "";
      const dateColumns = attendanceDates.map((d) => {
        const s = getAttendanceStatus(student.id, d);
        return s === true ? "P" : s === false ? "F" : "";
      });
      return [
        student.name,
        student.turma,
        present,
        total - present,
        pct !== "" ? `${pct}%` : "",
        participationCount,
        `${participationCount}/${classDatesForStudent.length}`,
        extraPointCount,
        ...dateColumns,
      ];
    });
    const tableData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    ws["!cols"] = getColumnWidths(tableData);
    centerColumnsExceptStudent(ws, tableData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chamada");
    XLSX.writeFile(wb, "resumo_chamada.xlsx");
  };

  const exportActivitiesExcel = () => {
    const headers = [
      "Aluno", "Turma", "Entregues", "Pendentes", "% Entrega",
      ...filteredActivities.map((a) => `${formatDate(a.date)} - ${a.name}`),
    ];
    const rows = filteredStudents.map((student) => {
      const studentActivities = filteredActivities.filter((a) => {
        const turma = data.turmas.find((t) => t.name === student.turma);
        return turma?.id === a.turmaId;
      });
      const done = studentActivities.filter((a) => {
        const r = data.activityRecords.find(
          (r) => r.studentId === student.id && r.activityId === a.id
        );
        return r?.done;
      }).length;
      const total = studentActivities.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : "";
      const actColumns = filteredActivities.map((a) => {
        const turma = data.turmas.find((t) => t.name === student.turma);
        if (turma?.id !== a.turmaId) return "—";
        const s = getActivityStatus(student.id, a.id);
        return s === true ? "Feito" : s === false ? "Pendente" : "";
      });
      return [student.name, student.turma, done, total - done, pct !== "" ? `${pct}%` : "", ...actColumns];
    });
    const tableData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    ws["!cols"] = getColumnWidths(tableData);
    centerColumnsExceptStudent(ws, tableData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atividades");
    XLSX.writeFile(wb, "resumo_atividades.xlsx");
  };

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Filtros</span>
        </div>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              Turma
            </label>
            <select
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterTurma}
              onChange={(e) => setFilterTurma(e.target.value)}
            >
              <option value="all">Todas as turmas</option>
              {data.turmas.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              Data inicial
            </label>
            <input
              type="date"
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              Data final
            </label>
            <input
              type="date"
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterTurma("all"); }}
            className="rounded border border-border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Search + Main sub-nav */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-border p-1" style={{ backgroundColor: "hsl(var(--muted))", width: "fit-content" }}>
        <button
          onClick={() => setMainView("tabelas")}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all"
          style={
            mainView === "tabelas"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { color: "hsl(var(--muted-foreground))" }
          }
        >
          <TableIcon size={14} /> Tabelas
        </button>
        <button
          onClick={() => setMainView("graficos")}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all"
          style={
            mainView === "graficos"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { color: "hsl(var(--muted-foreground))" }
          }
        >
          <BarChart2 size={14} /> Gráficos
        </button>
        </div>
        <div className="ml-auto">
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
                  {filteredStudents.length}/{allFilteredStudents.length}
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

      {/* ── TABELAS ── */}
      {mainView === "tabelas" && (
        <>
          {/* Toggle View */}
          <div className="flex gap-2">
             <button
              onClick={() => setActiveView("attendance")}
              className="rounded px-4 py-2 text-sm font-semibold transition-colors"
              style={
                activeView === "attendance"
                  ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                  : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }
              }
            >
              Chamada
            </button>
            <button
              onClick={() => setActiveView("activities")}
              className="rounded px-4 py-2 text-sm font-semibold transition-colors"
              style={
                activeView === "activities"
                  ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                  : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }
              }
            >
              Atividades
            </button>
            <button
              onClick={() => setActiveView("mintasks")}
              className="rounded px-4 py-2 text-sm font-semibold transition-colors"
              style={
                activeView === "mintasks"
                  ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                  : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }
              }
            >
              Tarefa Mínima
            </button>
          </div>

          {/* Attendance Summary Table */}
          {activeView === "attendance" && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Resumo de Chamada</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {attendanceDates.length} aula(s) no período
                  </span>
                  <button
                    onClick={exportAttendanceExcel}
                    className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
                  >
                    <Download size={12} /> Exportar Excel
                  </button>
                </div>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Nenhum aluno encontrado.
                  </div>
                ) : (
                  <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-0 z-30" style={{ backgroundColor: "hsl(var(--table-header))", width: studentNameColWidth, minWidth: studentNameColWidth }}>Aluno</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Turma</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Presença</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Faltas</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>% Presença</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Participações</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Part./Aulas</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Pontos Extra</th>
                        {attendanceDates.map((d) => (
                          <th key={d} className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>{formatDate(d)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => {
                        const { present, total } = getAttendanceSummary(student.id);
                        const pct = total > 0 ? Math.round((present / total) * 100) : null;
                        return (
                          <tr key={student.id}>
                            <td
                              className="font-medium whitespace-nowrap sticky left-0 z-10"
                              style={{ backgroundColor: "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                            >
                              {student.name}
                            </td>
                            <td>
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
                              >
                                {student.turma}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: "hsl(var(--present))" }} className="font-semibold">{present}</span>
                            </td>
                            <td>
                              <span style={{ color: "hsl(var(--absent))" }} className="font-semibold">{total - present}</span>
                            </td>
                            <td>
                              {pct !== null ? (
                                <span
                                  className="rounded px-2 py-0.5 text-xs font-bold"
                                  style={
                                    pct >= 75
                                      ? { backgroundColor: "hsl(var(--present-light))", color: "hsl(var(--present))" }
                                      : { backgroundColor: "hsl(var(--absent-light))", color: "hsl(var(--absent))" }
                                  }
                                >
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>—</span>
                              )}
                            </td>
                            <td className="text-center font-semibold" style={{ color: "#854d0e" }}>{getParticipationCount(student.id)}</td>
                            <td className="text-center text-sm">{getParticipationCount(student.id)}/{getClassDatesForStudent(student.id, student.turma).length}</td>
                            <td className="text-center font-semibold" style={{ color: "#166534" }}>{getExtraPointCount(student.id)}</td>
                            {attendanceDates.map((d) => {
                              const status = getAttendanceStatus(student.id, d);
                              return (
                                <td key={d} className="text-center">
                                  {status === true && <CheckCircle size={16} style={{ color: "hsl(var(--present))" }} className="mx-auto" />}
                                  {status === false && <XCircle size={16} style={{ color: "hsl(var(--absent))" }} className="mx-auto" />}
                                  {status === null && <Circle size={14} className="mx-auto opacity-20" />}
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
          )}

          {/* Activity Summary Table */}
          {activeView === "activities" && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Resumo de Atividades</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {filteredActivities.length} atividade(s) no período
                  </span>
                  <button
                    onClick={exportActivitiesExcel}
                    className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
                  >
                    <Download size={12} /> Exportar Excel
                  </button>
                </div>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Nenhum aluno encontrado.
                  </div>
                ) : (
                  <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-0 z-30" style={{ backgroundColor: "hsl(var(--table-header))", width: studentNameColWidth, minWidth: studentNameColWidth }}>Aluno</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Turma</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Entregues</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Pendentes</th>
                        <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>% Entrega</th>
                        {filteredActivities.map((a) => (
                          <th key={a.id} className="sticky top-0 z-20 text-center min-w-16" style={{ backgroundColor: "hsl(var(--table-header))" }}>
                            <div>{formatDate(a.date)}</div>
                            <div className="truncate max-w-16 text-xs opacity-80" title={a.name}>{a.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => {
                        const studentActivities = filteredActivities.filter((a) => {
                          const turma = data.turmas.find((t) => t.name === student.turma);
                          return turma?.id === a.turmaId;
                        });
                        const done = studentActivities.filter((a) => {
                          const r = data.activityRecords.find(
                            (r) => r.studentId === student.id && r.activityId === a.id
                          );
                          return r?.done;
                        }).length;
                        const total = studentActivities.length;
                        const pct = total > 0 ? Math.round((done / total) * 100) : null;

                        return (
                          <tr key={student.id}>
                            <td
                              className="font-medium whitespace-nowrap sticky left-0 z-10"
                              style={{ backgroundColor: "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                            >
                              {student.name}
                            </td>
                            <td>
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
                              >
                                {student.turma}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: "hsl(var(--done))" }} className="font-semibold">{done}</span>
                            </td>
                            <td>
                              <span style={{ color: "hsl(var(--not-done))" }} className="font-semibold">{total - done}</span>
                            </td>
                            <td>
                              {pct !== null ? (
                                <span
                                  className="rounded px-2 py-0.5 text-xs font-bold"
                                  style={
                                    pct >= 75
                                      ? { backgroundColor: "hsl(var(--done-light))", color: "hsl(var(--done))" }
                                      : { backgroundColor: "hsl(var(--not-done-light))", color: "hsl(var(--not-done))" }
                                  }
                                >
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>—</span>
                              )}
                            </td>
                            {filteredActivities.map((a) => {
                              const turma = data.turmas.find((t) => t.name === student.turma);
                              if (turma?.id !== a.turmaId) {
                                return <td key={a.id} className="text-center text-xs opacity-30">—</td>;
                              }
                              const status = getActivityStatus(student.id, a.id);
                              return (
                                <td key={a.id} className="text-center">
                                  {status === true && <CheckCircle size={16} style={{ color: "hsl(var(--done))" }} className="mx-auto" />}
                                  {status === false && <XCircle size={16} style={{ color: "hsl(var(--not-done))" }} className="mx-auto" />}
                                  {status === null && <Circle size={14} className="mx-auto opacity-20" />}
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
          )}

          {/* Min Tasks Summary Table */}
          {activeView === "mintasks" && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Resumo de Tarefa Mínima</span>
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {(data.minTasks || []).length} tarefa(s) mínima(s) no total
                </span>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Nenhum aluno encontrado.
                  </div>
                ) : (() => {
                  const studentMinTasks = (studentTurmaName: string) => {
                    const turma = data.turmas.find((t) => t.name === studentTurmaName);
                    if (!turma) return [];
                    let tasks = (data.minTasks || []).filter((t) => t.turmaId === turma.id);
                    if (filterDateFrom) tasks = tasks.filter((t) => t.date >= filterDateFrom);
                    if (filterDateTo) tasks = tasks.filter((t) => t.date <= filterDateTo);
                    return tasks;
                  };

                  const getRecord = (studentId: string, minTaskId: string) => {
                    const r = (data.minTaskRecords || []).find(
                      (r) => r.studentId === studentId && r.minTaskId === minTaskId
                    );
                    return r?.questionsDone ?? 0;
                  };

                  return (
                    <table className="school-table school-table-compact table-fit-content center-non-student-cols" style={{ minWidth: "max-content" }}>
                      <thead>
                        <tr>
                          <th className="sticky left-0 top-0 z-30" style={{ backgroundColor: "hsl(var(--table-header))", width: studentNameColWidth, minWidth: studentNameColWidth }}>Aluno</th>
                          <th className="sticky top-0 z-20" style={{ backgroundColor: "hsl(var(--table-header))" }}>Turma</th>
                          <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total Feitas</th>
                          <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>Total Possível</th>
                          <th className="sticky top-0 z-20 text-center" style={{ backgroundColor: "hsl(var(--table-header))" }}>% Aproveitamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const tasks = studentMinTasks(student.turma);
                          const totalDone = tasks.reduce((sum, t) => sum + getRecord(student.id, t.id), 0);
                          const totalPossible = tasks.reduce((sum, t) => sum + t.totalQuestions, 0);
                          const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : null;
                          return (
                            <tr key={student.id}>
                              <td
                                className="font-medium whitespace-nowrap sticky left-0 z-10"
                                style={{ backgroundColor: "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                              >
                                {student.name}
                              </td>
                              <td>
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                  style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
                                >
                                  {student.turma}
                                </span>
                              </td>
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
                                ) : (
                                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GRÁFICOS ── */}
      {mainView === "graficos" && (
        <ChartsSubpage
          data={data}
          filterTurma={filterTurma}
          filterDateFrom={filterDateFrom}
          filterDateTo={filterDateTo}
        />
      )}
    </div>
  );
}
