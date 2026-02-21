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
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  present: boolean;
}

export interface ActivityRecord {
  id: string;
  studentId: string;
  activityId: string;
  done: boolean;
  bonusTag?: "yellow" | "green" | null;
}

export interface MinTask {
  id: string;
  turmaId: string;
  name: string;
  date: string; // YYYY-MM-DD
  totalQuestions: number;
  createdAt: string;
}

export interface MinTaskRecord {
  id: string;
  studentId: string;
  minTaskId: string;
  questionsDone: number;
}

export interface SchoolData {
  students: Student[];
  turmas: Turma[];
  activities: Activity[];
  attendanceRecords: AttendanceRecord[];
  activityRecords: ActivityRecord[];
  minTasks: MinTask[];
  minTaskRecords: MinTaskRecord[];
}
