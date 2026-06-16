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
  deadline?: string; // YYYY-MM-DD — prazo final para entrega (opcional)
  createdAt: string;
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
  students: Student[];
  turmas: Turma[];
  activities: Activity[];
  activityRecords: ActivityRecord[];
}
