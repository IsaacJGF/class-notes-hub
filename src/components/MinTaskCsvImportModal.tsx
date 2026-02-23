import { ChangeEvent, useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Download, FileText, Info, Upload, X } from "lucide-react";
import { MinTask, Student, Turma } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  turma: Turma;
  students: Student[];
  minTasks: MinTask[];
  setMinTaskRecord: (studentId: string, minTaskId: string, questionsDone: number) => void;
}

type ParsedTable = string[][];

const MANUAL_TEXT = `Como montar seu arquivo CSV (Tarefa Mínima):

1) A primeira linha deve conter os cabeçalhos.
2) As duas primeiras colunas devem ser:
   - nome
   - turma
3) As colunas seguintes devem ser os nomes exatos das tarefas mínimas cadastradas na turma.
4) Em cada célula de tarefa, informe apenas número inteiro (questões feitas).
5) Valores fora do intervalo serão ajustados automaticamente (mínimo 0 e máximo da tarefa).

Dica:
- Use o botão "Baixar Modelo CSV" para gerar um arquivo pronto e editar nele.
- Salve em UTF-8 para evitar problemas com acentos.`;

function parseCSV(content: string): ParsedTable {
  const lines = content.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";

  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) {
        cells.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function MinTaskCsvImportModal({ open, onClose, turma, students, minTasks, setMinTaskRecord }: Props) {
  const [tab, setTab] = useState<"import" | "manual">("import");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [table, setTable] = useState<ParsedTable>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const expectedHeaders = useMemo(
    () => ["nome", "turma", ...minTasks.map((task) => task.name)],
    [minTasks]
  );

  const downloadModel = useCallback(() => {
    const headers = expectedHeaders.join(",");
    const rows = students.map((student) => {
      const taskValues = minTasks.map(() => "0");
      return [student.name, turma.name, ...taskValues].join(",");
    });

    const content = [headers, ...rows].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_tarefa_minima_${turma.name.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [expectedHeaders, minTasks, students, turma.name]);

  const resetState = () => {
    setMessage("");
    setError("");
    setFileName("");
    setTable([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const closeModal = () => {
    resetState();
    setTab("import");
    onClose();
  };

  const handleFile = useCallback(async (file: File) => {
    setMessage("");
    setError("");
    setFileName(file.name);

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length < 2) {
      setError("CSV vazio ou sem linhas de dados.");
      setTable(parsed);
      return;
    }

    setTable(parsed);
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleFile(file);
  };

  const importCsv = () => {
    setMessage("");
    setError("");

    if (minTasks.length === 0) {
      setError("Cadastre ao menos uma tarefa mínima antes de importar.");
      return;
    }

    if (table.length < 2) {
      setError("Selecione um arquivo CSV com dados.");
      return;
    }

    const [headers, ...rows] = table;
    const normalizedHeaders = headers.map((h) => normalize(h));

    const nameIndex = normalizedHeaders.indexOf("nome");
    const turmaIndex = normalizedHeaders.indexOf("turma");

    if (nameIndex === -1 || turmaIndex === -1) {
      setError("Cabeçalho inválido: as colunas 'nome' e 'turma' são obrigatórias.");
      return;
    }

    const taskColumnMap = minTasks
      .map((task) => ({
        task,
        columnIndex: headers.findIndex((header) => normalize(header) === normalize(task.name)),
      }))
      .filter((entry) => entry.columnIndex >= 0);

    if (taskColumnMap.length === 0) {
      setError("Nenhuma coluna de tarefa mínima encontrada. Use o modelo para garantir os cabeçalhos corretos.");
      return;
    }

    const studentByName = new Map(students.map((student) => [normalize(student.name), student]));

    let updatedStudents = 0;
    let updatedCells = 0;

    rows.forEach((row) => {
      const rowName = row[nameIndex] || "";
      const rowTurma = row[turmaIndex] || "";
      const student = studentByName.get(normalize(rowName));

      if (!student) return;
      if (normalize(rowTurma) !== normalize(turma.name)) return;

      let touchedRow = false;

      taskColumnMap.forEach(({ task, columnIndex }) => {
        const rawValue = row[columnIndex] ?? "";
        if (rawValue === "") return;

        const parsedValue = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsedValue)) return;

        const clampedValue = Math.max(0, Math.min(parsedValue, task.totalQuestions));
        setMinTaskRecord(student.id, task.id, clampedValue);
        touchedRow = true;
        updatedCells += 1;
      });

      if (touchedRow) updatedStudents += 1;
    });

    if (updatedCells === 0) {
      setError("Nenhum dado válido foi importado. Verifique nomes de alunos, turma e valores numéricos.");
      return;
    }

    setMessage(`Importação concluída: ${updatedStudents} aluno(s), ${updatedCells} lançamento(s) atualizados.`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
              Importar Tarefas Mínimas via CSV
            </h3>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              Turma: {turma.name}
            </p>
          </div>
          <button onClick={closeModal} className="rounded p-1 hover:opacity-70">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2" style={{ backgroundColor: "hsl(var(--muted) / 0.35)" }}>
          {(["import", "manual"] as const).map((currentTab) => (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={
                tab === currentTab
                  ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                  : { color: "hsl(var(--muted-foreground))" }
              }
            >
              {currentTab === "import" ? "📂 Importar" : "📖 Manual do CSV"}
            </button>
          ))}
        </div>

        {tab === "manual" ? (
          <div className="space-y-3 p-4">
            <div className="rounded-md border border-border bg-background p-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                {MANUAL_TEXT}
              </pre>
            </div>
            <button
              onClick={downloadModel}
              className="inline-flex items-center gap-1 rounded px-3 py-2 text-xs font-semibold"
              style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
            >
              <Download size={12} /> Baixar Modelo CSV
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--background))" }}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mx-auto mb-2" size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
              <p className="text-sm font-semibold">Selecione um arquivo CSV</p>
              <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Apenas .csv (UTF-8)</p>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
            </div>

            {fileName && (
              <div className="rounded border border-border bg-background px-3 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <FileText size={12} className="mr-1 inline" /> Arquivo: {fileName}
              </div>
            )}

            {error && (
              <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs" style={{ color: "hsl(var(--destructive))" }}>
                <AlertTriangle size={12} className="mr-1 inline" /> {error}
              </div>
            )}

            {message && (
              <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle size={12} className="mr-1 inline" /> {message}
              </div>
            )}

            <div className="rounded border border-border bg-background px-3 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Info size={12} className="mr-1 inline" />
              Dica: para evitar erros de cabeçalho, abra o manual e baixe o modelo CSV desta turma.
            </div>
          </div>
        )}

        <div className="flex justify-between border-t border-border px-4 py-3">
          <button
            onClick={() => setTab("manual")}
            className="rounded border border-border px-3 py-1.5 text-xs"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Ver manual
          </button>
          <button
            onClick={importCsv}
            disabled={tab !== "import"}
            className="rounded px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            Importar agora
          </button>
        </div>
      </div>
    </div>
  );
}
