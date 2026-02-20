import { useMemo, useState } from "react";
import { SchoolData } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Cell,
} from "recharts";
import { TrendingUp, Users, GraduationCap, Activity } from "lucide-react";

interface Props {
  data: SchoolData;
  filterTurma: string;
  filterDateFrom: string;
  filterDateTo: string;
}

type ChartView = "comparativo-turmas" | "comparativo-alunos" | "historico-turma" | "historico-aluno";

const COLORS = [
  "hsl(var(--present))",
  "hsl(var(--done))",
  "hsl(var(--accent))",
  "hsl(var(--absent))",
  "hsl(var(--primary))",
];

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
    if (filterTurma === "all") return data.students;
    return data.students.filter((s) => s.turma === filterTurma);
  }, [data.students, filterTurma]);

  const attendanceDates = useMemo(() => {
    let dates = Array.from(new Set(data.attendanceRecords.map((r) => r.date))).sort();
    if (filterDateFrom) dates = dates.filter((d) => d >= filterDateFrom);
    if (filterDateTo) dates = dates.filter((d) => d <= filterDateTo);
    return dates;
  }, [data.attendanceRecords, filterDateFrom, filterDateTo]);

  const filteredActivities = useMemo(() => {
    let acts = data.activities;
    if (filterTurma !== "all") {
      const turma = data.turmas.find((t) => t.name === filterTurma);
      if (turma) acts = acts.filter((a) => a.turmaId === turma.id);
    }
    if (filterDateFrom) acts = acts.filter((a) => a.date >= filterDateFrom);
    if (filterDateTo) acts = acts.filter((a) => a.date <= filterDateTo);
    return acts.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.activities, data.turmas, filterTurma, filterDateFrom, filterDateTo]);

  const getStudentAttPct = (studentId: string) => {
    const relevant = data.attendanceRecords.filter((r) => {
      if (r.studentId !== studentId) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      return attendanceDates.includes(r.date);
    });
    const present = relevant.filter((r) => r.present).length;
    return attendanceDates.length > 0 ? Math.round((present / attendanceDates.length) * 100) : 0;
  };

  const getStudentActPct = (studentId: string, turmaId: string) => {
    const acts = filteredActivities.filter((a) => a.turmaId === turmaId);
    if (acts.length === 0) return 0;
    const done = acts.filter((a) => data.activityRecords.find((r) => r.studentId === studentId && r.activityId === a.id && r.done)).length;
    return Math.round((done / acts.length) * 100);
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  // ── 1. Comparativo entre Turmas ──
  const turmaCompData = useMemo(() => {
    return data.turmas.map((turma) => {
      const students = filteredStudents.filter((s) => s.turma === turma.name);
      if (students.length === 0) return { turma: turma.name, Presença: 0, Atividades: 0, Alunos: 0 };
      const attPct = Math.round(students.reduce((acc, s) => acc + getStudentAttPct(s.id), 0) / students.length);
      const actPct = Math.round(students.reduce((acc, s) => acc + getStudentActPct(s.id, turma.id), 0) / students.length);
      return { turma: turma.name, Presença: attPct, Atividades: actPct, Alunos: students.length };
    });
  }, [data.turmas, filteredStudents, attendanceDates, filteredActivities]);

  // ── 2. Comparativo entre Alunos (radar ou barra) ──
  const studentCompData = useMemo(() => {
    return filteredStudents.map((s) => {
      const turma = data.turmas.find((t) => t.name === s.turma);
      return {
        aluno: s.name.split(" ")[0],
        nomeCompleto: s.name,
        turma: s.turma,
        Presença: getStudentAttPct(s.id),
        Atividades: turma ? getStudentActPct(s.id, turma.id) : 0,
      };
    }).sort((a, b) => (b.Presença + b.Atividades) - (a.Presença + a.Atividades));
  }, [filteredStudents, data.turmas, attendanceDates, filteredActivities]);

  // ── 3. Histórico evolutivo da Turma (linha por mês/data) ──
  const turmaHistoryData = useMemo(() => {
    const turma = data.turmas.find((t) => t.id === selectedTurmaId);
    if (!turma) return [];
    const students = data.students.filter((s) => s.turma === turma.name);
    if (students.length === 0) return [];

    const tDates = Array.from(new Set(data.attendanceRecords.map((r) => r.date)))
      .filter((d) => {
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        return true;
      })
      .sort();

    return tDates.map((date) => {
      const present = students.filter((s) =>
        data.attendanceRecords.find((r) => r.studentId === s.id && r.date === date && r.present)
      ).length;
      const pct = students.length > 0 ? Math.round((present / students.length) * 100) : 0;

      const tActs = data.activities.filter((a) => a.turmaId === turma.id && a.date === date);
      const doneSum = tActs.length > 0
        ? students.reduce((acc, s) => {
            const d = tActs.filter((a) => data.activityRecords.find((r) => r.studentId === s.id && r.activityId === a.id && r.done)).length;
            return acc + d;
          }, 0)
        : null;
      const actPct = tActs.length > 0 && doneSum !== null
        ? Math.round((doneSum / (students.length * tActs.length)) * 100)
        : null;

      return { data: formatDate(date), Presença: pct, ...(actPct !== null ? { Atividades: actPct } : {}) };
    });
  }, [selectedTurmaId, data, filterDateFrom, filterDateTo]);

  // ── 4. Histórico evolutivo do Aluno ──
  const studentHistoryData = useMemo(() => {
    const student = data.students.find((s) => s.id === selectedStudentId);
    if (!student) return [];
    const turma = data.turmas.find((t) => t.name === student.turma);

    const sDates = Array.from(new Set(data.attendanceRecords.map((r) => r.date)))
      .filter((d) => {
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        return true;
      })
      .sort();

    // Cumulative attendance over time
    let cumulativePresent = 0;
    return sDates.map((date, i) => {
      const rec = data.attendanceRecords.find((r) => r.studentId === student.id && r.date === date);
      if (rec?.present) cumulativePresent++;
      const cumPct = Math.round((cumulativePresent / (i + 1)) * 100);

      const dayActs = turma
        ? data.activities.filter((a) => a.turmaId === turma.id && a.date === date)
        : [];
      const dayDone = dayActs.filter((a) =>
        data.activityRecords.find((r) => r.studentId === student.id && r.activityId === a.id && r.done)
      ).length;

      return {
        data: formatDate(date),
        "Presença acum.": cumPct,
        "Presente": rec?.present ? 100 : rec ? 0 : null,
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
      {/* Sub-nav */}
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

      {/* ── Comparativo Turmas ── */}
      {chartView === "comparativo-turmas" && !isEmpty && (
        <div className="space-y-4">
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
                    <Bar dataKey="Presença" fill="hsl(var(--present))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    <Bar dataKey="Atividades" fill="hsl(var(--done))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Ranking cards */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Ranking de Turmas</span>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...turmaCompData]
                .sort((a, b) => (b.Presença + b.Atividades) - (a.Presença + a.Atividades))
                .map((item, i) => (
                  <div
                    key={item.turma}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                    style={{ backgroundColor: "hsl(var(--background))" }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0"
                      style={
                        i === 0
                          ? { backgroundColor: "hsl(var(--done-light))", color: "hsl(var(--done))" }
                          : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
                      }
                    >
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "hsl(var(--foreground))" }}>{item.turma}</p>
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {item.Alunos} aluno(s) · {item.Presença}% pres. · {item.Atividades}% ativ.
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Comparativo Alunos ── */}
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
                        <Bar dataKey="Presença" fill="hsl(var(--present))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Atividades" fill="hsl(var(--done))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Radar — top 6 alunos */}
          {studentCompData.length >= 2 && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Radar — Top 6 Alunos</span>
              </div>
              <div className="p-4 flex justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={studentCompData.slice(0, 6).map((s) => ({
                    subject: s.aluno,
                    Presença: s.Presença,
                    Atividades: s.Atividades,
                  }))}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name="Presença" dataKey="Presença" stroke="hsl(var(--present))" fill="hsl(var(--present))" fillOpacity={0.25} />
                    <Radar name="Atividades" dataKey="Atividades" stroke="hsl(var(--done))" fill="hsl(var(--done))" fillOpacity={0.25} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Ranking Alunos */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Ranking de Alunos</span>
            </div>
            <div className="p-4 space-y-2">
              {studentCompData.map((s, i) => {
                const avg = Math.round((s.Presença + s.Atividades) / 2);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="w-6 text-center text-xs font-bold shrink-0"
                      style={{ color: i < 3 ? "hsl(var(--done))" : "hsl(var(--muted-foreground))" }}
                    >
                      #{i + 1}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate" style={{ color: "hsl(var(--foreground))" }}>{s.nomeCompleto}</span>
                    <span className="text-xs shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{s.turma}</span>
                    <div className="w-32 shrink-0">
                      <div className="flex h-2 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${avg}%`, backgroundColor: avg >= 75 ? "hsl(var(--done))" : "hsl(var(--absent))" }}
                        />
                      </div>
                    </div>
                    <span
                      className="w-10 text-right text-xs font-bold shrink-0"
                      style={{ color: avg >= 75 ? "hsl(var(--done))" : "hsl(var(--absent))" }}
                    >
                      {avg}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Histórico da Turma ── */}
      {chartView === "historico-turma" && !isEmpty && (
        <div className="space-y-4">
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2"><TrendingUp size={15} /> Histórico Evolutivo da Turma</span>
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
                  Registre presença em pelo menos 2 datas para ver a evolução.
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
                        <Line type="monotone" dataKey="Presença" stroke="hsl(var(--present))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                        <Line type="monotone" dataKey="Atividades" stroke="hsl(var(--done))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Histórico do Aluno ── */}
      {chartView === "historico-aluno" && !isEmpty && (
        <div className="space-y-4">
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2"><Activity size={15} /> Histórico Evolutivo do Aluno</span>
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
                  Registre presença em pelo menos 2 datas para ver a evolução.
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
                        <Line type="monotone" dataKey="Presença acum." stroke="hsl(var(--present))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                        <Line type="monotone" dataKey="Atividades do dia" stroke="hsl(var(--done))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                        <Line type="monotone" dataKey="Presente" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <strong>Presença acum.</strong>: frequência acumulada ao longo do tempo &nbsp;·&nbsp;
                <strong>Atividades do dia</strong>: % de atividades feitas naquela data
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
