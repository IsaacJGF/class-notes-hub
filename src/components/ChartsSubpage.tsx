import { useMemo, useState } from "react";
import { SchoolData } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { TrendingUp, Users, GraduationCap, Activity } from "lucide-react";

interface Props {
  data: SchoolData;
  filterTurma: string;
  filterDateFrom: string;
  filterDateTo: string;
}

type ChartView = "comparativo-turmas" | "comparativo-alunos" | "historico-turma" | "historico-aluno";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export function ChartsSubpage({ data, filterTurma, filterDateFrom, filterDateTo }: Props) {
  const [chartView, setChartView] = useState<ChartView>("comparativo-turmas");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(data.turmas[0]?.id ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(data.students[0]?.id ?? "");

  const filteredStudents = useMemo(() => {
    if (!filterTurma || filterTurma === "all") return data.students;
    return data.students.filter((s) => s.turma === filterTurma);
  }, [data.students, filterTurma]);

  const filteredActivities = useMemo(() => {
    let acts = data.activities;
    if (filterTurma && filterTurma !== "all") {
      const turma = data.turmas.find((t) => t.name === filterTurma);
      if (turma) acts = acts.filter((a) => a.turmaId === turma.id);
    }
    if (filterDateFrom) acts = acts.filter((a) => a.date >= filterDateFrom);
    if (filterDateTo) acts = acts.filter((a) => a.date <= filterDateTo);
    return acts.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.activities, data.turmas, filterTurma, filterDateFrom, filterDateTo]);

  const getStudentActPct = (studentId: string, turmaId: string) => {
    const acts = filteredActivities.filter((a) => a.turmaId === turmaId);
    if (acts.length === 0) return 0;
    const done = acts.filter((a) => data.activityRecords.find((r) => r.studentId === studentId && r.activityId === a.id && r.done)).length;
    return Math.round((done / acts.length) * 100);
  };

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const turmaCompData = useMemo(() => {
    return data.turmas.map((turma) => {
      const students = filteredStudents.filter((s) => s.turma === turma.name);
      if (students.length === 0) return { turma: turma.name, Atividades: 0, Alunos: 0 };
      const actPct = Math.round(students.reduce((acc, s) => acc + getStudentActPct(s.id, turma.id), 0) / students.length);
      return { turma: turma.name, Atividades: actPct, Alunos: students.length };
    });
  }, [data.turmas, filteredStudents, filteredActivities]);

  const studentCompData = useMemo(() => {
    return filteredStudents.map((s) => {
      const turma = data.turmas.find((t) => t.name === s.turma);
      return {
        aluno: s.name.split(" ")[0],
        nomeCompleto: s.name,
        turma: s.turma,
        Atividades: turma ? getStudentActPct(s.id, turma.id) : 0,
      };
    }).sort((a, b) => b.Atividades - a.Atividades);
  }, [filteredStudents, data.turmas, filteredActivities]);

  const turmaHistoryData = useMemo(() => {
    const turma = data.turmas.find((t) => t.id === selectedTurmaId);
    if (!turma) return [] as { data: string; Atividades: number }[];
    const students = data.students.filter((s) => s.turma === turma.name);
    if (students.length === 0) return [];

    const tDates = Array.from(new Set(data.activities.filter((a) => a.turmaId === turma.id).map((a) => a.date)))
      .filter((d) => {
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        return true;
      })
      .sort();

    return tDates.map((date) => {
      const tActs = data.activities.filter((a) => a.turmaId === turma.id && a.date === date);
      const doneSum = students.reduce((acc, s) => {
        const d = tActs.filter((a) => data.activityRecords.find((r) => r.studentId === s.id && r.activityId === a.id && r.done)).length;
        return acc + d;
      }, 0);
      const actPct = tActs.length > 0
        ? Math.round((doneSum / (students.length * tActs.length)) * 100)
        : 0;
      return { data: formatDate(date), Atividades: actPct };
    });
  }, [selectedTurmaId, data, filterDateFrom, filterDateTo]);

  const studentHistoryData = useMemo(() => {
    const student = data.students.find((s) => s.id === selectedStudentId);
    if (!student) return [] as { data: string; "Atividades do dia": number | null }[];
    const turma = data.turmas.find((t) => t.name === student.turma);
    if (!turma) return [];

    const sDates = Array.from(new Set(data.activities.filter((a) => a.turmaId === turma.id).map((a) => a.date)))
      .filter((d) => {
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        return true;
      })
      .sort();

    return sDates.map((date) => {
      const dayActs = data.activities.filter((a) => a.turmaId === turma.id && a.date === date);
      const dayDone = dayActs.filter((a) =>
        data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id && r.done)
      ).length;
      return {
        data: formatDate(date),
        "Atividades do dia": dayActs.length > 0 ? Math.round((dayDone / dayActs.length) * 100) : null,
      };
    });
  }, [selectedStudentId, data, filterDateFrom, filterDateTo]);

  const views: { id: ChartView; label: string; icon: React.ReactNode }[] = [
    { id: "comparativo-turmas", label: "Comparativo Turmas", icon: <GraduationCap size={13} /> },
    { id: "comparativo-alunos", label: "Comparativo Alunos", icon: <Users size={13} /> },
    { id: "historico-turma", label: "Histórico da Turma", icon: <TrendingUp size={13} /> },
    { id: "historico-aluno", label: "Histórico do Aluno", icon: <Activity size={13} /> },
  ];

  const isEmpty = data.turmas.length === 0 && data.students.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1" style={{ backgroundColor: "hsl(var(--muted))" }}>
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setChartView(v.id)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
            style={
              chartView === v.id
                ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {isEmpty && (
        <div className="flex h-60 items-center justify-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Cadastre turmas e alunos para ver os gráficos.
        </div>
      )}

      {chartView === "comparativo-turmas" && !isEmpty && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2"><GraduationCap size={15} /> Desempenho por Turma</span>
          </div>
          <div className="p-4">
            {turmaCompData.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={turmaCompData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="turma" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Atividades" fill="hsl(var(--done))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {chartView === "comparativo-alunos" && !isEmpty && (
        <div className="space-y-4">
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2"><Users size={15} /> Desempenho por Aluno</span>
            </div>
            <div className="p-4">
              {studentCompData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>Sem dados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: Math.max(studentCompData.length * 90, 400) }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={studentCompData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="aluno" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          formatter={(v: number) => `${v}%`}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.nomeCompleto ?? label}
                          contentStyle={tooltipStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Atividades" fill="hsl(var(--done))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {studentCompData.length >= 2 && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Radar — Top 6 Alunos</span>
              </div>
              <div className="p-4 flex justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={studentCompData.slice(0, 6).map((s) => ({
                    subject: s.aluno,
                    Atividades: s.Atividades,
                  }))}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name="Atividades" dataKey="Atividades" stroke="hsl(var(--done))" fill="hsl(var(--done))" fillOpacity={0.25} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {chartView === "historico-turma" && !isEmpty && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2"><TrendingUp size={15} /> Histórico de Atividades da Turma</span>
            <select
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {data.turmas.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="p-4">
            {turmaHistoryData.length < 2 ? (
              <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                Registre atividades em pelo menos 2 datas para ver a evolução.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(turmaHistoryData.length * 60, 400) }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={turmaHistoryData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="Atividades" stroke="hsl(var(--done))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {chartView === "historico-aluno" && !isEmpty && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2"><Activity size={15} /> Histórico de Atividades do Aluno</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.turma})</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            {studentHistoryData.length < 2 ? (
              <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                Registre atividades em pelo menos 2 datas para ver a evolução.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(studentHistoryData.length * 60, 400) }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={studentHistoryData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: number | null) => v !== null ? `${v}%` : "—"} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="Atividades do dia" stroke="hsl(var(--done))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}