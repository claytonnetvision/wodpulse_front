import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWorkoutStorage } from '@/hooks/useWorkoutStorage';
import WorkoutForm, { WorkoutData } from '@/components/WorkoutForm';
import { Eye, Edit2, ChevronLeft } from 'lucide-react';

export default function Editor() {
  const [, setLocation] = useLocation();
  const { saveWorkout, getWorkout, DAYS } = useWorkoutStorage();
  const [selectedDay, setSelectedDay] = useState<string>('Segunda-feira');
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get day from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day');
    if (dayParam && DAYS.includes(dayParam)) {
      setSelectedDay(dayParam);
      const saved = getWorkout(dayParam);
      if (saved) {
        setWorkoutData(saved);
      }
    }
  }, [DAYS, getWorkout]);

  const handleSaveWorkout = (data: WorkoutData) => {
    const finalData = { ...data, dayOfWeek: selectedDay };
    setWorkoutData(finalData);
    saveWorkout(selectedDay, finalData);
    setShowPreview(true);
  };

  const handleEditAgain = () => {
    setShowPreview(false);
  };

  const handleChangeDay = (newDay: string) => {
    setSelectedDay(newDay);
    const saved = getWorkout(newDay);
    if (saved) {
      setWorkoutData(saved);
    } else {
      setWorkoutData(null);
    }
    setShowPreview(false);
  };

  if (showPreview && workoutData) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm">
          <div className="container py-4 flex justify-between items-center">
            <h1 className="neon-text text-2xl md:text-4xl font-bold tracking-wider">
              PREVIEW
            </h1>
            <div className="flex gap-4">
              <button
                onClick={handleEditAgain}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200"
              >
                <Edit2 size={18} /> EDITAR
              </button>
              <button
                onClick={() => setLocation(`/display?day=${selectedDay}`)}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
              >
                <Eye size={18} /> EXIBIR NA TV
              </button>
            </div>
          </div>
        </header>

        {/* Preview Content */}
        <main className="container py-12">
          <div className="space-y-8">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center neon-box p-8 rounded-lg">
              <div>
                <p className="text-xs md:text-sm text-[#AAAAAA] font-mono mb-2">DATA</p>
                <p className="text-xl md:text-2xl font-bold text-[#FF6B35]">{workoutData.date}</p>
              </div>
              <div className="text-center">
                <p className="text-xs md:text-sm text-[#AAAAAA] font-mono mb-2">DIA</p>
                <p className="text-xl md:text-2xl font-bold text-[#00D9FF]">{workoutData.dayOfWeek}</p>
              </div>
              <div className="text-right">
                <p className="text-xs md:text-sm text-[#AAAAAA] font-mono mb-2">FOCO TÉCNICO</p>
                <p className="text-xl md:text-2xl font-bold text-[#FFD700]">{workoutData.focusTechnique}</p>
              </div>
            </div>

            {/* Sections Preview */}
            <div className="space-y-6">
              {workoutData.sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="neon-box p-6 md:p-8 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-bold text-[#FF6B35] tracking-wider mb-2">
                        {section.title}
                      </h2>
                      <p className="text-[#00D9FF] font-mono text-sm">
                        {section.durationMinutes}' minutos
                      </p>
                    </div>
                    <span className="px-4 py-2 border border-[#FF6B35] rounded text-[#FF6B35] font-mono text-sm">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {section.content.length > 0 && (
                    <ul className="space-y-2 ml-4">
                      {section.content.map((item, itemIdx) => (
                        <li
                          key={itemIdx}
                          className="text-base md:text-lg text-white/90 flex items-start gap-3"
                        >
                          <span className="text-[#FF6B35] font-bold mt-1">▸</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setLocation('/manager')}
              className="flex items-center gap-2 px-3 py-2 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200 text-sm"
            >
              <ChevronLeft size={16} /> VOLTAR
            </button>
          </div>
          <h1 className="neon-text text-2xl md:text-4xl font-bold tracking-wider">
            CRIAR TREINO
          </h1>
          <p className="text-[#AAAAAA] text-sm mt-2">Preencha os dados abaixo para criar um novo treino</p>
        </div>
      </header>

      {/* Day Selector */}
      <div className="container py-6 border-b border-[#333333]">
        <p className="text-sm font-mono text-[#AAAAAA] mb-3">SELECIONE O DIA</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => handleChangeDay(day)}
              className={`px-3 py-2 rounded font-mono text-xs md:text-sm transition-all duration-200 ${
                selectedDay === day
                  ? 'neon-box text-[#FF6B35]'
                  : 'border border-[#333333] text-[#AAAAAA] hover:border-[#FF6B35]'
              }`}
            >
              {day.split('-')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <main className="container py-12">
        <div className="max-w-4xl">
          <WorkoutForm 
            onSave={handleSaveWorkout}
            initialData={workoutData || undefined}
          />
        </div>
      </main>
    </div>
  );
}
