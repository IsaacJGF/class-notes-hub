import { useRef, useState } from "react";
import { SchoolData, Turma } from "@/types";
import { UserPlus, Trash2, GraduationCap, BookOpen, Upload, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { CsvImportModal } from "@/components/CsvImportModal";

interface Props {
  data: SchoolData;
  addStudent: (name: string, turmaId: string) => void;
  removeStudent: (id: string) => void;
  addTurma: (name: string) => Turma | null;
  removeTurma: (id: string) => void;
  exportToJson: () => string;
  exportToCsv: () => string;
  importFromJson: (rawJson: string) => void;
  importFromCsv: (rawCsv: string) => void;
}

export function StudentRegistration({
  data,
  addStudent,
  removeStudent,
  addTurma,
  removeTurma,
  exportToJson,
  exportToCsv,
  importFromJson,
  importFromCsv,
}: Props) {
  const [studentName, setStudentName] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [newTurmaName, setNewTurmaName] = useState("");
  const [turmaError, setTurmaError] = useState("");
  const [filterTurma, setFilterTurma] = useState("all");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [dataTransferMessage, setDataTransferMessage] = useState("");
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !selectedTurmaId) return;
    addStudent(studentName.trim(), selectedTurmaId);
    setStudentName("");
  };

  const handleAddTurma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTurmaName.trim()) return;
    const ok = addTurma(newTurmaName.trim());
    if (!ok) {
      setTurmaError("Turma já existe.");
      return;
    }
    setTurmaError("");
    setNewTurmaName("");
  };

  const filtered = filterTurma === "all"
    ? data.students
    : data.students.filter((s) => s.turma === filterTurma);


  const downloadBackupFile = (content: string, extension: "json" | "csv", type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date().toISOString().slice(0, 10);
    link.download = `diario-professor-backup-${now}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const content = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        importFromJson(content);
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        importFromCsv(content);
      } else {
        throw new Error("Formato não suportado. Use arquivos .json ou .csv.");
      }
      setDataTransferMessage("Backup restaurado com sucesso.");
    } catch {
      setDataTransferMessage("Não foi possível restaurar o backup. Verifique o arquivo selecionado.");
    }
  };

  return (
    <div className="space-y-6 p-4">
      {showCsvModal && (
        <CsvImportModal
          data={data}
          addStudent={addStudent}
          addTurma={addTurma}
          onClose={() => setShowCsvModal(false)}
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="section-card md:col-span-2">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <Download size={15} />
              Backup e Restauração
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <button
              type="button"
              onClick={() => {
                downloadBackupFile(exportToJson(), "json", "application/json");
                setDataTransferMessage("Backup JSON exportado com sucesso.");
              }}
              className="flex items-center gap-1.5 rounded border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
            >
              <FileJson size={12} />
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={() => {
                downloadBackupFile(exportToCsv(), "csv", "text/csv;charset=utf-8");
                setDataTransferMessage("Backup CSV exportado com sucesso.");
              }}
              className="flex items-center gap-1.5 rounded border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
            >
              <FileSpreadsheet size={12} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold transition-colors"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              <Upload size={12} />
              Restaurar backup
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleRestoreBackup}
            />
            {dataTransferMessage && (
              <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {dataTransferMessage}
              </p>
            )}
          </div>
        </div>

        {/* Add Turma */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <BookOpen size={15} />
              Cadastrar Turma
            </span>
          </div>
          <div className="p-4">
            <form onSubmit={handleAddTurma} className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome da turma (ex: 3A, Turma B...)"
                value={newTurmaName}
                onChange={(e) => { setNewTurmaName(e.target.value); setTurmaError(""); }}
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <UserPlus size={14} />
                Adicionar
              </button>
            </form>
            {turmaError && <p className="mt-1.5 text-xs text-destructive">{turmaError}</p>}
            {data.turmas.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Turmas cadastradas
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.turmas.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}
                    >
                      {t.name}
                      <button
                        onClick={() => removeTurma(t.id)}
                        className="ml-0.5 rounded-full p-0.5 hover:opacity-70 transition-opacity"
                        title="Remover turma"
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

        {/* Add Student */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <GraduationCap size={15} />
              Cadastrar Aluno
            </span>
          </div>
          <div className="p-4">
            <form onSubmit={handleAddStudent} className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome do aluno"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
              <select
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedTurmaId}
                onChange={(e) => setSelectedTurmaId(e.target.value)}
              >
                <option value="">Turma</option>
                {data.turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!studentName.trim() || !selectedTurmaId}
                className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <UserPlus size={14} />
                Adicionar
              </button>
            </form>
            {data.turmas.length === 0 && (
              <p className="mt-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Cadastre uma turma primeiro.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">
            Alunos Cadastrados ({filtered.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
              style={{
                borderColor: "hsl(var(--primary))",
                color: "hsl(var(--primary))",
                backgroundColor: "hsl(var(--primary) / 0.08)",
              }}
            >
              <Upload size={12} />
              Importar CSV
            </button>
            <select
              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterTurma}
              onChange={(e) => setFilterTurma(e.target.value)}
            >
              <option value="all">Todas as turmas</option>
              {data.turmas.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Nenhum aluno cadastrado.
            </div>
          ) : (
            <table className="school-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome do Aluno</th>
                  <th>Turma</th>
                  <th>Cadastrado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, idx) => (
                  <tr key={student.id}>
                    <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{idx + 1}</td>
                    <td className="font-medium">{student.name}</td>
                    <td>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: "hsl(var(--secondary))",
                          color: "hsl(var(--primary))",
                        }}
                      >
                        {student.turma}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {new Date(student.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <button
                        onClick={() => removeStudent(student.id)}
                        className="rounded p-1 transition-colors hover:opacity-70"
                        style={{ color: "hsl(var(--destructive))" }}
                        title="Remover aluno"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
