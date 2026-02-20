import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, CheckCircle, AlertTriangle, Info, Download } from "lucide-react";
import { SchoolData, Turma } from "@/types";

interface ParsedRow {
  nome: string;
  turma: string;
  valid: boolean;
  error?: string;
}

interface Props {
  data: SchoolData;
  addStudent: (name: string, turmaId: string) => void;
  addTurma: (name: string) => Turma | null;
  onClose: () => void;
}

const CSV_MANUAL = `Como montar seu arquivo CSV:

Formato obrigatório — duas colunas:
  nome,turma

Regras:
• A primeira linha deve ser o cabeçalho: nome,turma
• Uma linha por aluno
• Separador: vírgula (,)
• Codificação: UTF-8
• Turmas novas serão criadas automaticamente
• Turmas já existentes serão reutilizadas

Exemplo:
nome,turma
Ana Souza,3A
Carlos Lima,3A
Beatriz Oliveira,2B
Pedro Ferreira,2B`;

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const nomeIdx = header.indexOf("nome");
  const turmaIdx = header.indexOf("turma");

  if (nomeIdx === -1 || turmaIdx === -1) {
    return [
      {
        nome: "",
        turma: "",
        valid: false,
        error: 'Cabeçalho inválido. A primeira linha deve conter "nome" e "turma".',
      },
    ];
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const nome = cols[nomeIdx] ?? "";
    const turma = cols[turmaIdx] ?? "";

    if (!nome) return { nome, turma, valid: false, error: "Nome em branco" };
    if (!turma) return { nome, turma, valid: false, error: "Turma em branco" };

    return { nome, turma, valid: true };
  });
}

function downloadSampleCSV() {
  const content = "nome,turma\nAna Souza,3A\nCarlos Lima,3A\nBeatriz Oliveira,2B\nPedro Ferreira,2B";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_alunos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImportModal({ data, addStudent, addTurma, onClose }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [tab, setTab] = useState<"import" | "manual">("import");
  const [imported, setImported] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setImported(false);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) handleFile(file);
  };

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const handleImport = () => {
    const turmaMap = new Map<string, string>();
    data.turmas.forEach((t) => turmaMap.set(t.name.toLowerCase(), t.id));

    let added = 0;

    for (const row of validRows) {
      const turmaName = row.turma.trim();
      const key = turmaName.toLowerCase();
      let turmaId = turmaMap.get(key);

      if (!turmaId) {
        const createdTurma = addTurma(turmaName);
        if (!createdTurma) continue;
        turmaId = createdTurma.id;
        turmaMap.set(key, turmaId);
      }

      addStudent(row.nome.trim(), turmaId);
      added++;
    }

    setImportCount(added);
    setImported(true);
  };

  const hasHeaderError = rows.length === 1 && !rows[0].valid && rows[0].nome === "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-xl shadow-2xl"
        style={{ backgroundColor: "hsl(var(--card))", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-xl px-5 py-4 border-b"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="flex items-center gap-2">
            <Upload size={18} style={{ color: "hsl(var(--primary))" }} />
            <h2 className="text-base font-bold" style={{ color: "hsl(var(--foreground))" }}>
              Importar Alunos via CSV
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:opacity-60 transition-opacity">
            <X size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div
          className="flex border-b"
          style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
        >
          {(["import", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-medium transition-colors"
              style={
                tab === t
                  ? { color: "hsl(var(--primary))", borderBottom: "2px solid hsl(var(--primary))", backgroundColor: "hsl(var(--card))" }
                  : { color: "hsl(var(--muted-foreground))", borderBottom: "2px solid transparent" }
              }
            >
              {t === "import" ? "📂 Importar" : "📖 Manual do CSV"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "manual" ? (
            <div className="space-y-4">
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
              >
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                  {CSV_MANUAL}
                </pre>
              </div>
              <button
                onClick={downloadSampleCSV}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary))",
                  backgroundColor: "hsl(var(--primary) / 0.08)",
                }}
              >
                <Download size={15} />
                Baixar Arquivo Modelo (.csv)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Drop zone */}
              {!imported && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors"
                  style={{
                    borderColor: dragOver ? "hsl(var(--primary))" : "hsl(var(--border))",
                    backgroundColor: dragOver ? "hsl(var(--primary) / 0.06)" : "hsl(var(--muted))",
                  }}
                >
                  <FileText size={36} style={{ color: "hsl(var(--primary))" }} />
                  <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    Arraste um arquivo CSV aqui ou clique para selecionar
                  </p>
                  <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Apenas arquivos .csv — UTF-8
                  </p>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
                </div>
              )}

              {/* Success */}
              {imported && (
                <div
                  className="flex items-center gap-3 rounded-lg border p-4"
                  style={{ borderColor: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.08)" }}
                >
                  <CheckCircle size={22} style={{ color: "hsl(var(--primary))" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>
                      {importCount} aluno{importCount !== 1 ? "s" : ""} importado{importCount !== 1 ? "s" : ""} com sucesso!
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Turmas novas também foram criadas automaticamente.
                    </p>
                  </div>
                </div>
              )}

              {/* Header error */}
              {hasHeaderError && (
                <div
                  className="flex items-start gap-3 rounded-lg border p-4"
                  style={{ borderColor: "hsl(var(--destructive))", backgroundColor: "hsl(var(--destructive) / 0.08)" }}
                >
                  <AlertTriangle size={18} style={{ color: "hsl(var(--destructive))" }} />
                  <p className="text-sm" style={{ color: "hsl(var(--destructive))" }}>{rows[0].error}</p>
                </div>
              )}

              {/* Preview table */}
              {!hasHeaderError && rows.length > 0 && !imported && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                      Prévia — {fileName}
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                        ✓ {validRows.length} válidos
                      </span>
                      {invalidRows.length > 0 && (
                        <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}>
                          ✗ {invalidRows.length} com erro
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "hsl(var(--border))" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "hsl(var(--muted))" }}>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Nome</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Turma</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              backgroundColor: row.valid ? undefined : "hsl(var(--destructive) / 0.06)",
                              borderTop: "1px solid hsl(var(--border))",
                            }}
                          >
                            <td className="px-3 py-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{i + 1}</td>
                            <td className="px-3 py-2 font-medium" style={{ color: "hsl(var(--foreground))" }}>{row.nome || "—"}</td>
                            <td className="px-3 py-2" style={{ color: "hsl(var(--foreground))" }}>{row.turma || "—"}</td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>✓ OK</span>
                              ) : (
                                <span className="text-xs" style={{ color: "hsl(var(--destructive))" }}>✗ {row.error}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invalidRows.length > 0 && (
                    <div
                      className="mt-2 flex items-start gap-2 rounded-lg border p-3"
                      style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
                    >
                      <Info size={14} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Linhas com erro serão ignoradas na importação. Corrija o CSV e reimporte se necessário.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "import" && !imported && (
          <div
            className="flex items-center justify-between gap-3 rounded-b-xl border-t px-5 py-4"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <button
              onClick={() => setTab("manual")}
              className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <Info size={13} /> Ver manual do CSV
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <Upload size={15} />
                Importar {validRows.length > 0 ? `${validRows.length} aluno${validRows.length !== 1 ? "s" : ""}` : ""}
              </button>
            </div>
          </div>
        )}

        {imported && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t px-5 py-4" style={{ borderColor: "hsl(var(--border))" }}>
            <button
              onClick={() => { setRows([]); setFileName(""); setImported(false); }}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              Importar outro arquivo
            </button>
            <button
              onClick={onClose}
              className="rounded-lg px-5 py-2 text-sm font-semibold"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
