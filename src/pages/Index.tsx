import { useState } from "react";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useTheme } from "@/hooks/useTheme";
import { StudentRegistration } from "@/components/StudentRegistration";
import { SummaryTab } from "@/components/SummaryTab";
import { TurmaTab } from "@/components/TurmaTab";
import { DashboardTab } from "@/components/DashboardTab";
import { GraduationCap, LayoutDashboard, Users, Sun, Moon, Home } from "lucide-react";

type TabId = "dashboard" | "cadastro" | "resumo" | string;

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const school = useSchoolData();
  const { theme, toggleTheme } = useTheme();
  const sortedTurmas = [...school.data.turmas].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <Home size={14} /> },
    { id: "cadastro", label: "Cadastro", icon: <Users size={14} /> },
    { id: "resumo", label: "Resumo", icon: <LayoutDashboard size={14} /> },
    ...sortedTurmas.map((t) => ({
      id: t.id,
      label: t.name,
      icon: <GraduationCap size={14} />,
      isTurma: true,
    })),
  ];

  const currentTurma = school.data.turmas.find((t) => t.id === activeTab);

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 border-b border-border px-6 py-3 shadow-sm"
        style={{ backgroundColor: "hsl(var(--primary))" }}
      >
        <img
          src="/app-icon.svg"
          alt="Ícone Diário do Professor"
          className="h-8 w-8 rounded-md border border-white/20"
        />
        <div className="flex-1">
          <h1 className="text-base font-bold leading-tight" style={{ color: "hsl(var(--primary-foreground))" }}>
            Diário do Professor
          </h1>
          <p className="text-xs opacity-70" style={{ color: "hsl(var(--primary-foreground))" }}>
            Controle de chamada e atividades
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:opacity-80"
          style={{
            backgroundColor: "hsl(var(--primary-foreground) / 0.15)",
            color: "hsl(var(--primary-foreground))",
          }}
          title={theme === "light" ? "Modo escuro" : "Modo claro"}
          aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          {theme === "light" ? "Escuro" : "Claro"}
        </button>
      </header>

      {/* Tab bar */}
      <div
        className="flex gap-0.5 overflow-x-auto border-b border-border px-4 pt-2"
        style={{ backgroundColor: "hsl(var(--card))" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition-colors"
              style={
                isActive
                  ? {
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      borderBottom: "2px solid hsl(var(--primary))",
                    }
                  : {
                      color: "hsl(var(--muted-foreground))",
                      borderBottom: "2px solid transparent",
                    }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === "dashboard" && (
          <DashboardTab data={school.data} />
        )}
        {activeTab === "cadastro" && (
          <StudentRegistration
            data={school.data}
            addStudent={school.addStudent}
            removeStudent={school.removeStudent}
            addTurma={school.addTurma}
            removeTurma={school.removeTurma}
            exportToJson={school.exportToJson}
            exportToCsv={school.exportToCsv}
            importFromJson={school.importFromJson}
            importFromCsv={school.importFromCsv}
          />
        )}
        {activeTab === "resumo" && (
          <SummaryTab data={school.data} />
        )}
        {currentTurma && (
          <TurmaTab
            turma={currentTurma}
            data={school.data}
            addActivity={school.addActivity}
            removeActivity={school.removeActivity}
            toggleAttendance={school.toggleAttendance}
            getAttendance={school.getAttendance}
            toggleActivityRecord={school.toggleActivityRecord}
            getActivityRecord={school.getActivityRecord}
            toggleParticipation={school.toggleParticipation}
            toggleExtraPoint={school.toggleExtraPoint}
            getParticipation={school.getParticipation}
            getExtraPoint={school.getExtraPoint}
            addMinTask={school.addMinTask}
            removeMinTask={school.removeMinTask}
            setMinTaskRecord={school.setMinTaskRecord}
            getMinTaskRecord={school.getMinTaskRecord}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
