import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

export interface WorkoutData {
  date: string;
  dayOfWeek: string;
  focusTechnique: string;
  sections: Array<{
    id: string;
    title: string;
    durationMinutes: number;
    content: string[];
  }>;
}

interface WorkoutFormProps {
  onSave: (data: WorkoutData) => void;
  initialData?: WorkoutData;
}

export default function WorkoutForm({ onSave, initialData }: WorkoutFormProps) {
  const [date, setDate] = useState(initialData?.date || '');
  const [dayOfWeek, setDayOfWeek] = useState(initialData?.dayOfWeek || 'Segunda-feira');
  const [focusTechnique, setFocusTechnique] = useState(initialData?.focusTechnique || '');
  const [sections, setSections] = useState(
    initialData?.sections || [
      { id: '1', title: 'Mobility', durationMinutes: 3, content: [''] },
      { id: '2', title: 'Warm-up', durationMinutes: 12, content: [''] },
      { id: '3', title: 'Skill', durationMinutes: 15, content: [''] },
      { id: '4', title: 'Strength', durationMinutes: 10, content: [''] },
      { id: '5', title: '#WOD', durationMinutes: 15, content: [''] },
    ]
  );

  const handleSectionChange = (sectionId: string, field: string, value: any) => {
    setSections(sections.map(section =>
      section.id === sectionId ? { ...section, [field]: value } : section
    ));
  };

  const handleContentChange = (sectionId: string, index: number, value: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? {
            ...section,
            content: section.content.map((item, i) => (i === index ? value : item)),
          }
        : section
    ));
  };

  const addContentLine = (sectionId: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, content: [...section.content, ''] }
        : section
    ));
  };

  const removeContentLine = (sectionId: string, index: number) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, content: section.content.filter((_, i) => i !== index) }
        : section
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filteredSections = sections.map(section => ({
      ...section,
      content: section.content.filter(item => item.trim() !== ''),
    }));

    onSave({
      date,
      dayOfWeek,
      focusTechnique,
      sections: filteredSections,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-mono text-[#AAAAAA] mb-2">DATA</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-mono text-[#AAAAAA] mb-2">DIA DA SEMANA</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="w-full px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
          >
            <option>Segunda-feira</option>
            <option>Terça-feira</option>
            <option>Quarta-feira</option>
            <option>Quinta-feira</option>
            <option>Sexta-feira</option>
            <option>Sábado</option>
            <option>Domingo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-mono text-[#AAAAAA] mb-2">FOCO TÉCNICO</label>
          <input
            type="text"
            value={focusTechnique}
            onChange={(e) => setFocusTechnique(e.target.value)}
            placeholder="Ex: THRUSTER"
            className="w-full px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
            required
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        <h3 className="text-lg font-mono text-[#FF6B35] tracking-widest">SEÇÕES DO TREINO</h3>
        
        {sections.map((section) => (
          <div
            key={section.id}
            className="neon-box p-6 rounded-lg space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-mono text-[#AAAAAA] mb-2">TÍTULO</label>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) =>
                    handleSectionChange(section.id, 'title', e.target.value)
                  }
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-[#AAAAAA] mb-2">DURAÇÃO (minutos)</label>
                <input
                  type="number"
                  value={section.durationMinutes}
                  onChange={(e) =>
                    handleSectionChange(section.id, 'durationMinutes', parseInt(e.target.value))
                  }
                  min="1"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
                  required
                />
              </div>
            </div>

            {/* Content Lines */}
            <div>
              <label className="block text-sm font-mono text-[#AAAAAA] mb-2">CONTEÚDO</label>
              <div className="space-y-2">
                {section.content.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) =>
                        handleContentChange(section.id, index, e.target.value)
                      }
                      placeholder={`Linha ${index + 1}`}
                      className="flex-1 px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono focus:outline-none focus:border-[#FF6B35]"
                    />
                    {section.content.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContentLine(section.id, index)}
                        className="px-3 py-2 bg-[#FF006E]/20 border border-[#FF006E] rounded text-[#FF006E] hover:bg-[#FF006E]/30 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addContentLine(section.id)}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#00D9FF]/20 border border-[#00D9FF] rounded text-[#00D9FF] hover:bg-[#00D9FF]/30 transition-colors text-sm"
              >
                <Plus size={16} /> Adicionar linha
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          className="flex items-center gap-2 px-8 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200 text-lg"
        >
          <Save size={20} /> SALVAR E EXIBIR
        </button>
      </div>
    </form>
  );
}
