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
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusAndSelectSearchInput = () => {
    setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 50);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        setShowSearch(true);
        focusAndSelectSearchInput();
      }
      if (event.key === "Escape" && showSearch) {
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

  const handleAddStudent = (event: FormEvent) => {
    event.preventDefault();
    if (!newStudentName.trim()) return;
    addStudent(newStudentName.trim(), turma.id);
    setNewStudentName("");
    setAddStudentDialogOpen(false);
  };

  return (
    <div className="space-y-3 p-2 sm:space-y-4 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="rounded-lg px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            {turma.name}
          </div>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {allTurmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s) · {getTermLabel(selectedTerm)}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => setStudentSortOrder((previous) => previous === "asc" ? "desc" : "asc")}
            className="min-h-9 touch-manipulation rounded border border-border px-2 py-1.5 text-xs font-medium hover:opacity-80"
            style={{ color: "hsl(var(--muted-foreground))" }}
            title="Alternar ordem alfabética"
          >
            {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
          </button>
          {showSearch ? (
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-border bg-background px-2 py-1 sm:flex-none">
              <Search size={14} className="shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar aluno..."
                className="w-full bg-transparent text-sm outline-none sm:w-48"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                aria-label="Pesquisar aluno"
              />
              {searchQuery && <span className="mr-1 text-xs text-muted-foreground">{visibleStudentCount}/{allTurmaStudents.length}</span>}
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                className="flex min-h-9 min-w-9 touch-manipulation items-center justify-center rounded p-1 hover:opacity-70"
                aria-label="Fechar pesquisa"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowSearch(true); focusAndSelectSearchInput(); }}
              className="flex min-h-9 touch-manipulation items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:opacity-80"
              style={{ color: "hsl(var(--muted-foreground))" }}
              title="Pesquisar (Ctrl+F)"
            >
              <Search size={12} /> Pesquisar
            </button>
          )}
          <button
            onClick={() => setAddStudentDialogOpen(true)}
            className="flex min-h-9 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
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
