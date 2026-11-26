import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Student, Turma } from "@/types";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  student: Student | null;
  turmas: Turma[];
  onOpenChange: (open: boolean) => void;
  onTransfer: (studentId: string, targetTurmaId: string) => void;
}

export function TransferStudentDialog({ open, student, turmas, onOpenChange, onTransfer }: Props) {
  const availableTurmas = useMemo(
    () => turmas.filter((turma) => turma.name !== student?.turma),
    [turmas, student?.turma],
  );
  const [targetTurmaId, setTargetTurmaId] = useState("");

  useEffect(() => {
    if (open) setTargetTurmaId(availableTurmas[0]?.id ?? "");
  }, [open, student?.id, availableTurmas]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!student || !targetTurmaId) return;
    onTransfer(student.id, targetTurmaId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-primary" />
            Transferir aluno
          </DialogTitle>
          <DialogDescription>
            {student ? `${student.name} está atualmente na turma ${student.turma}.` : "Selecione a turma de destino."}
            {" "}Os registros de atividades da turma anterior serão mantidos no histórico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {availableTurmas.length > 0 ? (
            <label className="block space-y-1.5 text-sm font-medium">
              Turma de destino
              <select
                autoFocus
                value={targetTurmaId}
                onChange={(event) => setTargetTurmaId(event.currentTarget.value)}
                className="min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {availableTurmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
              </select>
            </label>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Cadastre outra turma antes de transferir este aluno.
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-button border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted sm:min-h-9"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!student || !targetTurmaId}
              className="min-h-11 rounded-button px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:min-h-9"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            >
              Transferir
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
