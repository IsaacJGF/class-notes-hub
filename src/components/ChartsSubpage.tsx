import { useCallback, useMemo, useState } from "react";
import { AcademicTerm, Activity as SchoolActivity, SchoolData } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { TrendingUp, Users, GraduationCap, Activity } from "lucide-react";
import { getStudentTermSummary, indexActivityRecords, normalizeAcademicTerm } from "@/lib/academicTerms";

interface Props {
  data: SchoolData;
  selectedTerm: AcademicTerm;
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

export function ChartsSubpage({ data, selectedTerm, filterTurma, filterDateFrom, filterDateTo }: Props) {
  const [chartView, setChartView] = useState<ChartView>("comparativo-turmas");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(
    data.turmas.find((turma) => turma.name === filterTurma)?.id ?? data.turmas[0]?.id ?? "",
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    data.students.find((student) => student.turma === filterTurma)?.id ?? data.students[0]?.id ?? "",
  );
  const recordIndex = useMemo(() => indexActivityRecords(data.activityRecords), [data.activityRecords]);

  const filteredStudents = useMemo(() => {
    if (!filterTurma || filterTurma === "all") return data.students;
    return data.students.filter((s) => s.turma === filterTurma);
  }, [data.students, filterTurma]);

  const allTermActivities = useMemo(() => {
    let acts = data.activities.filter((activity) => normalizeAcademicTerm(activity.term) === selectedTerm);
    if (filterDateFrom) acts = acts.filter((activity) => activity.date >= filterDateFrom);
    if (filterDateTo) acts = acts.filter((activity) => activity.date <= filterDateTo);
    return acts.sort((first, second) => first.date.localeCompare(second.date));
  }, [data.activities, selectedTerm, filterDateFrom, filterDateTo]);

  const filteredActivities = useMemo(() => {
    let acts = allTermActivities;
    if (filterTurma && filterTurma !== "all") {
      const turma = data.turmas.find((t) => t.name === filterTurma);
      if (turma) acts = acts.filter((a) => a.turmaId === turma.id);
    }
    return acts;
  }, [allTermActivities, data.turmas, filterTurma]);

  const getStudentActPct = useCallback(
    (studentId: string, activities: SchoolActivity[]) =>
      getStudentTermSummary(studentId, activities, recordIndex, 100).weightedPercentage,
    [recordIndex],
  );

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const turmaCompData = useMemo(() => {
    return data.turmas.map((turma) => {
      const students = data.students.filter((student) => student.turma === turma.name);
      const activities = allTermActivities.filter((activity) => activity.turmaId === turma.id);
      if (students.length === 0) return { turma: turma.name, Atividades: 0, Alunos: 0 };
      const actPct = Math.round(
        students.reduce((total, student) => total + getStudentActPct(student.id, activities), 0) / students.length,
      );
      return { turma: turma.name, Atividades: actPct, Alunos: students.length };
    });
  }, [data.turmas, data.students, allTermActivities, getStudentActPct]);

  const studentCompData = useMemo(() => {
    return filteredStudents.map((s) => {
      const turma = data.turmas.find((t) => t.name === s.turma);
      return {
        aluno: s.name.split(" ")[0],
        nomeCompleto: s.name,
        turma: s.turma,
        Atividades: turma
          ? getStudentActPct(s.id, filteredActivities.filter((activity) => activity.turmaId === turma.id))
          : 0,
      };
    }).sort((a, b) => b.Atividades - a.Atividades);
  }, [filteredStudents, data.turmas, filteredActivities, getStudentActPct]);

  const turmaHistoryData = useMemo(() => {
    const turma = data.turmas.find((t) => t.id === selectedTurmaId);
    if (!turma) return [] as { data: string; Atividades: number }[];
    const students = data.students.filter((s) => s.turma === turma.name);
    if (students.length === 0) return [];

    const turmaActivities = allTermActivities.filter((activity) => activity.turmaId === turma.id);
    const tDates = Array.from(new Set(turmaActivities.map((activity) => activity.date))).sort();

    return tDates.map((date) => {
      const activities = turmaActivities.filter((activity) => activity.date === date);
      const actPct = students.length > 0
        ? Math.round(
            students.reduce((total, student) => total + getStudentActPct(student.id, activities), 0) / students.length,
          )
        : 0;
      return { data: formatDate(date), Atividades: actPct };
    });
  }, [selectedTurmaId, data.turmas, data.students, allTermActivities, getStudentActPct]);

  const studentHistoryData = useMemo(() => {
    const student = data.students.find((s) => s.id === selectedStudentId);
    if (!student) return [] as { data: string; "Atividades do dia": number | null }[];
    const turma = data.turmas.find((t) => t.name === student.turma);
    if (!turma) return [];

    const turmaActivities = allTermActivities.filter((activity) => activity.turmaId === turma.id);
    const sDates = Array.from(new Set(turmaActivities.map((activity) => activity.date))).sort();

    return sDates.map((date) => {
      const dayActs = turmaActivities.filter((activity) => activity.date === date);
      return {
        data: formatDate(date),
        "Atividades do dia": dayActs.length > 0 ? getStudentActPct(student.id, dayActs) : null,
      };
    });
  }, [selectedStudentId, data.students, data.turmas, allTermActivities, getStudentActPct]);

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
