import { useState } from "react";
import { useSchoolData } from "@/hooks/useSchoolData";
import { StudentRegistration } from "@/components/StudentRegistration";
import { SummaryTab } from "@/components/SummaryTab";
import { TurmaTab } from "@/components/TurmaTab";
import { GraduationCap, LayoutDashboard, Users } from "lucide-react";

type TabId = "cadastro" | "resumo" | string; // string = turma id

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("cadastro");
  const school = useSchoolData();

  const tabs = [
    { id: "cadastro", label: "Cadastro", icon: <Users size={14} /> },
    { id: "resumo", label: "Resumo", icon: <LayoutDashboard size={14} /> },
    ...school.data.turmas.map((t) => ({
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
        <GraduationCap size={22} style={{ color: "hsl(var(--primary-foreground))" }} />
        <div>
          <h1 className="text-base font-bold leading-tight" style={{ color: "hsl(var(--primary-foreground))" }}>
            Diário do Professor
          </h1>
          <p className="text-xs opacity-70" style={{ color: "hsl(var(--primary-foreground))" }}>
            Controle de chamada e atividades
          </p>
        </div>
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
            cycleActivityBonusTag={school.cycleActivityBonusTag}
            getActivityBonusTag={school.getActivityBonusTag}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
