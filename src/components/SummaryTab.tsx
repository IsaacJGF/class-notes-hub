import { useState, useMemo, useEffect, useRef } from "react";
import { SchoolData, ActivityRecord } from "@/types";
import { CheckCircle, XCircle, Circle, Download, BarChart2, TableIcon, Search, X, AlertTriangle, Settings2, ChevronDown, ChevronUp, GraduationCap, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { matchesAccentAware } from "@/lib/textSearch";
import { ChartsSubpage } from "@/components/ChartsSubpage";

interface Props {
  data: SchoolData;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
  removeActivity: (id: string) => void;
  initialTurma?: string;
  onInitialTurmaConsumed?: () => void;
  onOpenTurma?: (turmaId: string, date?: string) => void;
}

type MainView = "tabelas" | "graficos";

export function SummaryTab({ data, toggleActivityRecord, getActivityRecordFull, setActivityOnTimeOverride, removeActivity, initialTurma, onInitialTurmaConsumed, onOpenTurma }: Props) {
  const [mainView, setMainView] = useState<MainView>("tabelas");
  const [filterTurma, setFilterTurma] = useState("");

  useEffect(() => {
    if (initialTurma) {
      setFilterTurma(initialTurma);
      onInitialTurmaConsumed?.();
    }
  }, [initialTurma, onInitialTurmaConsumed]);

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
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

  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [activityThreshold, setActivityThreshold] = useState(() => {
    const saved = localStorage.getItem("alert_activity_threshold");
    return saved ? parseInt(saved) : 50;
  });

  useEffect(() => {
    localStorage.setItem("alert_activity_threshold", String(activityThreshold));
  }, [activityThreshold]);

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

  const getActivityStatus = (studentId: string, activityId: string) => {
    const record = data.activityRecords.find(
      (r) => r.studentId === studentId && r.activityId === activityId
    );
    if (!record) return null;
    return record.done;
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
        cell.s = { ...(cell.s || {}), alignment: { horizontal: "center", vertical: "center" } };
      }
    }
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
    const turmaLabel = filterTurma ? filterTurma.replace(/\s+/g, "_") : "geral";
    XLSX.writeFile(wb, `resumo_atividades_${turmaLabel}.xlsx`);
  };

  // ---- Alerts ----
  type AlertItem = { studentId: string; studentName: string; turma: string; pct: number; detail: string };

  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];
    for (const student of allFilteredStudents) {
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
          result.push({ studentId: student.id, studentName: student.name, turma: student.turma, pct: actPct, detail: `${done}/${studentActivities.length} atividades (${actPct}%)` });
        }
      }
    }
    return result.sort((a, b) => a.pct - b.pct);
  }, [allFilteredStudents, filteredActivities, data, activityThreshold]);

  const alertStudentIds = useMemo(() => new Set(alerts.map((a) => a.studentId)), [alerts]);

  return (
    <div className="space-y-3 sm:space-y-4 p-2 sm:p-4">
      {/* Filters */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Filtros</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 p-3 sm:p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              Turma
            </label>
            <select
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] touch-manipulation w-full sm:w-auto"
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
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] touch-manipulation w-full sm:w-auto"
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
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] touch-manipulation w-full sm:w-auto"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
            className="rounded border border-border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80 min-h-[40px] touch-manipulation w-full sm:w-auto"
            style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
          >
            Limpar datas
          </button>
          {filterTurma && onOpenTurma && (
            <button
              onClick={() => {
                const t = data.turmas.find((tu) => tu.name === filterTurma);
                if (t) onOpenTurma(t.id);
              }}
              className="flex items-center justify-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 min-h-[40px] touch-manipulation w-full sm:w-auto sm:ml-auto"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              title="Abrir planilha desta turma"
            >
              <GraduationCap size={14} /> Abrir planilha da turma
            </button>
          )}
        </div>
      </div>

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
      {/* Alerts */}
      {alerts.length > 0 && (
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
                title="Configurar limite"
              >
                <Settings2 size={14} style={{ color: "hsl(var(--warning-foreground))" }} />
              </button>
              {alertsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {showAlertSettings && (
            <div className="border-t px-4 py-3 flex flex-wrap gap-4" style={{ borderColor: "hsl(var(--warning-border))", backgroundColor: "hsl(var(--card))" }}>
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
            </div>
          )}

          {alertsOpen && (
            <div className="border-t px-4 py-2 max-h-48 overflow-auto" style={{ borderColor: "hsl(var(--warning-border))" }}>
              <div className="space-y-1">
                {alerts.map((alert, i) => (
                  <div key={`${alert.studentId}-${i}`} className="flex items-center gap-2 py-1 text-sm">
                    <AlertTriangle size={12} style={{ color: "hsl(var(--warning))" }} className="shrink-0" />
                    <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{alert.studentName}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>{alert.turma}</span>
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{alert.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + Main sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1 overflow-x-auto scrollbar-hide" style={{ backgroundColor: "hsl(var(--muted))", width: "fit-content", maxWidth: "100%" }}>
          <button
            onClick={() => setMainView("tabelas")}
            className="flex items-center gap-1.5 rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all min-h-[40px] touch-manipulation whitespace-nowrap"
            style={
              mainView === "tabelas"
                ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <TableIcon size={14} /> Tabela
          </button>
          <button
            onClick={() => setMainView("graficos")}
            className="flex items-center gap-1.5 rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all min-h-[40px] touch-manipulation whitespace-nowrap"
            style={
              mainView === "graficos"
                ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <BarChart2 size={14} /> Gráficos
          </button>
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
                  {filteredStudents.length}/{allFilteredStudents.length}
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

      {/* TABELAS */}
      {mainView === "tabelas" && (
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
                      <th key={a.id} className="sticky top-0 z-20 text-center relative" style={{ backgroundColor: "hsl(var(--table-header))", minWidth: "8rem" }}>
                        <button
                          onClick={() => {
                            if (confirm(`Apagar a atividade "${a.name}" (${formatDate(a.date)})? Esta ação remove a coluna e todos os registros associados, inclusive na planilha da turma.`)) {
                              removeActivity(a.id);
                            }
                          }}
                          className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-40 hover:opacity-100 hover:text-destructive"
                          title="Apagar esta atividade"
                        >
                          <Trash2 size={11} />
                        </button>
                        {filterTurma && onOpenTurma ? (
                          <button
                            onClick={() => {
                              const t = data.turmas.find((tu) => tu.name === filterTurma);
                              if (t) onOpenTurma(t.id, a.date);
                            }}
                            className="block w-full px-3 hover:underline underline-offset-2"
                            style={{ color: "hsl(var(--table-header-foreground))" }}
                            title="Abrir planilha da turma neste dia"
                          >
                            <div>{formatDate(a.date)}</div>
                            <div className="text-xs opacity-80 whitespace-normal break-words leading-tight" title={a.name}>{a.name}</div>
                          </button>
                        ) : (
                          <div className="px-3">
                            <div>{formatDate(a.date)}</div>
                            <div className="text-xs opacity-80 whitespace-normal break-words leading-tight" title={a.name}>{a.name}</div>
                          </div>
                        )}
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
                          const rec = getActivityRecordFull(student.id, a.id);
                          const isDone = status === true;
                          const markedAt = rec?.markedAt;
                          const isLate = !!(isDone && a.deadline && !rec?.overrideOnTime && markedAt && markedAt > a.deadline);
                          const overridden = !!rec?.overrideOnTime;
                          const tooltip = !isDone
                            ? (status === false ? "Pendente — clique para marcar como feito" : "Marcar")
                            : isLate
                              ? `Feito fora do prazo — registrado em ${markedAt} (prazo ${a.deadline}) · clique direito para corrigir`
                              : overridden
                                ? `Marcado manualmente como no prazo${markedAt ? ` — registrado em ${markedAt}` : ""} · clique direito para reverter`
                                : `Feito no prazo${markedAt ? ` — registrado em ${markedAt}` : ""}`;
                          return (
                            <td key={a.id} className="text-center">
                              <button
                                onClick={() => toggleActivityRecord(student.id, a.id)}
                                onContextMenu={(e) => {
                                  if (!isDone) return;
                                  e.preventDefault();
                                  setContextMenu({ x: e.clientX, y: e.clientY, studentId: student.id, activityId: a.id });
                                }}
                                className="mx-auto flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors cursor-pointer"
                                title={tooltip}
                              >
                                {isLate ? (
                                  <AlertTriangle size={16} style={{ color: "hsl(38 92% 45%)" }} />
                                ) : isDone ? (
                                  <CheckCircle size={16} style={{ color: "hsl(var(--done))" }} />
                                ) : status === false ? (
                                  <XCircle size={16} style={{ color: "hsl(var(--not-done))" }} />
                                ) : (
                                  <Circle size={14} className="opacity-20" />
                                )}
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

      {mainView === "graficos" && (
        <ChartsSubpage
          data={data}
          filterTurma={filterTurma}
          filterDateFrom={filterDateFrom}
          filterDateTo={filterDateTo}
        />
      )}
      </>)}

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
            {!activity?.deadline && (
              <div className="px-3 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Esta atividade não possui prazo definido.
              </div>
            )}
            {activity?.deadline && isActuallyLate && !isCurrentlyOverridden && (
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
            {activity?.deadline && isCurrentlyOverridden && (
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
            {activity?.deadline && !isActuallyLate && !isCurrentlyOverridden && (
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