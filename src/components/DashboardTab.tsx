import { useMemo } from "react";
import { SchoolData } from "@/types";
import { Users, GraduationCap, CheckCircle, AlertTriangle, ClipboardList, Activity } from "lucide-react";

interface Props {
  data: SchoolData;
}

export function DashboardTab({ data }: Props) {
  const stats = useMemo(() => {
    const totalStudents = data.students.length;
    const totalTurmas = data.turmas.length;
    const totalActivities = data.activities.length;
    const totalMinTasks = (data.minTasks || []).length;

    // Attendance stats
    const attendanceDates = Array.from(new Set(data.attendanceRecords.map((r) => r.date)));
    const totalPresent = data.attendanceRecords.filter((r) => r.present).length;
    const totalAttRecords = data.attendanceRecords.length;
    const avgAttendance = totalAttRecords > 0 ? Math.round((totalPresent / totalAttRecords) * 100) : null;

    // Activity completion
    const doneActivities = data.activityRecords.filter((r) => r.done).length;
    const totalActivityRecords = data.activityRecords.length;
    const avgActivityCompletion = totalActivityRecords > 0 ? Math.round((doneActivities / totalActivityRecords) * 100) : null;

    // Min task completion
    const totalMinTaskDone = (data.minTaskRecords || []).reduce((sum, r) => sum + r.questionsDone, 0);
    const totalMinTaskPossible = (data.minTasks || []).reduce((sum, t) => {
      const studentsInTurma = data.students.filter((s) => {
        const turma = data.turmas.find((tu) => tu.id === t.turmaId);
        return turma && s.turma === turma.name;
      }).length;
      return sum + t.totalQuestions * studentsInTurma;
    }, 0);
    const avgMinTask = totalMinTaskPossible > 0 ? Math.round((totalMinTaskDone / totalMinTaskPossible) * 100) : null;

    // Alerts: students with < 75% attendance
    const studentsWithLowAttendance = data.students.filter((student) => {
      if (attendanceDates.length === 0) return false;
      const records = data.attendanceRecords.filter((r) => r.studentId === student.id);
      const present = records.filter((r) => r.present).length;
      const pct = attendanceDates.length > 0 ? (present / attendanceDates.length) * 100 : 100;
      return pct < 75;
    });

    // Students with < 50% activity completion
    const studentsWithLowActivity = data.students.filter((student) => {
      const turma = data.turmas.find((t) => t.name === student.turma);
      if (!turma) return false;
      const turmaActs = data.activities.filter((a) => a.turmaId === turma.id);
      if (turmaActs.length === 0) return false;
      const done = turmaActs.filter((a) =>
        data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id && r.done)
      ).length;
      return (done / turmaActs.length) * 100 < 50;
    });

    return {
      totalStudents,
      totalTurmas,
      totalActivities,
      totalMinTasks,
      attendanceDates: attendanceDates.length,
      avgAttendance,
      avgActivityCompletion,
      avgMinTask,
      studentsWithLowAttendance,
      studentsWithLowActivity,
    };
  }, [data]);

  const cards = [
    {
      label: "Alunos",
      value: stats.totalStudents,
      icon: <Users size={20} />,
      color: "hsl(var(--primary))",
      bg: "hsl(var(--secondary))",
    },
    {
      label: "Turmas",
      value: stats.totalTurmas,
      icon: <GraduationCap size={20} />,
      color: "hsl(var(--accent))",
      bg: "hsl(var(--accent) / 0.12)",
    },
    {
      label: "Frequência Média",
      value: stats.avgAttendance !== null ? `${stats.avgAttendance}%` : "—",
      icon: <CheckCircle size={20} />,
      color: "hsl(var(--present))",
      bg: "hsl(var(--present-light))",
    },
    {
      label: "Entrega de Atividades",
      value: stats.avgActivityCompletion !== null ? `${stats.avgActivityCompletion}%` : "—",
      icon: <Activity size={20} />,
      color: "hsl(var(--done))",
      bg: "hsl(var(--done-light))",
    },
    {
      label: "Tarefas Mínimas",
      value: stats.avgMinTask !== null ? `${stats.avgMinTask}%` : "—",
      icon: <ClipboardList size={20} />,
      color: "hsl(var(--not-done))",
      bg: "hsl(var(--not-done-light))",
    },
    {
      label: "Alertas",
      value: stats.studentsWithLowAttendance.length + stats.studentsWithLowActivity.length,
      icon: <AlertTriangle size={20} />,
      color: stats.studentsWithLowAttendance.length + stats.studentsWithLowActivity.length > 0 ? "hsl(var(--absent))" : "hsl(var(--present))",
      bg: stats.studentsWithLowAttendance.length + stats.studentsWithLowActivity.length > 0 ? "hsl(var(--absent-light))" : "hsl(var(--present-light))",
    },
  ];

  const isEmpty = stats.totalStudents === 0 && stats.totalTurmas === 0;

  return (
    <div className="space-y-6 p-4">
      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            style={{ backgroundColor: card.bg }}
          >
            <div style={{ color: card.color }}>{card.icon}</div>
            <span className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</span>
            <span className="text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{card.label}</span>
          </div>
        ))}
      </div>

      {isEmpty && (
        <div className="section-card">
          <div className="flex flex-col items-center gap-4 p-10 text-center">
            <GraduationCap size={48} style={{ color: "hsl(var(--muted-foreground))" }} className="opacity-40" />
            <h3 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Bem-vindo ao Diário do Professor!
            </h3>
            <p className="max-w-md text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Comece cadastrando suas turmas e alunos na aba <strong>"Cadastro"</strong>. 
              Depois, registre chamadas, atividades e tarefas mínimas nas abas de cada turma.
            </p>
            <div className="flex gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <span>1. Cadastrar turma</span>
              <span>→</span>
              <span>2. Cadastrar alunos</span>
              <span>→</span>
              <span>3. Registrar aulas</span>
            </div>
          </div>
        </div>
      )}

      {/* Alerts section */}
      {(stats.studentsWithLowAttendance.length > 0 || stats.studentsWithLowActivity.length > 0) && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <AlertTriangle size={14} />
              Alertas Pedagógicos
            </span>
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              {stats.studentsWithLowAttendance.length + stats.studentsWithLowActivity.length} aluno(s) precisam de atenção
            </span>
          </div>
          <div className="p-4 space-y-3">
            {stats.studentsWithLowAttendance.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--absent))" }}>
                  <AlertTriangle size={12} />
                  Frequência abaixo de 75%
                </h4>
                <div className="flex flex-wrap gap-2">
                  {stats.studentsWithLowAttendance.map((student) => {
                    const records = data.attendanceRecords.filter((r) => r.studentId === student.id);
                    const present = records.filter((r) => r.present).length;
                    const attendanceDates = Array.from(new Set(data.attendanceRecords.map((r) => r.date)));
                    const pct = attendanceDates.length > 0 ? Math.round((present / attendanceDates.length) * 100) : 0;
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        style={{
                          borderColor: "hsl(var(--absent) / 0.3)",
                          backgroundColor: "hsl(var(--absent-light))",
                        }}
                      >
                        <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{student.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>
                          {student.turma}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "hsl(var(--absent))" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.studentsWithLowActivity.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--not-done))" }}>
                  <AlertTriangle size={12} />
                  Entrega de atividades abaixo de 50%
                </h4>
                <div className="flex flex-wrap gap-2">
                  {stats.studentsWithLowActivity.map((student) => {
                    const turma = data.turmas.find((t) => t.name === student.turma);
                    const turmaActs = turma ? data.activities.filter((a) => a.turmaId === turma.id) : [];
                    const done = turmaActs.filter((a) =>
                      data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id && r.done)
                    ).length;
                    const pct = turmaActs.length > 0 ? Math.round((done / turmaActs.length) * 100) : 0;
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        style={{
                          borderColor: "hsl(var(--not-done) / 0.3)",
                          backgroundColor: "hsl(var(--not-done-light))",
                        }}
                      >
                        <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{student.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--primary))" }}>
                          {student.turma}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "hsl(var(--not-done))" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick stats table */}
      {!isEmpty && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Turma summary */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <GraduationCap size={14} />
                Resumo por Turma
              </span>
            </div>
            <div className="overflow-auto">
              <table className="school-table school-table-compact">
                <thead>
                  <tr>
                    <th>Turma</th>
                    <th className="text-center">Alunos</th>
                    <th className="text-center">Atividades</th>
                    <th className="text-center">T. Mínimas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.turmas
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
                    .map((turma) => {
                      const studentCount = data.students.filter((s) => s.turma === turma.name).length;
                      const actCount = data.activities.filter((a) => a.turmaId === turma.id).length;
                      const minTaskCount = (data.minTasks || []).filter((t) => t.turmaId === turma.id).length;
                      return (
                        <tr key={turma.id}>
                          <td className="font-medium">{turma.name}</td>
                          <td className="text-center">{studentCount}</td>
                          <td className="text-center">{actCount}</td>
                          <td className="text-center">{minTaskCount}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent activity */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <Activity size={14} />
                Últimas Aulas Registradas
              </span>
            </div>
            <div className="p-4 space-y-2">
              {(() => {
                const recentDates = Array.from(new Set(data.attendanceRecords.map((r) => r.date)))
                  .sort()
                  .reverse()
                  .slice(0, 5);

                if (recentDates.length === 0) {
                  return (
                    <p className="text-sm text-center py-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Nenhuma aula registrada ainda.
                    </p>
                  );
                }

                return recentDates.map((date) => {
                  const [y, m, day] = date.split("-");
                  const present = data.attendanceRecords.filter((r) => r.date === date && r.present).length;
                  const total = data.attendanceRecords.filter((r) => r.date === date).length;
                  return (
                    <div
                      key={date}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      style={{ backgroundColor: "hsl(var(--background))" }}
                    >
                      <span className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                        {day}/{m}/{y}
                      </span>
                      <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {present}/{total} presentes
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
