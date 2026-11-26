import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AcademicTerm, Activity, ActivityRecord, EvaluationComponent, SchoolData, Turma } from "@/types";
import { Search, UserPlus, X } from "lucide-react";
import { matchesAccentAware } from "@/lib/textSearch";
import { Gradebook } from "@/components/Gradebook";
import { getTermActivities, getTermLabel, type ActivityChanges } from "@/lib/academicTerms";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  turma: Turma;
  data: SchoolData;
  selectedTerm: AcademicTerm;
  addStudent: (name: string, turmaId: string) => void;
  removeStudent: (id: string) => void;
  transferStudent: (studentId: string, targetTurmaId: string) => void;
  setStudentComponentScore: (studentId: string, componentId: string, score: number | null) => string | null;
  saveEvaluationConfiguration: (turmaId: string, term: AcademicTerm, components: EvaluationComponent[]) => string | null;
  addActivity: (turmaId: string, name: string, date: string, term: AcademicTerm, deadline?: string) => Activity;
  removeActivity: (id: string) => void;
  updateActivity: (id: string, changes: ActivityChanges) => void;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecordFull: (studentId: string, activityId: string) => ActivityRecord | null;
  setActivityOnTimeOverride: (studentId: string, activityId: string, override: boolean) => void;
}

export function TurmaTab({
  turma,
  data,
  selectedTerm,
  addStudent,
  removeStudent,
  transferStudent,
  setStudentComponentScore,
  saveEvaluationConfiguration,
  addActivity,
  removeActivity,
  updateActivity,
  toggleActivityRecord,
  getActivityRecordFull,
  setActivityOnTimeOverride,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [activeGradebookTab, setActiveGradebookTab] = useState("overview");
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusAndSelectSearchInput = () => {
    setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
      const bounds = input.getBoundingClientRect();
      // Geral keeps its original header search. If the field is genuinely outside the
      // viewport (e.g. another scroll container), reveal it rather than focus invisibly.
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      }
    }, 50);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
        event.preventDefault();
        setShowSearch(true);
        focusAndSelectSearchInput();
      }
      if (event.key === "Escape" && showSearch) {
        if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  const allTurmaStudents = useMemo(
    () => data.students
      .filter((student) => student.turma === turma.name)
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        return studentSortOrder === "asc" ? comparison : -comparison;
      }),
    [data.students, turma.name, studentSortOrder],
  );
  const visibleStudentCount = useMemo(
    () => searchQuery.trim()
      ? allTurmaStudents.filter((student) => matchesAccentAware(student.name, searchQuery)).length
      : allTurmaStudents.length,
    [allTurmaStudents, searchQuery],
  );
  const turmaActivities = useMemo(
    () => getTermActivities(data.activities, turma.id, selectedTerm),
    [data.activities, turma.id, selectedTerm],
  );

  const renderStudentSearch = (placement: "header" | "gradebook") => showSearch ? (
    <div className={`flex min-w-0 items-center gap-1 rounded-button border border-input bg-card px-2 focus-within:ring-2 focus-within:ring-ring/40 ${placement === "header" ? "flex-1 sm:w-[260px]" : "w-full sm:w-56"}`}>
      <Search size={14} className="shrink-0 text-muted-foreground" />
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Pesquisar aluno..."
        className="min-h-9 w-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:min-h-8"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        aria-label="Pesquisar aluno"
      />
      {searchQuery && <span className="mr-1 shrink-0 text-xs text-muted-foreground">{visibleStudentCount}/{allTurmaStudents.length}</span>}
      <button
        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
        className="flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-button p-1 text-muted-foreground hover:bg-muted sm:min-h-8 sm:min-w-8"
        aria-label="Fechar pesquisa"
      >
        <X size={14} />
      </button>
    </div>
  ) : (
    <button
      onClick={() => { setShowSearch(true); focusAndSelectSearchInput(); }}
      className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-button border border-input bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:min-h-8 ${placement === "gradebook" ? "w-full sm:w-auto" : ""}`}
      title="Pesquisar (Ctrl+F)"
    >
      <Search size={12} /> Pesquisar
    </button>
  );

  const handleAddStudent = (event: FormEvent) => {
    event.preventDefault();
    if (!newStudentName.trim()) return;
    addStudent(newStudentName.trim(), turma.id);
    setNewStudentName("");
    setAddStudentDialogOpen(false);
  };

  return (
    <div className="min-w-0 space-y-2 p-2 sm:space-y-3 sm:p-3">
      <div className="class-context flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            className="rounded-button bg-surface-active px-2.5 py-1 text-sm font-semibold text-brand [overflow-wrap:anywhere]"
          >
            {turma.name}
          </div>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {allTurmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s) · {getTermLabel(selectedTerm)}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
          <button
            onClick={() => setStudentSortOrder((previous) => previous === "asc" ? "desc" : "asc")}
            className="min-h-11 shrink-0 touch-manipulation rounded-button border border-input bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:min-h-8"
            title="Alternar ordem alfabética"
          >
            {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
          </button>
          {activeGradebookTab === "overview" && renderStudentSearch("header")}
          <button
            onClick={() => setAddStudentDialogOpen(true)}
            className="flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-button bg-action px-3 py-1 text-xs font-semibold text-action-foreground hover:bg-action/90 sm:min-h-8"
          >
            <UserPlus size={14} />Adicionar aluno
          </button>
        </div>
      </div>

      <Gradebook
        turma={turma}
        term={selectedTerm}
        data={data}
        removeStudent={removeStudent}
        transferStudent={transferStudent}
        searchQuery={searchQuery}
        studentSortOrder={studentSortOrder}
        activeTab={activeGradebookTab}
        onActiveTabChange={setActiveGradebookTab}
        renderStudentSearch={renderStudentSearch}
        setStudentComponentScore={setStudentComponentScore}
        saveEvaluationConfiguration={saveEvaluationConfiguration}
        addActivity={addActivity}
        updateActivity={updateActivity}
        removeActivity={removeActivity}
        toggleActivityRecord={toggleActivityRecord}
        getActivityRecordFull={getActivityRecordFull}
        setActivityOnTimeOverride={setActivityOnTimeOverride}
      />

      <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar aluno à turma {turma.name}</DialogTitle>
            <DialogDescription>O aluno será incluído diretamente nesta turma. As atividades já cadastradas aparecerão como pendentes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={newStudentName}
              onChange={(event) => setNewStudentName(event.currentTarget.value)}
              placeholder="Nome completo do aluno"
              aria-label="Nome do novo aluno"
              className="min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <DialogFooter>
              <button type="button" onClick={() => setAddStudentDialogOpen(false)} className="min-h-10 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={!newStudentName.trim()} className="min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ backgroundColor: "hsl(var(--primary))" }}>Adicionar aluno</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
