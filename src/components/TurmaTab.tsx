import { useState, useMemo } from "react";
import { SchoolData, Turma, Activity } from "@/types";
import { Plus, Trash2, CheckCircle, XCircle, Circle, CalendarPlus } from "lucide-react";

interface Props {
  turma: Turma;
  data: SchoolData;
  addActivity: (turmaId: string, name: string, date: string) => Activity;
  removeActivity: (id: string) => void;
  toggleAttendance: (studentId: string, date: string) => void;
  getAttendance: (studentId: string, date: string) => boolean | null;
  toggleActivityRecord: (studentId: string, activityId: string) => void;
  getActivityRecord: (studentId: string, activityId: string) => boolean | null;
}

export function TurmaTab({
  turma,
  data,
  addActivity,
  removeActivity,
  toggleAttendance,
  getAttendance,
  toggleActivityRecord,
  getActivityRecord,
}: Props) {
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityDate, setNewActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeView, setActiveView] = useState<"chamada" | "atividades">("chamada");

  const turmaStudents = useMemo(
    () => data.students.filter((s) => s.turma === turma.name).sort((a, b) => a.name.localeCompare(b.name)),
    [data.students, turma.name]
  );

  const turmaActivities = useMemo(
    () => data.activities.filter((a) => a.turmaId === turma.id).sort((a, b) => a.date.localeCompare(b.date)),
    [data.activities, turma.id]
  );

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim() || !newActivityDate) return;
    addActivity(turma.id, newActivityName.trim(), newActivityDate);
    setNewActivityName("");
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const formatShort = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const getAttendanceSummaryForDate = (date: string) => {
    const present = turmaStudents.filter((s) => getAttendance(s.id, date) === true).length;
    return { present, total: turmaStudents.length };
  };

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    turmaActivities.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [turmaActivities]);

  const uniqueDates = Object.keys(activitiesByDate).sort();

  return (
    <div className="space-y-4 p-4">
      {/* Header info */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {turma.name}
        </div>
        <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          {turmaStudents.length} aluno(s) · {turmaActivities.length} atividade(s)
        </span>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView("chamada")}
          className="rounded px-4 py-2 text-sm font-semibold transition-colors"
          style={
            activeView === "chamada"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }
          }
        >
          Chamada
        </button>
        <button
          onClick={() => setActiveView("atividades")}
          className="rounded px-4 py-2 text-sm font-semibold transition-colors"
          style={
            activeView === "atividades"
              ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
              : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }
          }
        >
          Atividades
        </button>
      </div>

      {/* CHAMADA VIEW */}
      {activeView === "chamada" && (
        <div className="space-y-4">
          {/* Date selector */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Data da Chamada</span>
            </div>
            <div className="flex items-center gap-3 p-4">
              <input
                type="date"
                className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
              <span className="text-sm font-medium">{formatDate(attendanceDate)}</span>
              {turmaStudents.length > 0 && (
                <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {getAttendanceSummaryForDate(attendanceDate).present}/{turmaStudents.length} presentes
                </span>
              )}
            </div>
          </div>

          {/* Attendance table */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Lista de Presença — {formatDate(attendanceDate)}</span>
            </div>
            <div className="overflow-x-auto">
              {turmaStudents.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nenhum aluno nesta turma. Cadastre alunos na aba "Cadastro".
                </div>
              ) : (
                <table className="school-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome do Aluno</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turmaStudents.map((student, idx) => {
                      const status = getAttendance(student.id, attendanceDate);
                      return (
                        <tr key={student.id}>
                          <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{idx + 1}</td>
                          <td className="font-medium">{student.name}</td>
                          <td className="text-center">
                            {status === true && <span className="badge-present"><CheckCircle size={12} /> Presente</span>}
                            {status === false && <span className="badge-absent"><XCircle size={12} /> Falta</span>}
                            {status === null && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>—</span>}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => toggleAttendance(student.id, attendanceDate)}
                              className={status === true ? "btn-toggle-present" : status === false ? "btn-toggle-absent" : "btn-toggle-pending"}
                            >
                              {status === true ? "✓ Presente" : status === false ? "✗ Falta" : "Marcar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ATIVIDADES VIEW */}
      {activeView === "atividades" && (
        <div className="space-y-4">
          {/* Add Activity */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <CalendarPlus size={14} />
                Nova Atividade
              </span>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddActivity} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  className="flex-1 min-w-40 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Nome da atividade (ex: Prova 1, Lista 2...)"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                />
                <input
                  type="date"
                  className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={newActivityDate}
                  onChange={(e) => setNewActivityDate(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newActivityName.trim() || !newActivityDate}
                  className="flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </form>
            </div>
          </div>

          {/* Activities by date */}
          {uniqueDates.length === 0 ? (
            <div className="section-card">
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Nenhuma atividade cadastrada. Adicione uma atividade acima.
              </div>
            </div>
          ) : (
            uniqueDates.map((date) => (
              <div key={date} className="section-card">
                <div className="section-card-header">
                  <span className="section-card-title">
                    📅 {formatDate(date)}
                    <span className="ml-2 text-xs font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>
                      ({activitiesByDate[date].length} atividade(s))
                    </span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="school-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Aluno</th>
                        {activitiesByDate[date].map((a) => (
                          <th key={a.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {a.name}
                              <button
                                onClick={() => removeActivity(a.id)}
                                className="ml-1 rounded-full p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                                title="Remover atividade"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {turmaStudents.length === 0 ? (
                        <tr>
                          <td colSpan={2 + activitiesByDate[date].length} className="p-4 text-center text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                            Nenhum aluno nesta turma.
                          </td>
                        </tr>
                      ) : (
                        turmaStudents.map((student, idx) => (
                          <tr key={student.id}>
                            <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{idx + 1}</td>
                            <td className="font-medium">{student.name}</td>
                            {activitiesByDate[date].map((a) => {
                              const done = getActivityRecord(student.id, a.id);
                              return (
                                <td key={a.id} className="text-center">
                                  <button
                                    onClick={() => toggleActivityRecord(student.id, a.id)}
                                    className={done === true ? "btn-toggle-done" : done === false ? "btn-toggle-pending" : "btn-toggle-pending"}
                                  >
                                    {done === true ? "✓ Feito" : done === false ? "✗ Pendente" : "Marcar"}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
