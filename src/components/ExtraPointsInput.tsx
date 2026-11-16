import type { AcademicTerm } from "@/types";

interface Props {
  studentId: string;
  studentName: string;
  term: AcademicTerm;
  points: number;
  onChange: (studentId: string, term: AcademicTerm, points: number) => void;
}

export function ExtraPointsInput({ studentId, studentName, term, points, onChange }: Props) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={points || ""}
      placeholder="—"
      aria-label={`Pontos extras de ${studentName} no ${term}º trimestre`}
      onChange={(event) => onChange(studentId, term, Number(event.target.value))}
      className="min-h-[44px] w-24 rounded border border-input bg-background px-2 py-2 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}