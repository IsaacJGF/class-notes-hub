import { useEffect, useState } from "react";
import { useSchoolData } from "@/hooks/useSchoolData";
import { StudentRegistration } from "@/components/StudentRegistration";
import { SummaryTab } from "@/components/SummaryTab";
import { TurmaTab } from "@/components/TurmaTab";
import { GraduationCap, LayoutDashboard, Users } from "lucide-react";

type TabId = "cadastro" | "resumo" | string; // string = turma id

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("cadastro");
  const [summaryInitialTurma, setSummaryInitialTurma] = useState<string | undefined>(undefined);
  const [turmaInitialDate, setTurmaInitialDate] = useState<string | undefined>(undefined);
  const school = useSchoolData();
  const sortedTurmas = [...school.data.turmas].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const tabs = [
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

  const handleOpenSummaryFromTurma = (turmaName: string) => {
    setSummaryInitialTurma(turmaName);
    setActiveTab("resumo");
  };

  const handleOpenTurmaFromSummary = (turmaId: string, date?: string) => {
    setTurmaInitialDate(date);
    setActiveTab(turmaId);
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Header */}
      <header
        className="flex items-center gap-2 sm:gap-3 border-b border-border px-3 sm:px-6 py-2 sm:py-3 shadow-sm"
        style={{ backgroundColor: "hsl(var(--primary))" }}
      >
        <img
          src="/app-icon.svg"
          alt="Ícone Diário do Professor"
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-md border border-white/20"
        />
        <div>
          <h1 className="text-sm sm:text-base font-bold leading-tight" style={{ color: "hsl(var(--primary-foreground))" }}>
            Diário do Professor
          </h1>
          <p className="text-[10px] sm:text-xs opacity-70 hidden sm:block" style={{ color: "hsl(var(--primary-foreground))" }}>
            Controle de chamada e atividades
          </p>
        </div>
      </header>

      {/* Tab bar - scrollable, touch-friendly */}
      <div
        className="flex gap-0.5 overflow-x-auto border-b border-border px-2 sm:px-4 pt-1 sm:pt-2 scrollbar-hide"
        style={{ backgroundColor: "hsl(var(--card))", WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap rounded-t-md px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors min-h-[44px] touch-manipulation"
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
        {activeTab === "cadastro" && (
          <StudentRegistration
            data={school.data}
            addStudent={school.addStudent}
            removeStudent={school.removeStudent}
            addTurma={school.addTurma}
            removeTurma={school.removeTurma}
          />
        )}
        {activeTab === "resumo" && (
          <SummaryTab
            data={school.data}
            toggleAttendance={school.toggleAttendance}
            toggleActivityRecord={school.toggleActivityRecord}
            getActivityRecordFull={school.getActivityRecordFull}
            setActivityOnTimeOverride={school.setActivityOnTimeOverride}
            setMinTaskRecord={school.setMinTaskRecord}
            getMinTaskRecord={school.getMinTaskRecord}
            initialTurma={summaryInitialTurma}
            onInitialTurmaConsumed={() => setSummaryInitialTurma(undefined)}
            onOpenTurma={handleOpenTurmaFromSummary}
          />
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
            getActivityRecordFull={school.getActivityRecordFull}
            setActivityOnTimeOverride={school.setActivityOnTimeOverride}
            toggleParticipation={school.toggleParticipation}
            toggleExtraPoint={school.toggleExtraPoint}
            getParticipation={school.getParticipation}
            getExtraPoint={school.getExtraPoint}
            addMinTask={school.addMinTask}
            removeMinTask={school.removeMinTask}
            setMinTaskRecord={school.setMinTaskRecord}
            getMinTaskRecord={school.getMinTaskRecord}
            initialDate={turmaInitialDate}
            onInitialDateConsumed={() => setTurmaInitialDate(undefined)}
            onOpenSummary={() => handleOpenSummaryFromTurma(currentTurma.name)}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
