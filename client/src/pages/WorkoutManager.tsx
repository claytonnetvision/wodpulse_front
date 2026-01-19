import { useState } from 'react';
import { useLocation } from 'wouter';
import { useWorkoutStorage } from '@/hooks/useWorkoutStorage';
import { Trash2, Plus, Eye, Edit2, Download, Upload, FileUp } from 'lucide-react';

export default function WorkoutManager() {
  const [, setLocation] = useLocation();
  const { workouts, getDaysWithWorkouts, deleteWorkout, importWorkouts, exportWorkouts, DAYS } = useWorkoutStorage();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const daysWithWorkouts = getDaysWithWorkouts();

  const handleDelete = (day: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o treino de ${day}?`)) {
      deleteWorkout(day);
      if (selectedDay === day) {
        setSelectedDay(null);
      }
    }
  };

  const handleExport = () => {
    const data = exportWorkouts();
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
    element.setAttribute('download', `treinos-${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (importWorkouts(content)) {
          alert('Treinos importados com sucesso!');
        } else {
          alert('Erro ao importar treinos. Verifique o formato do arquivo.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm">
        <div className="container py-4 md:py-6">
          <h1 className="neon-text text-2xl md:text-4xl font-bold tracking-wider mb-2">
            GERENCIAR TREINOS
          </h1>
          <p className="text-[#AAAAAA] text-sm">Crie, edite e organize seus treinos da semana</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Days List */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="text-lg font-mono tracking-widest text-[#FF6B35] mb-4">DIAS DA SEMANA</h2>
              
              <div className="space-y-2 mb-6">
                {DAYS.map(day => (
                  <div
                    key={day}
                    className={`p-3 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                      selectedDay === day
                        ? 'neon-box border-[#FF6B35]'
                        : daysWithWorkouts.includes(day)
                        ? 'border-[#00D9FF] hover:border-[#FF6B35]'
                        : 'border-[#333333] hover:border-[#00D9FF]'
                    }`}
                    onClick={() => setSelectedDay(day)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{day}</span>
                      {daysWithWorkouts.includes(day) && (
                        <span className="w-2 h-2 bg-[#00D9FF] rounded-full"></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (selectedDay) {
                      setLocation(`/editor?day=${selectedDay}`);
                    } else {
                      alert('Selecione um dia para criar/editar treino');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
                >
                  <Plus size={18} /> {selectedDay ? 'EDITAR' : 'CRIAR'}
                </button>

                {selectedDay && daysWithWorkouts.includes(selectedDay) && (
                  <>
                    <button
                      onClick={() => setLocation(`/display?day=${selectedDay}`)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200"
                    >
                      <Eye size={18} /> EXIBIR
                    </button>
                    <button
                      onClick={() => handleDelete(selectedDay)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#FF006E] hover:bg-[#FF006E]/10 text-[#FF006E] font-bold rounded transition-all duration-200"
                    >
                      <Trash2 size={18} /> DELETAR
                    </button>
                  </>
                )}
              </div>

              {/* PDF Upload */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => setLocation('/auto-import')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#00D9FF] hover:bg-[#00D9FF]/80 text-black font-bold rounded transition-all duration-200"
                >
                  <Upload size={18} /> IMPORTAR SEMANA (AUTO)
                </button>
                <button
                  onClick={() => setLocation('/pdf-upload')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#FF6B35] hover:bg-[#FF6B35]/10 text-[#FF6B35] font-bold rounded transition-all duration-200 text-sm"
                >
                  <Upload size={16} /> Importar Manual
                </button>
              </div>

              {/* Import/Export */}
              <div className="mt-6 pt-6 border-t border-[#333333] space-y-2">
                <label className="block w-full">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#FFD700] hover:bg-[#FFD700]/10 text-[#FFD700] font-bold rounded transition-all duration-200 cursor-pointer">
                    <Upload size={18} /> IMPORTAR
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#FFD700] hover:bg-[#FFD700]/10 text-[#FFD700] font-bold rounded transition-all duration-200"
                >
                  <Download size={18} /> EXPORTAR
                </button>
              </div>
            </div>
          </div>

          {/* Right: Workout Details */}
          <div className="lg:col-span-2">
            {selectedDay && daysWithWorkouts.includes(selectedDay) ? (
              <div className="space-y-6">
                <div className="neon-box p-6 md:p-8 rounded-lg">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-3xl md:text-4xl font-bold text-[#FF6B35] mb-2">
                        {workouts[selectedDay]?.focusTechnique || 'Sem foco'}
                      </h3>
                      <p className="text-[#00D9FF] font-mono text-sm">
                        {workouts[selectedDay]?.date || 'Sem data'}
                      </p>
                    </div>
                    <button
                      onClick={() => setLocation(`/editor?day=${selectedDay}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
                    >
                      <Edit2 size={16} /> EDITAR
                    </button>
                  </div>

                  {/* Sections */}
                  <div className="space-y-4">
                    {workouts[selectedDay]?.sections.map((section, idx) => (
                      <div key={section.id} className="border-l-4 border-[#FF6B35] pl-4 py-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xl font-bold text-[#FF6B35]">{section.title}</h4>
                          <span className="text-[#00D9FF] text-sm font-mono">{section.durationMinutes}'</span>
                        </div>
                        {section.content.length > 0 && (
                          <ul className="space-y-1">
                            {section.content.map((item, itemIdx) => (
                              <li key={itemIdx} className="text-white/70 text-sm flex items-start gap-2">
                                <span className="text-[#FF6B35]">▸</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="neon-box p-8 md:p-12 rounded-lg text-center">
                <p className="text-[#AAAAAA] text-lg mb-4">
                  {selectedDay
                    ? `Nenhum treino criado para ${selectedDay}`
                    : 'Selecione um dia para ver os detalhes'}
                </p>
                {selectedDay && (
                  <button
                    onClick={() => setLocation(`/editor?day=${selectedDay}`)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
                  >
                    <Plus size={18} /> CRIAR TREINO
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-12 pt-8 border-t border-[#333333]">
          <h3 className="text-lg font-mono tracking-widest text-[#FF6B35] mb-4">RESUMO</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neon-box p-4 rounded-lg text-center">
              <p className="text-[#AAAAAA] text-sm mb-2">TREINOS CRIADOS</p>
              <p className="text-3xl font-bold text-[#FF6B35]">{daysWithWorkouts.length}</p>
            </div>
            <div className="neon-box p-4 rounded-lg text-center">
              <p className="text-[#AAAAAA] text-sm mb-2">DIAS DISPONÍVEIS</p>
              <p className="text-3xl font-bold text-[#00D9FF]">{DAYS.length}</p>
            </div>
            <div className="neon-box p-4 rounded-lg text-center">
              <p className="text-[#AAAAAA] text-sm mb-2">FALTAM</p>
              <p className="text-3xl font-bold text-[#FFD700]">{DAYS.length - daysWithWorkouts.length}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
