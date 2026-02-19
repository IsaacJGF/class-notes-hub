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
}

export interface SchoolData {
  students: Student[];
  turmas: Turma[];
  activities: Activity[];
  attendanceRecords: AttendanceRecord[];
  activityRecords: ActivityRecord[];
}
