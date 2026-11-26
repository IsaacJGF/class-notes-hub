import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { SchoolData, Student, Turma } from "@/types";
import { ArrowLeftRight, BookOpen, GraduationCap, MoreHorizontal, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { CsvImportModal } from "@/components/CsvImportModal";
import { TransferStudentDialog } from "@/components/TransferStudentDialog";
import { matchesAccentAware } from "@/lib/textSearch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  data: SchoolData;
  addStudent: (name: string, turmaId: string) => void;
  removeStudent: (id: string) => void;
  transferStudent: (studentId: string, targetTurmaId: string) => void;
  addTurma: (name: string) => Turma | null;
  removeTurma: (id: string) => void;
}

export function StudentRegistration({ data, addStudent, removeStudent, transferStudent, addTurma, removeTurma }: Props) {
  const [studentName, setStudentName] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [newTurmaName, setNewTurmaName] = useState("");
  const [turmaError, setTurmaError] = useState("");
  const [filterTurma, setFilterTurma] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === "Escape" && searchQuery) setSearchQuery("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchQuery]);

  const handleAddStudent = (event: FormEvent) => {
    event.preventDefault();
    if (!studentName.trim() || !selectedTurmaId) return;
    addStudent(studentName.trim(), selectedTurmaId);
    setStudentName("");
  };

  const handleAddTurma = (event: FormEvent) => {
    event.preventDefault();
    if (!newTurmaName.trim()) return;
    const turma = addTurma(newTurmaName.trim());
    if (!turma) {
      setTurmaError("Turma já existe.");
      return;
    }
    setTurmaError("");
    setNewTurmaName("");
  };

  const filteredStudents = useMemo(() => data.students.filter((student) => {
    const matchesTurma = filterTurma === "all" || student.turma === filterTurma;
    return matchesTurma && matchesAccentAware(student.name, searchQuery);
  }), [data.students, filterTurma, searchQuery]);

  const studentGroups = useMemo(() => {
    const studentsByTurma = new Map<string, Student[]>();
    for (const student of filteredStudents) {
      const group = studentsByTurma.get(student.turma) ?? [];
      group.push(student);
      studentsByTurma.set(student.turma, group);
    }

    const classNames = filterTurma === "all"
      ? Array.from(new Set([...data.turmas.map((turma) => turma.name), ...studentsByTurma.keys()]))
      : [filterTurma];

    return classNames
      .sort((first, second) => first.localeCompare(second, "pt-BR", { sensitivity: "base" }))
      .flatMap((turma) => {
        const students = (studentsByTurma.get(turma) ?? []).sort((first, second) => {
          const comparison = first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
          return studentSortOrder === "asc" ? comparison : -comparison;
        });
        return students.length > 0 ? [{ turma, students }] : [];
      });
  }, [data.turmas, filteredStudents, filterTurma, studentSortOrder]);

  const visibleStudentCount = studentGroups.reduce((total, group) => total + group.students.length, 0);

  const handleRemoveStudent = (student: Student) => {
    const activityCount = data.activityRecords.filter((record) => record.studentId === student.id).length;
    const scoreCount = data.componentScores.filter((score) => score.studentId === student.id).length;
    const details = activityCount || scoreCount
      ? ` Também serão apagados ${activityCount} registro(s) de atividade e ${scoreCount} nota(s).`
      : "";
    if (window.confirm(`Excluir ${student.name}?${details} Essa ação não pode ser desfeita.`)) removeStudent(student.id);
  };

  return (
    <div className="space-y-4 p-2 sm:space-y-6 sm:p-4">
      {showCsvModal && (
        <CsvImportModal
          data={data}
          addStudent={addStudent}
          addTurma={addTurma}
          onClose={() => setShowCsvModal(false)}
        />
      )}
      <TransferStudentDialog
        open={studentToTransfer !== null}
        student={studentToTransfer}
        turmas={data.turmas}
        onOpenChange={(open) => { if (!open) setStudentToTransfer(null); }}
        onTransfer={transferStudent}
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2"><BookOpen size={15} />Cadastrar Turma</span>
          </div>
          <div className="p-4">
            <form onSubmit={handleAddTurma} className="flex gap-2">
              <input
                type="text"
                className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome da turma (ex: 3A, Turma B...)"
                value={newTurmaName}
                onChange={(event) => { setNewTurmaName(event.target.value); setTurmaError(""); }}
              />
              <button
                type="submit"
                className="flex shrink-0 items-center gap-1.5 rounded-button px-3 py-2 text-sm font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <UserPlus size={14} />Adicionar
              </button>
            </form>
            {turmaError && <p className="mt-1.5 text-xs text-destructive">{turmaError}</p>}
            {data.turmas.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Turmas cadastradas</p>
                <div className="flex flex-wrap gap-2">
                  {data.turmas.map((turma) => (
                    <div key={turma.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>
                      {turma.name}
                      <button
                        onClick={() => removeTurma(turma.id)}
                        className="ml-0.5 rounded-full p-0.5 transition-opacity hover:opacity-70"
                        title="Remover turma"
                        aria-label={`Remover turma ${turma.name}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2"><GraduationCap size={15} />Cadastrar Aluno</span>
          </div>
          <div className="p-4">
            <form onSubmit={handleAddStudent} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className="min-h-[40px] flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome do aluno"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
              />
              <select
                className="min-h-[40px] rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedTurmaId}
                onChange={(event) => setSelectedTurmaId(event.target.value)}
              >
                <option value="">Turma</option>
                {data.turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
              </select>
              <button
                type="submit"
                disabled={!studentName.trim() || !selectedTurmaId}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 touch-manipulation"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <UserPlus size={14} />Adicionar
              </button>
            </form>
            {data.turmas.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Cadastre uma turma primeiro.</p>}
          </div>
        </div>
      </div>

      <div className="section-card overflow-hidden">
        <div className="section-card-header flex flex-col gap-3 xl:flex-row xl:items-center">
          <span className="section-card-title shrink-0">Alunos Cadastrados ({visibleStudentCount})</span>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <label className="flex min-h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring/40 sm:flex-none">
              <Search size={14} className="shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Pesquisar aluno..."
                aria-label="Pesquisar aluno por nome"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none sm:w-44"
              />
            </label>
            <select
              className="min-h-9 rounded-md border border-input bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterTurma}
              onChange={(event) => setFilterTurma(event.target.value)}
              aria-label="Filtrar alunos por turma"
            >
              <option value="all">Todas as turmas</option>
              {data.turmas.map((turma) => <option key={turma.id} value={turma.name}>{turma.name}</option>)}
            </select>
            <button
              onClick={() => setStudentSortOrder((current) => current === "asc" ? "desc" : "asc")}
              className="min-h-9 rounded-button border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              title="Alternar ordem alfabética dos alunos"
              aria-label={studentSortOrder === "asc" ? "Ordenação A a Z; mudar para Z a A" : "Ordenação Z a A; mudar para A a Z"}
            >
              {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex min-h-9 items-center gap-1.5 rounded-button border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.08)" }}
            >
              <Upload size={12} />Importar CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {visibleStudentCount === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {searchQuery || filterTurma !== "all" ? "Nenhum aluno encontrado com esses filtros." : "Nenhum aluno cadastrado."}
            </div>
          ) : (
            <table className="school-table min-w-full">
              <thead>
                <tr><th>#</th><th>Nome do aluno</th><th>Turma</th><th>Cadastrado em</th></tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNumber = 0;
                  return studentGroups.map((group) => (
                    <Fragment key={group.turma}>
                      <tr className="bg-muted/60">
                        <td colSpan={4} className="py-2 text-xs font-bold uppercase tracking-wide text-primary">
                          {group.turma}<span className="ml-2 font-normal normal-case text-muted-foreground">{group.students.length} aluno(s)</span>
                        </td>
                      </tr>
                      {group.students.map((student) => {
                        rowNumber += 1;
                        return (
                          <tr key={student.id}>
                            <td className="text-xs text-muted-foreground">{rowNumber}</td>
                            <td className="whitespace-nowrap font-medium">
                              <div className="flex items-center gap-1.5">
                                <span>{student.name}</span>
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
                                      onSelect={() => handleRemoveStudent(student)}
                                    >
                                      <Trash2 size={14} className="mr-2" />Excluir aluno
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                            <td>
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>
                                {student.turma}
                              </span>
                            </td>
                            <td className="text-xs text-muted-foreground">{new Date(student.createdAt).toLocaleDateString("pt-BR")}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ));
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
