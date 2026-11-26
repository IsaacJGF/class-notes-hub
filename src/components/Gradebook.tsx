import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ArrowLeftRight, CheckCircle2, ChevronDown, Clock3, Download, History, MoreHorizontal, Settings2, Plus, Trash2, Table2, Calculator, XCircle } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  turma: Turma;
  term: AcademicTerm;
  data: SchoolData;
  removeStudent: (id: string) => void;
  transferStudent: (studentId: string, targetTurmaId: string) => void;
  searchQuery: string;
  studentSortOrder: "asc" | "desc";
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  renderStudentSearch: (placement: "header" | "gradebook") => ReactNode;
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

type SpreadsheetSelection = {
  gridId: string;
  anchorRow: number;
  anchorColumn: number;
  focusRow: number;
  focusColumn: number;
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

function parseSpreadsheetScore(value: string): { valid: true; score: number | null } | { valid: false } {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return { valid: true, score: null };
  const score = Number(normalized);
  return Number.isFinite(score) ? { valid: true, score } : { valid: false };
}

function parseClipboardMatrix(value: string): string[][] {
  const rows = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  return rows.map((row) => row.split("\t"));
}

export function Gradebook({
  turma,
  term,
  data,
  removeStudent,
  transferStudent,
  searchQuery,
  studentSortOrder,
  activeTab,
  onActiveTabChange,
  renderStudentSearch,
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
  const [spreadsheetSelection, setSpreadsheetSelectionState] = useState<SpreadsheetSelection | null>(null);
  const spreadsheetSelectionRef = useRef<SpreadsheetSelection | null>(null);
  const spreadsheetDragging = useRef(false);
  const gradebookRef = useRef<HTMLElement | null>(null);

  const updateSpreadsheetSelection = (selection: SpreadsheetSelection | null) => {
    spreadsheetSelectionRef.current = selection;
    setSpreadsheetSelectionState(selection);
  };

  useEffect(() => {
    const stopSelecting = () => { spreadsheetDragging.current = false; };
    window.addEventListener("mouseup", stopSelecting);
    return () => window.removeEventListener("mouseup", stopSelecting);
  }, []);

  const spreadsheetCellAttributes = (gridId: string, row: number, column: number, value: string) => ({
    "data-spreadsheet-cell": "true",
    "data-spreadsheet-grid": gridId,
    "data-spreadsheet-row": row,
    "data-spreadsheet-column": column,
    "data-spreadsheet-value": value,
    "data-spreadsheet-selected": isSpreadsheetCellSelected(gridId, row, column) ? "true" : undefined,
    tabIndex: -1,
  });

  const isSpreadsheetCellSelected = (gridId: string, row: number, column: number) => {
    const selection = spreadsheetSelection;
    if (!selection || selection.gridId !== gridId) return false;
    const minRow = Math.min(selection.anchorRow, selection.focusRow);
    const maxRow = Math.max(selection.anchorRow, selection.focusRow);
    const minColumn = Math.min(selection.anchorColumn, selection.focusColumn);
    const maxColumn = Math.max(selection.anchorColumn, selection.focusColumn);
    return row >= minRow && row <= maxRow && column >= minColumn && column <= maxColumn;
  };

  const handleSpreadsheetMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button, a, [role='menuitem']")) return;
    const cell = target?.closest<HTMLElement>("[data-spreadsheet-cell]");
    if (!cell || event.button !== 0) return;
    const gridId = cell.dataset.spreadsheetGrid;
    const row = Number(cell.dataset.spreadsheetRow);
    const column = Number(cell.dataset.spreadsheetColumn);
    if (!gridId || !Number.isFinite(row) || !Number.isFinite(column)) return;

    const previous = spreadsheetSelectionRef.current;
    const anchorRow = event.shiftKey && previous?.gridId === gridId ? previous.anchorRow : row;
    const anchorColumn = event.shiftKey && previous?.gridId === gridId ? previous.anchorColumn : column;
    updateSpreadsheetSelection({ gridId, anchorRow, anchorColumn, focusRow: row, focusColumn: column });
    spreadsheetDragging.current = true;
    if (!target?.closest("input[data-spreadsheet-input]")) {
      event.preventDefault();
      cell.focus();
    }
  };

  const handleSpreadsheetMouseOver = (event: ReactMouseEvent<HTMLElement>) => {
    if (!spreadsheetDragging.current) return;
    const target = event.target instanceof Element ? event.target : null;
    const cell = target?.closest<HTMLElement>("[data-spreadsheet-cell]");
    const selection = spreadsheetSelectionRef.current;
    if (!cell || !selection || cell.dataset.spreadsheetGrid !== selection.gridId) return;
    const row = Number(cell.dataset.spreadsheetRow);
    const column = Number(cell.dataset.spreadsheetColumn);
    if (!Number.isFinite(row) || !Number.isFinite(column)) return;
    if (row === selection.focusRow && column === selection.focusColumn) return;
    updateSpreadsheetSelection({ ...selection, focusRow: row, focusColumn: column });
  };

  const handleSpreadsheetColumnClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const header = target?.closest<HTMLElement>("[data-spreadsheet-column-header]");
    if (!header) return;
    const gridId = header.dataset.spreadsheetGrid;
    const column = Number(header.dataset.spreadsheetColumn);
    const rowCount = Number(header.dataset.spreadsheetRowCount);
    if (!gridId || !Number.isFinite(column) || !Number.isFinite(rowCount) || rowCount < 1) return;
    updateSpreadsheetSelection({ gridId, anchorRow: 0, anchorColumn: column, focusRow: rowCount - 1, focusColumn: column });
  };

  const handleSpreadsheetCopy = (event: ReactClipboardEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const selection = spreadsheetSelectionRef.current;
    if (target?.closest("button:not([data-spreadsheet-column-header]), a, [role='menuitem']")) return;
    if (!selection || !target?.closest("[data-spreadsheet-cell], [data-spreadsheet-column-header]")) return;

    const input = target.closest<HTMLInputElement>("input[data-spreadsheet-input]");
    const isSingleCell = selection.anchorRow === selection.focusRow && selection.anchorColumn === selection.focusColumn;
    if (input && isSingleCell && input.selectionStart !== null && input.selectionEnd !== null && input.selectionStart !== input.selectionEnd) return;

    const root = gradebookRef.current;
    if (!root) return;
    const minRow = Math.min(selection.anchorRow, selection.focusRow);
    const maxRow = Math.max(selection.anchorRow, selection.focusRow);
    const minColumn = Math.min(selection.anchorColumn, selection.focusColumn);
    const maxColumn = Math.max(selection.anchorColumn, selection.focusColumn);
    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-spreadsheet-cell]"));
    const valueAt = (row: number, column: number) => {
      const cell = cells.find((item) => item.dataset.spreadsheetGrid === selection.gridId
        && Number(item.dataset.spreadsheetRow) === row
        && Number(item.dataset.spreadsheetColumn) === column);
      if (!cell) return "";
      const cellInput = cell.querySelector<HTMLInputElement>("input[data-spreadsheet-input]");
      if (cellInput) {
        const parsed = parseSpreadsheetScore(cellInput.value);
        return parsed.valid && parsed.score !== null ? formatPoints(parsed.score) : "";
      }
      return cell.dataset.spreadsheetValue ?? "";
    };
    const text = Array.from({ length: maxRow - minRow + 1 }, (_, rowIndex) =>
      Array.from({ length: maxColumn - minColumn + 1 }, (_, columnIndex) => valueAt(minRow + rowIndex, minColumn + columnIndex)).join("\t"),
    ).join("\r\n");
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
  };

  const handleSpreadsheetPaste = (event: ReactClipboardEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const input = target?.closest<HTMLInputElement>("input[data-spreadsheet-input]");
    const cell = target?.closest<HTMLElement>("[data-spreadsheet-cell]");
    const header = target?.closest<HTMLElement>("[data-spreadsheet-column-header]");
    const selection = spreadsheetSelectionRef.current;
    const clipboardText = event.clipboardData.getData("text/plain");
    if (!clipboardText || (!input && !cell && !header && !selection)) return;

    const matrix = parseClipboardMatrix(clipboardText);
    const hasMultipleValues = matrix.length > 1 || matrix.some((row) => row.length > 1);
    const selectionSpansMultipleCells = selection !== null && (
      selection.anchorRow !== selection.focusRow || selection.anchorColumn !== selection.focusColumn
    );
    const containsDecimalComma = matrix.some((row) => row.some((value) => value.includes(",")));
    if (!hasMultipleValues && !selectionSpansMultipleCells && input && !containsDecimalComma) return;

    const targetGridId = cell?.dataset.spreadsheetGrid ?? header?.dataset.spreadsheetGrid;
    const selectionApplies = selection && (selectionSpansMultipleCells || !cell) && (!targetGridId || selection.gridId === targetGridId);
    const gridId = selectionApplies ? selection.gridId : targetGridId ?? selection?.gridId;
    if (!gridId) return;

    let startRow = cell ? Number(cell.dataset.spreadsheetRow) : 0;
    let startColumn = cell ? Number(cell.dataset.spreadsheetColumn) : 0;
    if (selectionApplies && selection) {
      startRow = Math.min(selection.anchorRow, selection.focusRow);
      startColumn = Math.min(selection.anchorColumn, selection.focusColumn);
    }
    if (!Number.isFinite(startRow) || !Number.isFinite(startColumn)) return;

    const root = gradebookRef.current;
    if (!root) return;
    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-spreadsheet-cell]"));
    let applied = 0;
    let rejected = 0;
    let firstError = "";
    matrix.forEach((rowValues, rowOffset) => rowValues.forEach((value, columnOffset) => {
      const destination = cells.find((item) => item.dataset.spreadsheetGrid === gridId
        && Number(item.dataset.spreadsheetRow) === startRow + rowOffset
        && Number(item.dataset.spreadsheetColumn) === startColumn + columnOffset);
      const scoreInput = destination?.querySelector<HTMLInputElement>("input[data-spreadsheet-input]");
      if (!scoreInput) return;
      const studentId = scoreInput.dataset.studentId;
      const componentId = scoreInput.dataset.componentId;
      if (!studentId || !componentId) return;
      const parsed = parseSpreadsheetScore(value);
      if (!parsed.valid) {
        rejected += 1;
        return;
      }
      const error = setStudentComponentScore(studentId, componentId, parsed.score);
      if (error) {
        rejected += 1;
        firstError ||= error;
      } else {
        applied += 1;
      }
    }));
    event.preventDefault();
    if (rejected > 0) {
      toast.error(`${rejected} célula(s) não foram coladas. ${firstError || "Use apenas notas numéricas."}`);
    } else if (applied > 1) {
      toast.success(`${applied} notas coladas.`);
    }
  };
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

  const renderBranchTable = (block: typeof EVALUATION_BLOCKS[number], component: EvaluationComponent) => {
    if (component.kind === "activities") {
      return (
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
          renderStudentSearch={renderStudentSearch}
        />
      );
    }

    const gridId = `branch-${turma.id}-${term}-${component.id}`;
    return (
      <div className="gradebook-search-panel overflow-clip rounded-table border border-border bg-card">
        <div className="gradebook-search-toolbar flex flex-wrap items-center justify-between gap-1.5 border-b border-border bg-card px-2.5 py-1 sm:flex-nowrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand">{component.name}</h3>
            <p className="text-xs leading-tight text-muted-foreground">
              {component.maxPoints === null ? "Sem limite de pontuação" : "Limite de " + formatPoints(component.maxPoints) + " pontos"}
              {" · Selecione células e use Ctrl+C/Ctrl+V"}
            </p>
          </div>
          <div className="min-w-0 shrink-0 max-sm:w-full">{renderStudentSearch("gradebook")}</div>
        </div>
        <div className="gradebook-table-scroll" role="region" aria-label={"Planilha de " + component.name} tabIndex={0}>
          <table className="school-table gradebook-table gradebook-branch min-w-full">
            <thead><tr>
              <th className="w-[42%] min-w-[140px]">
                <button type="button" className="w-full text-left" data-spreadsheet-column-header="true" data-spreadsheet-grid={gridId} data-spreadsheet-column={0} data-spreadsheet-row-count={students.length} title="Selecionar a coluna de alunos">Aluno</button>
              </th>
              <th className="text-center">
                <button type="button" className="w-full text-center" data-spreadsheet-column-header="true" data-spreadsheet-grid={gridId} data-spreadsheet-column={1} data-spreadsheet-row-count={students.length} title="Selecionar todas as notas desta ramificação">Nota</button>
              </th>
            </tr></thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={2} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
              ) : students.map((student, rowIndex) => {
                const score = componentScore(student.id, component);
                return <tr key={student.id}>
                  <td
                    {...spreadsheetCellAttributes(gridId, rowIndex, 0, student.name)}
                    className={`whitespace-nowrap font-medium`}
                  >{student.name}</td>
                  <td
                    {...spreadsheetCellAttributes(gridId, rowIndex, 1, score == null ? "" : formatPoints(score))}
                    className={`text-center`}
                  >
                    <div className="mx-auto flex max-w-40 items-center justify-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={component.maxPoints ?? undefined}
                        step="0.01"
                        inputMode="decimal"
                        aria-label={student.name + " — " + block.label + " — " + component.name}
                        value={score ?? ""}
                        placeholder="—"
                        data-spreadsheet-input="true"
                        data-student-id={student.id}
                        data-component-id={component.id}
                        onChange={(event) => handleScoreChange(student.id, component, event.currentTarget.value)}
                        className="gradebook-score w-24 max-w-full"
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
  };

  const renderBlockDetailSheet = (block: typeof EVALUATION_BLOCKS[number] & { components: EvaluationComponent[] }) => {
    const gridId = `block-${turma.id}-${term}-${block.id}`;
    return (
    <details className="group overflow-clip rounded-table border border-border bg-card">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 px-2.5 py-1 transition hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-cell bg-primary/10 text-primary"><Table2 size={14} /></span>
        <span className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-brand">Planilha completa — {block.id === "PE" ? "Pontuação extra (P.E.)" : block.label}</span>
          <span className="ml-2 hidden text-xs text-muted-foreground lg:inline">Expanda para editar e copiar várias ramificações.</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-2">
        <div className="gradebook-table-scroll rounded-table border border-border" role="region" aria-label={"Planilha completa de " + block.label} tabIndex={0}>
          <table className="school-table gradebook-table min-w-full">
            <thead><tr>
              <th>
                <button type="button" className="w-full text-left" data-spreadsheet-column-header="true" data-spreadsheet-grid={gridId} data-spreadsheet-column={0} data-spreadsheet-row-count={students.length} title="Selecionar a coluna de alunos">Aluno</button>
              </th>
              {block.components.map((component, componentIndex) => <th key={component.id} className="text-center">
                <button type="button" className="w-full text-center" data-spreadsheet-column-header="true" data-spreadsheet-grid={gridId} data-spreadsheet-column={componentIndex + 1} data-spreadsheet-row-count={students.length} title={`Selecionar a coluna ${component.name}`}>
                  <span className="block">{component.name}</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case opacity-75">{component.kind === "activities" ? "calculada" : component.maxPoints === null ? "sem limite" : "até " + formatPoints(component.maxPoints) + " pts"}</span>
                </button>
              </th>)}
              <th className="text-center">
                <button type="button" className="w-full text-center" data-spreadsheet-column-header="true" data-spreadsheet-grid={gridId} data-spreadsheet-column={block.components.length + 1} data-spreadsheet-row-count={students.length} title="Selecionar a coluna dos totais">Total {block.label}</button>
              </th>
            </tr></thead>
            <tbody>{students.length === 0 ? (
              <tr><td colSpan={block.components.length + 2} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
            ) : students.map((student, rowIndex) => <tr key={student.id}>
              <td
                {...spreadsheetCellAttributes(gridId, rowIndex, 0, student.name)}
                className={`whitespace-nowrap font-medium`}
              >{student.name}</td>
              {block.components.map((component, componentIndex) => {
                const score = componentScore(student.id, component);
                const gridColumn = componentIndex + 1;
                const scoreValue = score == null ? "" : formatPoints(score);
                return <td
                  key={component.id}
                  {...spreadsheetCellAttributes(gridId, rowIndex, gridColumn, scoreValue)}
                  data-grade-kind={component.kind === "activities" ? "calculated" : "editable"}
                  className="text-center"
                >
                  {component.kind === "activities" ? (
                    scoreValue || <span className="text-muted-foreground">—</span>
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
                      data-spreadsheet-input="true"
                      data-student-id={student.id}
                      data-component-id={component.id}
                      onChange={(event) => handleScoreChange(student.id, component, event.currentTarget.value)}
                      className="gradebook-score w-24"
                    />
                  )}
                </td>;
              })}
              <td
                {...spreadsheetCellAttributes(gridId, rowIndex, block.components.length + 1, formatPoints(gradesByStudent.get(student.id)!.blockTotals[block.id]))}
                data-grade-kind="total"
                className="text-center font-semibold"
              >{formatPoints(gradesByStudent.get(student.id)!.blockTotals[block.id])}{block.maxPoints === null ? "" : " / 20"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Clique no título de uma coluna ou arraste pelas células. Use Ctrl+C para copiar e Ctrl+V para colar; atividades e totais calculados não são editáveis.</p>
      </div>
    </details>
    );
  };

  const overviewGridId = `overview-${turma.id}-${term}`;

  return (
    <section
      ref={gradebookRef}
      onMouseDown={handleSpreadsheetMouseDown}
      onMouseOver={handleSpreadsheetMouseOver}
      onMouseUp={() => { spreadsheetDragging.current = false; }}
      onClick={handleSpreadsheetColumnClick}
      onCopy={handleSpreadsheetCopy}
      onPaste={handleSpreadsheetPaste}
      className="section-card gradebook-workspace min-w-0 overflow-clip"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-2.5 py-1.5 sm:px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-surface-active text-action"><Calculator size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-brand">Notas de {turma.name}</div>
          <div className="text-xs leading-tight text-muted-foreground">{getTermLabel(term)} · cinco avaliações de até 20 pontos e pontuação extra</div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button onClick={openConfiguration} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-button sm:min-h-8 border border-input bg-card px-2.5 py-1 text-xs font-semibold transition hover:bg-muted sm:flex-none">
            <Settings2 size={14} /> Configurar divisões
          </button>
          <button onClick={exportWorkbook} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-button sm:min-h-8 bg-action px-2.5 py-1 text-xs font-semibold text-action-foreground transition hover:bg-action/90 sm:flex-none">
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>
      <div className="p-2">
        <Tabs defaultValue="overview" onValueChange={onActiveTabChange} className="space-y-1.5">
          <div className="nav-scroll min-w-0 overflow-x-auto">
            <TabsList aria-label="Blocos de notas" className="inline-flex h-auto min-w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground sm:min-w-0">
              <TabsTrigger value="overview" className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-3 text-xs hover:bg-muted/60 focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-action data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-action data-[state=active]:shadow-none sm:min-h-[var(--height-navigation)] sm:text-sm">Geral</TabsTrigger>
              {componentsByBlock.map((block) => <TabsTrigger key={block.id} value={block.id} className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-3 text-xs hover:bg-muted/60 focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-action data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-action data-[state=active]:shadow-none sm:min-h-[var(--height-navigation)] sm:text-sm">{block.id === "PE" ? "Pontuação extra" : block.label}</TabsTrigger>)}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-1.5">
            <div className="overflow-clip rounded-table border border-border bg-card">
              <div className="flex flex-wrap items-center gap-x-3 border-b border-border px-2.5 py-1.5">
                <h3 className="text-sm font-semibold text-brand">Resumo geral das notas</h3>
                <p className="text-xs text-muted-foreground">Selecione células ou colunas e use Ctrl+C para copiar. Valores calculados.</p>
              </div>
              <div className="gradebook-table-scroll gradebook-overview-scroll" role="region" aria-label="Planilha geral de notas" tabIndex={0}>
                <table className="school-table gradebook-table min-w-full">
                  <thead><tr>
                    <th><button type="button" className="w-full text-left" data-spreadsheet-column-header="true" data-spreadsheet-grid={overviewGridId} data-spreadsheet-column={0} data-spreadsheet-row-count={students.length} title="Selecionar a coluna de alunos">Aluno</button></th>
                    {componentsByBlock.map((block, blockIndex) => <th key={block.id} className="text-center">
                      <button type="button" className="w-full text-center" data-spreadsheet-column-header="true" data-spreadsheet-grid={overviewGridId} data-spreadsheet-column={blockIndex + 1} data-spreadsheet-row-count={students.length} title={`Selecionar a coluna ${block.label}`}>
                        {block.label}<span className="mt-0.5 block text-[10px] font-normal normal-case opacity-75">{block.maxPoints === null ? "extra" : "/ 20"}</span>
                      </button>
                    </th>)}
                    <th className="text-center"><button type="button" className="w-full text-center" data-spreadsheet-column-header="true" data-spreadsheet-grid={overviewGridId} data-spreadsheet-column={componentsByBlock.length + 1} data-spreadsheet-row-count={students.length} title="Selecionar a coluna da nota final">Nota final</button></th>
                  </tr></thead>
                  <tbody>{students.length === 0 ? (
                    <tr><td colSpan={componentsByBlock.length + 2} className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</td></tr>
                  ) : students.map((student, rowIndex) => {
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
                          <td
                            {...spreadsheetCellAttributes(overviewGridId, rowIndex, 0, student.name)}
                            className={`min-w-[220px] font-medium`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="whitespace-nowrap">{student.name}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100"
                                    title={`Ações de ${student.name}`}
                                    aria-label={`Ações de ${student.name}`}
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                  <DropdownMenuItem
                                    disabled={data.turmas.length < 2}
                                    onSelect={() => setStudentToTransfer(student)}
                                  >
                                    <ArrowLeftRight size={14} className="mr-2" />Transferir para outra turma
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => {
                                      const activityCount = data.activityRecords.filter((record) => record.studentId === student.id).length;
                                      const scoreCount = data.componentScores.filter((score) => score.studentId === student.id).length;
                                      if (window.confirm(`Excluir ${student.name}? Serão apagados ${activityCount} registro(s) de atividade e ${scoreCount} nota(s), incluindo o histórico. Essa ação não pode ser desfeita.`)) removeStudent(student.id);
                                    }}
                                  >
                                    <Trash2 size={14} className="mr-2" />Excluir aluno
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                          {componentsByBlock.map((block, blockIndex) => {
                            const belowAverage = block.id !== "PE" && summary.blockTotals[block.id] < 14;
                            return <td
                              key={block.id}
                              {...spreadsheetCellAttributes(overviewGridId, rowIndex, blockIndex + 1, formatPoints(summary.blockTotals[block.id]))}
                              data-grade-kind="calculated"
                              className={`text-center font-medium ${belowAverage ? "font-semibold text-status-low-grade" : ""}`}
                              title={belowAverage ? "Abaixo da média de 14 pontos neste bloco" : undefined}
                            >
                              {formatPoints(summary.blockTotals[block.id])}
                            </td>;
                          })}
                          <td
                            {...spreadsheetCellAttributes(overviewGridId, rowIndex, componentsByBlock.length + 1, formatPoints(summary.finalTotal))}
                            data-grade-kind="total"
                            className="text-center"
                          >
                            <span
                              className={`inline-flex min-w-14 justify-center rounded-cell px-2 py-0.5 font-semibold ${summary.finalTotal < 70 ? "bg-status-low-grade-bg text-status-low-grade" : "text-brand"}`}
                              title={summary.finalTotal < 70 ? "Nota final abaixo da média de 70 pontos" : undefined}
                            >
                              {formatPoints(summary.finalTotal)}
                            </span>
                          </td>
                        </tr>
                        {historyExpanded && (
                          <tr>
                            <td colSpan={componentsByBlock.length + 2} className="bg-muted/20 p-3 sm:p-4">
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
            <TabsContent key={block.id} value={block.id} className="mt-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1 px-1">
                <div className="flex items-baseline gap-2"><h2 className="text-sm font-semibold text-brand">{block.id === "PE" ? "Pontuação extra" : block.label}</h2><span className="text-xs text-muted-foreground">Bloco de avaliação</span></div>
                <span className="text-xs text-muted-foreground">{block.components.length} subramificação(ões)</span>
              </div>

              {renderBlockDetailSheet(block)}

              <Tabs key={block.id + "-" + block.components.map((component) => component.id).join("-")} defaultValue={block.components[0]?.id} className="space-y-1.5">
                <div className="nav-scroll min-w-0 overflow-x-auto">
                  <TabsList aria-label={"Ramificações de " + block.label} className="inline-flex h-auto min-w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground sm:min-w-0">
                    {block.components.map((component) => <TabsTrigger key={component.id} value={component.id} className="min-h-11 max-w-64 shrink-0 gap-2 rounded-none border-b-2 border-transparent px-3 text-xs hover:bg-muted/60 focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-action data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-action data-[state=active]:shadow-none sm:min-h-[var(--height-navigation)] sm:text-sm"><span className="truncate">{component.name}</span>{component.kind === "activities" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">automática</span>}</TabsTrigger>)}
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
                          className="min-w-0 rounded-md border border-input bg-card px-2 py-1.5 text-sm"
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
                            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
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
                            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
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
            <button onClick={() => setConfigOpen(false)} className="min-h-11 rounded-button border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted sm:min-h-9">Cancelar</button>
            <button onClick={saveConfiguration} className="min-h-11 rounded-button px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:min-h-9 bg-action">Salvar divisões</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
