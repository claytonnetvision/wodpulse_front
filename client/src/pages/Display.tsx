import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useWorkoutStorage } from '@/hooks/useWorkoutStorage';
import { Clock, Zap, Target, Flame, Play, Pause, RotateCcw, Edit2, ChevronLeft } from 'lucide-react';
import { WorkoutData } from '@/components/WorkoutForm';

interface TimerState {
  isRunning: boolean;
  timeLeft: number;
  isFinished: boolean;
}

const getIcon = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes('mobility')) return <Clock size={32} />;
  if (lower.includes('warm')) return <Zap size={32} />;
  if (lower.includes('skill')) return <Target size={32} />;
  if (lower.includes('strength') || lower.includes('wod')) return <Flame size={32} />;
  return <Clock size={32} />;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function Display() {
  const [, setLocation] = useLocation();
  const { getWorkout, DAYS } = useWorkoutStorage();
  const [selectedDay, setSelectedDay] = useState<string>('Segunda-feira');
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load workout data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day');
    
    if (dayParam && DAYS.includes(dayParam)) {
      setSelectedDay(dayParam);
    }
  }, [DAYS]);

  // Load workout when day changes
  useEffect(() => {
    const data = getWorkout(selectedDay);
    if (data) {
      setWorkoutData(data);

      // Initialize timers
      const initialStates: Record<string, TimerState> = {};
      data.sections.forEach((section: any) => {
        initialStates[section.id] = {
          isRunning: false,
          timeLeft: section.durationMinutes * 60,
          isFinished: false,
        };
      });
      setTimerStates(initialStates);
    }
  }, [selectedDay, getWorkout]);

  // Timer interval
  useEffect(() => {
    if (Object.values(timerStates).some(state => state.isRunning)) {
      intervalRef.current = setInterval(() => {
        setTimerStates(prev => {
          const newStates = { ...prev };
          let anyRunning = false;

          Object.keys(newStates).forEach(sectionId => {
            if (newStates[sectionId].isRunning) {
              anyRunning = true;
              if (newStates[sectionId].timeLeft > 0) {
                newStates[sectionId].timeLeft -= 1;
              } else {
                newStates[sectionId].isRunning = false;
                newStates[sectionId].isFinished = true;
              }
            }
          });

          if (!anyRunning && intervalRef.current) {
            clearInterval(intervalRef.current);
          }

          return newStates;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerStates]);

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    setScrollProgress(scrolled);
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTimer = (sectionId: string) => {
    setTimerStates(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        isRunning: !prev[sectionId].isRunning,
      },
    }));
  };

  const resetTimer = (sectionId: string) => {
    if (!workoutData) return;
    const section = workoutData.sections.find(s => s.id === sectionId);
    if (section) {
      setTimerStates(prev => ({
        ...prev,
        [sectionId]: {
          isRunning: false,
          timeLeft: section.durationMinutes * 60,
          isFinished: false,
        },
      }));
    }
  };

  const getTimerProgressPercentage = (sectionId: string): number => {
    if (!workoutData) return 0;
    const section = workoutData.sections.find(s => s.id === sectionId);
    if (!section) return 0;
    const totalSeconds = section.durationMinutes * 60;
    const timeLeft = timerStates[sectionId]?.timeLeft || totalSeconds;
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  };

  if (!workoutData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-[#FF6B35]">Nenhum treino carregado</h1>
          <p className="text-[#AAAAAA]">Crie um treino primeiro na página de editor</p>
          <button
            onClick={() => setLocation('/editor')}
            className="px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
          >
            Ir para Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-[#FF6B35] to-[#00D9FF] z-50 transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Header */}
      <header className="relative border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-8 md:py-12">
          <div className="flex justify-between items-start mb-6">
            <button
              onClick={() => setLocation('/manager')}
              className="flex items-center gap-2 px-4 py-2 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200 text-sm"
            >
              <ChevronLeft size={16} /> VOLTAR
            </button>
            <button
              onClick={() => setLocation(`/editor?day=${selectedDay}`)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200 text-sm"
            >
              <Edit2 size={16} /> EDITAR
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center">
            {/* Logo Section */}
            <div className="flex items-center justify-center md:justify-start">
              <div className="neon-text text-3xl md:text-4xl font-bold tracking-wider">
                V6
              </div>
              <div className="ml-3 text-xs md:text-sm text-[#00D9FF] font-mono tracking-widest">
                CROSSFIT
              </div>
            </div>

            {/* Main Title */}
            <div className="text-center">
              <h1 className="neon-text text-4xl md:text-6xl font-bold tracking-wider mb-2">
                TREINO
              </h1>
              <p className="text-[#00D9FF] text-sm md:text-base font-mono tracking-widest">
                {workoutData.dayOfWeek.toUpperCase()} • {workoutData.date}
              </p>
            </div>

            {/* Focus */}
            <div className="flex items-center justify-center md:justify-end">
              <div className="text-right">
                <p className="text-xs md:text-sm text-[#AAAAAA] font-mono mb-2">FOCO TÉCNICO</p>
                <p className="text-2xl md:text-3xl font-bold text-[#FFD700] tracking-wider">
                  {workoutData.focusTechnique}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* Timeline Sidebar */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <div className="sticky top-24 space-y-4">
              <h2 className="text-sm font-mono tracking-widest text-[#AAAAAA] mb-6">
                SEQUÊNCIA
              </h2>
              {workoutData.sections.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => {
                    const element = document.getElementById(section.id);
                    element?.scrollIntoView({ behavior: 'smooth' });
                    setActiveSection(idx);
                  }}
                  className={`w-full text-left p-3 md:p-4 rounded-lg transition-all duration-300 font-mono text-xs md:text-sm tracking-wider ${
                    activeSection === idx
                      ? 'neon-box scale-105'
                      : 'border border-[#333333] hover:border-[#FF6B35]/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#FF6B35]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-white/70">{section.title}</span>
                  </div>
                  <div className="text-[#00D9FF] text-xs mt-1">{section.durationMinutes}'</div>
                  {timerStates[section.id] && (
                    <div className="text-[#FF6B35] text-xs mt-2 font-bold">
                      {formatTime(timerStates[section.id].timeLeft)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9 order-1 lg:order-2 space-y-8 md:space-y-12">
            {workoutData.sections.map((section, idx) => (
              <section
                key={section.id}
                id={section.id}
                className="neon-box p-6 md:p-8 rounded-lg transition-all duration-500 hover:scale-102 relative overflow-hidden"
              >
                {/* Timer Progress Bar */}
                <div
                  className="absolute top-0 left-0 h-1 bg-gradient-to-r from-[#FF6B35] to-[#00D9FF]"
                  style={{
                    width: `${getTimerProgressPercentage(section.id)}%`,
                    transition: 'width 0.1s linear',
                  }}
                />

                {/* Section Header */}
                <div className="flex items-start justify-between mb-6 md:mb-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 md:gap-4 mb-2">
                      <div className="text-[#FF6B35] pulse-glow">
                        {getIcon(section.title)}
                      </div>
                      <h2 className="text-3xl md:text-5xl font-bold tracking-wider text-[#FF6B35]">
                        {section.title}
                      </h2>
                    </div>
                    <p className="text-[#00D9FF] font-mono text-xs md:text-sm tracking-widest ml-11 md:ml-14">
                      {section.durationMinutes} minutos
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className="inline-block px-3 md:px-4 py-1 md:py-2 border border-[#FF6B35] rounded text-[#FF6B35] font-mono text-xs md:text-sm">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Timer Display */}
                <div className="mb-6 md:mb-8 p-4 md:p-6 neon-box rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[#AAAAAA] font-mono text-xs md:text-sm tracking-widest">
                      CRONÔMETRO
                    </span>
                    <span
                      className={`text-xs md:text-sm font-mono ${
                        timerStates[section.id]?.isFinished
                          ? 'text-[#FF006E] animate-pulse'
                          : 'text-[#00D9FF]'
                      }`}
                    >
                      {timerStates[section.id]?.isFinished ? 'CONCLUÍDO' : 'ATIVO'}
                    </span>
                  </div>

                  <div className="text-center mb-4">
                    <div
                      className={`text-5xl md:text-7xl font-bold font-mono tracking-wider ${
                        timerStates[section.id]?.isFinished
                          ? 'text-[#FF006E]'
                          : 'text-[#FF6B35] neon-text'
                      }`}
                    >
                      {timerStates[section.id]
                        ? formatTime(timerStates[section.id].timeLeft)
                        : '00:00'}
                    </div>
                  </div>

                  {/* Timer Controls */}
                  <div className="flex gap-2 md:gap-4 justify-center">
                    <button
                      onClick={() => toggleTimer(section.id)}
                      className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200 text-sm md:text-base"
                    >
                      {timerStates[section.id]?.isRunning ? (
                        <>
                          <Pause size={18} /> PAUSAR
                        </>
                      ) : (
                        <>
                          <Play size={18} /> INICIAR
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => resetTimer(section.id)}
                      className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200 text-sm md:text-base"
                    >
                      <RotateCcw size={18} /> RESET
                    </button>
                  </div>
                </div>

                {/* Section Content */}
                {section.content.length > 0 && (
                  <div className="ml-11 md:ml-14">
                    <ul className="space-y-2 md:space-y-3">
                      {section.content.map((item, itemIdx) => (
                        <li
                          key={itemIdx}
                          className="text-base md:text-2xl text-white/90 font-light leading-relaxed flex items-start gap-3"
                        >
                          <span className="text-[#FF6B35] font-bold mt-1">▸</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decorative Elements */}
                <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-[#333333]/50 flex justify-between items-center">
                  <div className="text-xs text-[#AAAAAA] font-mono">
                    SEÇÃO {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="h-1 flex-1 mx-4 bg-gradient-to-r from-[#FF6B35]/20 to-transparent rounded-full" />
                  <div className="text-xs text-[#00D9FF] font-mono">
                    {section.durationMinutes}'
                  </div>
                </div>
              </section>
            ))}

            {/* Footer */}
            <div className="mt-12 md:mt-16 pt-8 border-t border-[#333333] text-center">
              <p className="text-[#AAAAAA] font-mono text-xs md:text-sm tracking-widest mb-2">
                V6 CROSSFIT • BELO HORIZONTE
              </p>
              <p className="text-[#666666] text-xs">
                Treino do dia • {workoutData.dayOfWeek} • {workoutData.date}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 p-4 neon-box rounded-full hover:scale-110 transition-transform duration-300 z-40"
        aria-label="Voltar ao topo"
      >
        <svg
          className="w-6 h-6 text-[#FF6B35]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
}
