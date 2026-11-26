import { useState } from "react";
import { useSchoolData } from "@/hooks/useSchoolData";
import { StudentRegistration } from "@/components/StudentRegistration";
import { TurmaTab } from "@/components/TurmaTab";
import { AcademicTerm } from "@/types";
import { ACADEMIC_TERMS, getTermLabel } from "@/lib/academicTerms";
import { GraduationCap, Users } from "lucide-react";

type TabId = "cadastro" | string; // string = turma id

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("cadastro");
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm>(1);
  const school = useSchoolData();
  const sortedTurmas = [...school.data.turmas].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const tabs = [
    { id: "cadastro", label: "Cadastro", icon: <Users size={14} /> },
    ...sortedTurmas.map((t) => ({
      id: t.id,
      label: t.name,
      icon: <GraduationCap size={14} />,
      isTurma: true,
    })),
  ];

  const currentTurma = school.data.turmas.find((t) => t.id === activeTab);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-background">
      <a
        href="#main-content"
        className="school-skip-link"
        onClick={(event) => {
          // HashRouter owns the URL hash; move focus without changing the route.
          event.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus({ preventScroll: true });
          main?.scrollIntoView({ block: "start", behavior: "instant" });
        }}
      >Ir para o conteúdo principal</a>
      {/* Header */}
      <header
        className="app-header flex min-h-[var(--height-header)] min-w-0 items-center gap-2 border-b border-border bg-surface-header px-3 py-1.5 sm:gap-3 sm:px-4"
      >
        <img
          src="/app-icon.svg"
          alt="Ícone Diário do Professor"
          className="h-8 w-8 shrink-0 rounded-md border border-border"
        />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight text-brand sm:text-base">
            Diário do Professor
          </h1>
          <p className="hidden text-xs leading-tight text-muted-foreground sm:block">
            Notas e atividades
          </p>
        </div>
        <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Período</span>
          <select
            value={selectedTerm}
            onChange={(event) => setSelectedTerm(Number(event.target.value) as AcademicTerm)}
            className="min-h-11 max-w-[42vw] rounded-button border border-input bg-card px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:max-w-none"
            aria-label="Selecionar trimestre"
          >
            {ACADEMIC_TERMS.map((term) => (
              <option key={term} value={term} className="text-foreground">
                {getTermLabel(term)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* Tab bar - scrollable, touch-friendly */}
      <nav aria-label="Cadastro e turmas" className="app-class-navigation nav-scroll flex min-w-0 items-stretch gap-0.5 overflow-x-auto border-b border-border bg-card px-2 sm:px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              className={`flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[var(--height-navigation)] sm:px-4 sm:text-sm ${isActive ? "border-action text-action font-semibold" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Keep horizontal overflow inside the existing table wrappers; page scrolling allows
          the local search toolbar to remain sticky within its own gradebook panel. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {activeTab === "cadastro" && (
          <StudentRegistration
            data={school.data}
            addStudent={school.addStudent}
            removeStudent={school.removeStudent}
            transferStudent={school.transferStudent}
            addTurma={school.addTurma}
            removeTurma={school.removeTurma}
          />
        )}
        {currentTurma && (
          <TurmaTab
            turma={currentTurma}
            data={school.data}
            selectedTerm={selectedTerm}
            addStudent={school.addStudent}
            removeStudent={school.removeStudent}
            transferStudent={school.transferStudent}
            addActivity={school.addActivity}
            removeActivity={school.removeActivity}
            updateActivity={school.updateActivity}
            toggleActivityRecord={school.toggleActivityRecord}
            getActivityRecordFull={school.getActivityRecordFull}
            setActivityOnTimeOverride={school.setActivityOnTimeOverride}
            setStudentComponentScore={school.setStudentComponentScore}
            saveEvaluationConfiguration={school.saveEvaluationConfiguration}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
