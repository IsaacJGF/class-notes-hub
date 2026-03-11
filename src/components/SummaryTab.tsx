import { useState, useMemo, useEffect, useRef } from "react";
import { SchoolData } from "@/types";
import { CheckCircle, XCircle, Circle, Download, BarChart2, TableIcon, Search, X, AlertTriangle, Settings2, ChevronDown, ChevronUp, GraduationCap } from "lucide-react";
import * as XLSX from "xlsx";
import { matchesAccentAware } from "@/lib/textSearch";
import { ChartsSubpage } from "@/components/ChartsSubpage";

interface Props {
  data: SchoolData;
  toggleAttendance: (studentId: string, date: string) => void;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  setMinTaskRecord: (studentId: string, minTaskId: string, questionsDone: number) => void;
  getMinTaskRecord: (studentId: string, minTaskId: string) => number;
}

type MainView = "tabelas" | "graficos";

export function SummaryTab({ data, toggleAttendance, toggleActivityRecord, setMinTaskRecord, getMinTaskRecord }: Props) {
  const [mainView, setMainView] = useState<MainView>("tabelas");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [activeView, setActiveView] = useState<"attendance" | "activities" | "mintasks">("attendance");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [attendanceThreshold, setAttendanceThreshold] = useState(() => {
    const saved = localStorage.getItem("alert_attendance_threshold");
    return saved ? parseInt(saved) : 75;
  });
  const [activityThreshold, setActivityThreshold] = useState(() => {
    const saved = localStorage.getItem("alert_activity_threshold");
    return saved ? parseInt(saved) : 50;
  });
  const [minTaskThreshold, setMinTaskThreshold] = useState(() => {
    const saved = localStorage.getItem("alert_mintask_threshold");
    return saved ? parseInt(saved) : 50;
  });

  useEffect(() => {
    localStorage.setItem("alert_attendance_threshold", String(attendanceThreshold));
  }, [attendanceThreshold]);
  useEffect(() => {
    localStorage.setItem("alert_activity_threshold", String(activityThreshold));
  }, [activityThreshold]);
  useEffect(() => {
    localStorage.setItem("alert_mintask_threshold", String(minTaskThreshold));
  }, [minTaskThreshold]);

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

  const allFilteredStudents = useMemo(() => {
    const students = filterTurma
      ? data.students.filter((s) => s.turma === filterTurma)
      : data.students;

    return [...students].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      return studentSortOrder === "asc" ? comparison : -comparison;
    });
  }, [data.students, filterTurma, studentSortOrder]);

  const sortedTurmas = useMemo(
    () => [...data.turmas].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [data.turmas]
  );

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allFilteredStudents;
    return allFilteredStudents.filter((s) => matchesAccentAware(s.name, searchQuery));
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
    if (filterTurma) {
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

  const exportMinTasksExcelSheet = (wb?: XLSX.WorkBook) => {
    let tasks = data.minTasks || [];
    if (filterTurma) {
      const turma = data.turmas.find((t) => t.name === filterTurma);
      if (turma) tasks = tasks.filter((t) => t.turmaId === turma.id);
    }
    if (filterDateFrom) tasks = tasks.filter((t) => t.date >= filterDateFrom);
    if (filterDateTo) tasks = tasks.filter((t) => t.date <= filterDateTo);
    tasks = tasks.sort((a, b) => a.date.localeCompare(b.date));

    const headers = [
      "Aluno", "Turma", "Total Feitas", "Total Possível", "% Aproveitamento",
      ...tasks.map((t) => `${formatDate(t.date)} - ${t.name} (/${t.totalQuestions})`),
    ];
    const rows = filteredStudents.map((student) => {
      const turma = data.turmas.find((tu) => tu.name === student.turma);
      const studentTasks = turma ? tasks.filter((t) => t.turmaId === turma.id) : [];
      const totalDone = studentTasks.reduce((sum, t) => sum + getMinTaskRecord(student.id, t.id), 0);
      const totalPossible = studentTasks.reduce((sum, t) => sum + t.totalQuestions, 0);
      const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : "";
      const taskColumns = tasks.map((t) => {
        if (turma?.id !== t.turmaId) return "—";
        return `${getMinTaskRecord(student.id, t.id)}/${t.totalQuestions}`;
      });
      return [student.name, student.turma, totalDone, totalPossible, pct !== "" ? `${pct}%` : "", ...taskColumns];
    });
    const tableData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    ws["!cols"] = getColumnWidths(tableData);
    centerColumnsExceptStudent(ws, tableData);

    if (wb) {
      XLSX.utils.book_append_sheet(wb, ws, "Tarefa Mínima");
      return wb;
    }
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, ws, "Tarefa Mínima");
    XLSX.writeFile(newWb, "resumo_tarefa_minima.xlsx");
  };

  const exportCompleteExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Chamada
    const attHeaders = ["Aluno", "Turma", "Presença", "Faltas", "% Presença", "Participações", "Part./Aulas", "Pontos Extra", ...attendanceDates.map(formatDate)];
    const attRows = filteredStudents.map((student) => {
      const { present, total } = getAttendanceSummary(student.id);
      const classDatesForStudent = getClassDatesForStudent(student.id, student.turma);
      const participationCount = getParticipationCount(student.id);
      const extraPointCount = getExtraPointCount(student.id);
      const pct = total > 0 ? Math.round((present / total) * 100) : "";
      const dateColumns = attendanceDates.map((d) => {
        const s = getAttendanceStatus(student.id, d);
        return s === true ? "P" : s === false ? "F" : "";
      });
      return [student.name, student.turma, present, total - present, pct !== "" ? `${pct}%` : "", participationCount, `${participationCount}/${classDatesForStudent.length}`, extraPointCount, ...dateColumns];
    });
    const attData = [attHeaders, ...attRows];
    const ws1 = XLSX.utils.aoa_to_sheet(attData);
    ws1["!cols"] = getColumnWidths(attData);
    centerColumnsExceptStudent(ws1, attData);
    XLSX.utils.book_append_sheet(wb, ws1, "Chamada");

    // Sheet 2: Atividades
    const actHeaders = ["Aluno", "Turma", "Entregues", "Pendentes", "% Entrega", ...filteredActivities.map((a) => `${formatDate(a.date)} - ${a.name}`)];
    const actRows = filteredStudents.map((student) => {
      const studentActivities = filteredActivities.filter((a) => {
        const turma = data.turmas.find((t) => t.name === student.turma);
        return turma?.id === a.turmaId;
      });
      const done = studentActivities.filter((a) => {
        const r = data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id);
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
    const actData = [actHeaders, ...actRows];
    const ws2 = XLSX.utils.aoa_to_sheet(actData);
    ws2["!cols"] = getColumnWidths(actData);
    centerColumnsExceptStudent(ws2, actData);
    XLSX.utils.book_append_sheet(wb, ws2, "Atividades");

    // Sheet 3: Tarefa Mínima
    exportMinTasksExcelSheet(wb);

    const turmaLabel = filterTurma ? filterTurma.replace(/\s+/g, "_") : "geral";
    XLSX.writeFile(wb, `resumo_completo_${turmaLabel}.xlsx`);
  };

  // ---- Alerts computation ----
  type AlertItem = { studentId: string; studentName: string; turma: string; type: "attendance" | "activity" | "mintask"; pct: number; detail: string };

  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];
    for (const student of allFilteredStudents) {
      // Attendance
      const { present, total } = getAttendanceSummary(student.id);
      if (total > 0) {
        const attPct = Math.round((present / total) * 100);
        if (attPct < attendanceThreshold) {
          result.push({ studentId: student.id, studentName: student.name, turma: student.turma, type: "attendance", pct: attPct, detail: `${present}/${total} presenças (${attPct}%)` });
        }
      }
      // Activities
      const studentActivities = filteredActivities.filter((a) => {
        const turma = data.turmas.find((t) => t.name === student.turma);
        return turma?.id === a.turmaId;
      });
      if (studentActivities.length > 0) {
        const done = studentActivities.filter((a) => {
          const r = data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id);
          return r?.done;
        }).length;
        const actPct = Math.round((done / studentActivities.length) * 100);
        if (actPct < activityThreshold) {
          result.push({ studentId: student.id, studentName: student.name, turma: student.turma, type: "activity", pct: actPct, detail: `${done}/${studentActivities.length} atividades (${actPct}%)` });
        }
      }
      // MinTasks
      const turma = data.turmas.find((t) => t.name === student.turma);
      if (turma) {
        const tasks = (data.minTasks || []).filter((t) => t.turmaId === turma.id);
        if (tasks.length > 0) {
          const totalDone = tasks.reduce((sum, t) => sum + getMinTaskRecord(student.id, t.id), 0);
          const totalPossible = tasks.reduce((sum, t) => sum + t.totalQuestions, 0);
          if (totalPossible > 0) {
            const mtPct = Math.round((totalDone / totalPossible) * 100);
            if (mtPct < minTaskThreshold) {
              result.push({ studentId: student.id, studentName: student.name, turma: student.turma, type: "mintask", pct: mtPct, detail: `${totalDone}/${totalPossible} questões (${mtPct}%)` });
            }
          }
        }
      }
    }
    return result.sort((a, b) => a.pct - b.pct);
  }, [allFilteredStudents, attendanceDates, filteredActivities, data, attendanceThreshold, activityThreshold, minTaskThreshold]);

  const alertStudentIds = useMemo(() => new Set(alerts.map((a) => a.studentId)), [alerts]);

  const alertTypeLabels: Record<string, string> = { attendance: "Frequência", activity: "Atividades", mintask: "Tarefa Mínima" };

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
              <option value="" disabled>Selecione uma turma</option>
              {sortedTurmas.map((t) => (
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
            onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
            className="rounded border border-border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
          >
            Limpar datas
          </button>
        </div>
      </div>

      {/* No turma selected message */}
      {!filterTurma && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap size={48} style={{ color: "hsl(var(--muted-foreground))" }} className="mb-4 opacity-40" />
          <p className="text-lg font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
            Selecione uma turma para visualizar o resumo
          </p>
          <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Use o filtro acima para escolher a turma desejada.
          </p>
        </div>
      )}

      {filterTurma && (<>
      {/* Alerts Panel */}
      {filterTurma && alerts.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "hsl(var(--warning-border))", backgroundColor: "hsl(var(--warning-light))" }}>
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: "hsl(var(--warning))" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(var(--warning-foreground))" }}>
                {alerts.length} alerta(s) pedagógico(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowAlertSettings(!showAlertSettings); }}
                className="rounded p-1 hover:opacity-70 transition-colors"
                title="Configurar limites"
              >
                <Settings2 size={14} style={{ color: "hsl(var(--warning-foreground))" }} />
              </button>
              {alertsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {showAlertSettings && (
            <div className="border-t px-4 py-3 flex flex-wrap gap-4" style={{ borderColor: "hsl(var(--warning-border))", backgroundColor: "hsl(var(--card))" }}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Frequência mínima</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} value={attendanceThreshold}
                    onChange={(e) => setAttendanceThreshold(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Atividades mínimas</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} value={activityThreshold}
                    onChange={(e) => setActivityThreshold(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Tarefa Mínima mínima</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} value={minTaskThreshold}
                    onChange={(e) => setMinTaskThreshold(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>%</span>
                </div>
              </div>
            </div>
          )}

          {alertsOpen && (
            <div className="border-t px-4 py-2 max-h-48 overflow-auto" style={{ borderColor: "hsl(var(--warning-border))" }}>
              <div className="space-y-1">
                {alerts.map((alert, i) => (
                  <div key={`${alert.studentId}-${alert.type}-${i}`} className="flex items-center gap-2 py-1 text-sm">
                    <AlertTriangle size={12} style={{ color: "hsl(var(--warning))" }} className="shrink-0" />
                    <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{alert.studentName}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>{alert.turma}</span>
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>·</span>
                    <span className="text-xs font-semibold" style={{ color: "hsl(var(--warning-foreground))" }}>{alertTypeLabels[alert.type]}</span>
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{alert.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          <button
            onClick={() => setStudentSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="mr-2 rounded border border-border px-2 py-1.5 text-xs font-medium hover:opacity-80"
            style={{ color: "hsl(var(--muted-foreground))" }}
            title="Alternar ordem alfabética"
          >
            {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
          </button>
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
              onClick={() => { setShowSearch(true); focusAndSelectSearchInput(); }}
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
           <div className="flex items-center gap-2 flex-wrap">
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
             <button
               onClick={exportCompleteExcel}
               className="ml-auto flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
               style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
             >
               <Download size={14} /> Exportar Completo (Excel)
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
                          <tr key={student.id} style={alertStudentIds.has(student.id) ? { backgroundColor: "hsl(var(--warning-light))" } : undefined}>
                            <td
                              className="font-medium whitespace-nowrap sticky left-0 z-10"
                              style={{ backgroundColor: alertStudentIds.has(student.id) ? "hsl(var(--warning-light))" : "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                            >
                              <span className="flex items-center gap-1">
                                {alertStudentIds.has(student.id) && <AlertTriangle size={12} style={{ color: "hsl(var(--warning))" }} className="shrink-0" />}
                                {student.name}
                              </span>
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
                                  <button
                                    onClick={() => toggleAttendance(student.id, d)}
                                    className="mx-auto flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors cursor-pointer"
                                    title={status === true ? "Presente → Falta" : status === false ? "Falta → Presente" : "Marcar presença"}
                                  >
                                    {status === true && <CheckCircle size={16} style={{ color: "hsl(var(--present))" }} />}
                                    {status === false && <XCircle size={16} style={{ color: "hsl(var(--absent))" }} />}
                                    {status === null && <Circle size={14} className="opacity-20" />}
                                  </button>
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
                          <tr key={student.id} style={alertStudentIds.has(student.id) ? { backgroundColor: "hsl(var(--warning-light))" } : undefined}>
                            <td
                              className="font-medium whitespace-nowrap sticky left-0 z-10"
                              style={{ backgroundColor: alertStudentIds.has(student.id) ? "hsl(var(--warning-light))" : "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                            >
                              <span className="flex items-center gap-1">
                                {alertStudentIds.has(student.id) && <AlertTriangle size={12} style={{ color: "hsl(var(--warning))" }} className="shrink-0" />}
                                {student.name}
                              </span>
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
                                  <button
                                    onClick={() => toggleActivityRecord(student.id, a.id)}
                                    className="mx-auto flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors cursor-pointer"
                                    title={status === true ? "Feito → Pendente" : "Pendente → Feito"}
                                  >
                                    {status === true && <CheckCircle size={16} style={{ color: "hsl(var(--done))" }} />}
                                    {status === false && <XCircle size={16} style={{ color: "hsl(var(--not-done))" }} />}
                                    {status === null && <Circle size={14} className="opacity-20" />}
                                  </button>
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
                  const allFilteredMinTasks = (() => {
                    let tasks = data.minTasks || [];
                    if (filterTurma) {
                      const turma = data.turmas.find((t) => t.name === filterTurma);
                      if (turma) tasks = tasks.filter((t) => t.turmaId === turma.id);
                    }
                    if (filterDateFrom) tasks = tasks.filter((t) => t.date >= filterDateFrom);
                    if (filterDateTo) tasks = tasks.filter((t) => t.date <= filterDateTo);
                    return tasks.sort((a, b) => a.date.localeCompare(b.date));
                  })();

                  const studentMinTasks = (studentTurmaName: string) => {
                    const turma = data.turmas.find((t) => t.name === studentTurmaName);
                    if (!turma) return [];
                    return allFilteredMinTasks.filter((t) => t.turmaId === turma.id);
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
                          {allFilteredMinTasks.map((t) => (
                            <th key={t.id} className="sticky top-0 z-20 text-center min-w-16" style={{ backgroundColor: "hsl(var(--table-header))" }}>
                              <div>{formatDate(t.date)}</div>
                              <div className="truncate max-w-16 text-xs opacity-80" title={`${t.name} (/${t.totalQuestions})`}>{t.name}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const tasks = studentMinTasks(student.turma);
                          const totalDone = tasks.reduce((sum, t) => sum + getMinTaskRecord(student.id, t.id), 0);
                          const totalPossible = tasks.reduce((sum, t) => sum + t.totalQuestions, 0);
                          const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : null;
                          return (
                            <tr key={student.id} style={alertStudentIds.has(student.id) ? { backgroundColor: "hsl(var(--warning-light))" } : undefined}>
                              <td
                                className="font-medium whitespace-nowrap sticky left-0 z-10"
                                style={{ backgroundColor: alertStudentIds.has(student.id) ? "hsl(var(--warning-light))" : "hsl(var(--card))", width: studentNameColWidth, minWidth: studentNameColWidth }}
                              >
                                <span className="flex items-center gap-1">
                                  {alertStudentIds.has(student.id) && <AlertTriangle size={12} style={{ color: "hsl(var(--warning))" }} className="shrink-0" />}
                                  {student.name}
                                </span>
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
                              {allFilteredMinTasks.map((t) => {
                                const turma = data.turmas.find((tu) => tu.name === student.turma);
                                if (turma?.id !== t.turmaId) {
                                  return <td key={t.id} className="text-center text-xs opacity-30">—</td>;
                                }
                                const val = getMinTaskRecord(student.id, t.id);
                                return (
                                  <td key={t.id} className="text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={t.totalQuestions}
                                      value={val}
                                      onChange={(e) => {
                                        const v = Math.max(0, Math.min(t.totalQuestions, parseInt(e.target.value) || 0));
                                        setMinTaskRecord(student.id, t.id, v);
                                      }}
                                      className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    <span className="text-xs ml-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>/{t.totalQuestions}</span>
                                  </td>
                                );
                              })}
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
