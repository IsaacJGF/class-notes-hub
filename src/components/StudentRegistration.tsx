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
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
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
    <div className="registration-workspace min-w-0 space-y-3 p-2 sm:p-3">
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

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="section-card registration-card min-w-0">
          <div className="section-card-header">
            <h2 className="section-card-title flex items-center gap-2"><BookOpen size={16} />Cadastrar Turma</h2>
          </div>
          <div className="p-3">
            <form onSubmit={handleAddTurma} aria-label="Cadastrar turma" className="flex min-w-0 gap-2">
              <input
                type="text"
                className="registration-field min-w-0 flex-1 aria-[invalid=true]:border-destructive"
                aria-label="Nome da turma"
                aria-invalid={Boolean(turmaError)}
                aria-describedby={turmaError ? "registration-turma-error" : undefined}
                placeholder="Nome da turma (ex: 3A, Turma B...)"
                value={newTurmaName}
                onChange={(event) => { setNewTurmaName(event.target.value); setTurmaError(""); }}
              />
              <button
                type="submit"
                className="registration-action shrink-0"
              >
                <UserPlus size={14} />Adicionar
              </button>
            </form>
            {turmaError && <p id="registration-turma-error" role="alert" className="mt-2 flex items-center gap-1.5 rounded-cell bg-status-low-grade-bg px-2 py-1.5 text-xs text-status-low-grade">{turmaError}</p>}
            {data.turmas.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Turmas cadastradas</p>
                <div className="flex flex-wrap gap-2">
                  {data.turmas.map((turma) => (
                    <div key={turma.id} className="flex min-w-0 items-center gap-1 rounded-button border border-border bg-surface-table py-0.5 pl-2 text-xs font-medium text-brand [overflow-wrap:anywhere]">
                      {turma.name}
                      <button
                        onClick={() => removeTurma(turma.id)}
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-status-low-grade-bg hover:text-status-low-grade"
                        title="Remover turma"
                        aria-label={`Remover turma ${turma.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="section-card registration-card min-w-0">
          <div className="section-card-header">
            <h2 className="section-card-title flex items-center gap-2"><GraduationCap size={16} />Cadastrar Aluno</h2>
          </div>
          <div className="p-3">
            <form onSubmit={handleAddStudent} aria-label="Cadastrar aluno" className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(96px,auto)_auto]">
              <input
                type="text"
                className="registration-field min-w-0"
                aria-label="Nome do aluno"
                placeholder="Nome do aluno"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
              />
              <select
                className="registration-field min-w-0 max-w-full"
                aria-label="Turma do aluno"
                value={selectedTurmaId}
                onChange={(event) => setSelectedTurmaId(event.target.value)}
              >
                <option value="">Turma</option>
                {data.turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
              </select>
              <button
                type="submit"
                disabled={!studentName.trim() || !selectedTurmaId}
                className="registration-action disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
              >
                <UserPlus size={14} />Adicionar
              </button>
            </form>
            {data.turmas.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Cadastre uma turma primeiro.</p>}
          </div>
        </div>
      </div>

      <div className="section-card registration-card min-w-0 overflow-hidden">
        <div className="section-card-header registration-list-header flex flex-col gap-2 lg:flex-row lg:items-center">
          <h2 className="section-card-title shrink-0">Alunos Cadastrados ({visibleStudentCount})</h2>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
            <label className="flex min-h-11 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring/40 sm:min-h-9 sm:basis-auto">
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
              className="registration-field min-w-0 max-w-full flex-1 text-xs sm:flex-none"
              value={filterTurma}
              onChange={(event) => setFilterTurma(event.target.value)}
              aria-label="Filtrar alunos por turma"
            >
              <option value="all">Todas as turmas</option>
              {data.turmas.map((turma) => <option key={turma.id} value={turma.name}>{turma.name}</option>)}
            </select>
            <button
              onClick={() => setStudentSortOrder((current) => current === "asc" ? "desc" : "asc")}
              className="min-h-11 rounded-button border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted sm:min-h-9"
              title="Alternar ordem alfabética dos alunos"
              aria-label={studentSortOrder === "asc" ? "Ordenação A a Z; mudar para Z a A" : "Ordenação Z a A; mudar para A a Z"}
            >
              {studentSortOrder === "asc" ? "A → Z" : "Z → A"}
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-button border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-action hover:bg-surface-active sm:min-h-9"
            >
              <Upload size={12} />Importar CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {visibleStudentCount === 0 ? (
            <div className="school-empty-state" role="status">
              <GraduationCap size={22} aria-hidden="true" />
              <p className="font-semibold text-foreground">{searchQuery || filterTurma !== "all" ? "Nenhum aluno encontrado com esses filtros." : "Nenhum aluno cadastrado."}</p>
              <p>{searchQuery || filterTurma !== "all" ? "Altere a pesquisa ou a turma selecionada." : "Use o formulário acima para cadastrar o primeiro aluno."}</p>
            </div>
          ) : (
            <table className="school-table registration-table min-w-full">
              <thead>
                <tr><th>#</th><th>Nome do aluno</th><th>Turma</th><th>Cadastrado em</th></tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNumber = 0;
                  return studentGroups.map((group) => (
                    <Fragment key={group.turma}>
                      <tr className="registration-group">
                        <td colSpan={4} className="text-xs font-semibold text-brand">
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
                              <span className="inline-block rounded-cell bg-surface-table px-2 py-0.5 text-xs font-medium text-brand">
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
