export type AcademicTerm = 1 | 2 | 3;
export type EvaluationBlockId = "AEP" | "AL" | "AV" | "AG" | "TESTE" | "PE";
export type EvaluationComponentKind = "activities" | "manual";

export interface Student {
  id: string;
  name: string;
  turma: string;
  createdAt: string;
}

export interface Turma {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  turmaId: string;
  name: string;
  date: string; // YYYY-MM-DD
  term: AcademicTerm;
  deadline?: string; // YYYY-MM-DD — prazo final para entrega (opcional)
  createdAt: string;
}

export interface TermSettings {
  turmaId: string;
  term: AcademicTerm;
  totalPoints: number;
}

export interface ActivityRecord {
  id: string;
  studentId: string;
  activityId: string;
  done: boolean;
  markedAt?: string; // YYYY-MM-DD — data em que foi marcado como feito
  overrideOnTime?: boolean; // se true, professor forçou "no prazo" mesmo se markedAt > deadline
}

export interface SchoolData {
  schemaVersion: number;
  students: Student[];
  turmas: Turma[];
  activities: Activity[];
  activityRecords: ActivityRecord[];
  termSettings: TermSettings[];
  studentExtraPoints: StudentExtraPoints[];
  evaluationComponents: EvaluationComponent[];
  componentScores: StudentComponentScore[];
}

export interface StudentExtraPoints {
  studentId: string;
  term: AcademicTerm;
  points: number;
}

export interface EvaluationComponent {
  id: string;
  turmaId: string;
  term: AcademicTerm;
  blockId: EvaluationBlockId;
  name: string;
  /** null means that the component has no individual maximum (used by P.E.). */
  maxPoints: number | null;
  kind: EvaluationComponentKind;
  order: number;
}

export interface StudentComponentScore {
  studentId: string;
  componentId: string;
  score: number;
}
