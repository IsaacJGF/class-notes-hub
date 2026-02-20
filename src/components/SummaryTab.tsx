import { useState, useMemo } from "react";
import { SchoolData } from "@/types";
import { CheckCircle, XCircle, Circle, Download, BarChart2, TableIcon } from "lucide-react";
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
  const [activeView, setActiveView] = useState<"attendance" | "activities">("attendance");

  const filteredStudents = useMemo(() => {
    if (filterTurma === "all") return data.students;
    return data.students.filter((s) => s.turma === filterTurma);
  }, [data.students, filterTurma]);

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

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  // ---- Export Excel ----
  const exportAttendanceExcel = () => {
    const headers = ["Aluno", "Turma", "Presença", "Faltas", "% Presença", ...attendanceDates.map(formatDate)];
    const rows = filteredStudents.map((student) => {
      const { present, total } = getAttendanceSummary(student.id);
      const pct = total > 0 ? Math.round((present / total) * 100) : "";
      const dateColumns = attendanceDates.map((d) => {
        const s = getAttendanceStatus(student.id, d);
        return s === true ? "P" : s === false ? "F" : "";
      });
      return [student.name, student.turma, present, total - present, pct !== "" ? `${pct}%` : "", ...dateColumns];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
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
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
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

      {/* Main sub-nav: Tabelas | Gráficos */}
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
              <div className="overflow-x-auto">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Nenhum aluno encontrado.
                  </div>
                ) : (
                  <table className="school-table" style={{ minWidth: "max-content" }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>Aluno</th>
                        <th>Turma</th>
                        <th>Presença</th>
                        <th>Faltas</th>
                        <th>% Presença</th>
                        {attendanceDates.map((d) => (
                          <th key={d} className="text-center">{formatDate(d)}</th>
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
                              style={{ backgroundColor: "hsl(var(--card))" }}
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
              <div className="overflow-x-auto">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Nenhum aluno encontrado.
                  </div>
                ) : (
                  <table className="school-table" style={{ minWidth: "max-content" }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10" style={{ backgroundColor: "hsl(var(--table-header))" }}>Aluno</th>
                        <th>Turma</th>
                        <th>Entregues</th>
                        <th>Pendentes</th>
                        <th>% Entrega</th>
                        {filteredActivities.map((a) => (
                          <th key={a.id} className="text-center min-w-16">
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
                              style={{ backgroundColor: "hsl(var(--card))" }}
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
