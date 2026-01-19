import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import { useWorkoutStorage } from '@/hooks/useWorkoutStorage';
import { extractTextFromPDF, parseWorkoutFromText, debugParsedData } from '@/lib/pdfParser';
import { WorkoutData } from '@/components/WorkoutForm';

interface ImportProgress {
  total: number;
  completed: number;
  current: string;
}

export default function AutoImport() {
  const [, setLocation] = useLocation();
  const { saveWorkout, DAYS } = useWorkoutStorage();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [results, setResults] = useState<Record<string, WorkoutData | null>>({});
  const [showDebug, setShowDebug] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setResults({});
    } else {
      setError('Por favor, selecione um arquivo PDF válido');
      setFile(null);
    }
  };

  const handleAutoImport = async () => {
    if (!file) {
      setError('Selecione um arquivo PDF');
      return;
    }

    setLoading(true);
    setError(null);
    setResults({});

    try {
      // Extrai texto do PDF
      setProgress({ total: DAYS.length, completed: 0, current: 'Extraindo texto...' });
      const text = await extractTextFromPDF(file);

      // Divide o texto por seções (heurística simples)
      const dayPatterns = [
        { day: 'Segunda-feira', pattern: /segunda[^t]*?(?=terça|$)/i },
        { day: 'Terça-feira', pattern: /terça[^q]*?(?=quarta|$)/i },
        { day: 'Quarta-feira', pattern: /quarta[^q]*?(?=quinta|$)/i },
        { day: 'Quinta-feira', pattern: /quinta[^s]*?(?=sexta|$)/i },
        { day: 'Sexta-feira', pattern: /sexta[^s]*?(?=sábado|$)/i },
        { day: 'Sábado', pattern: /sábado[^d]*?(?=domingo|$)/i },
        { day: 'Domingo', pattern: /domingo[^s]*$/i },
      ];

      const importedResults: Record<string, WorkoutData | null> = {};
      let completed = 0;

      for (const { day, pattern } of dayPatterns) {
        setProgress({ total: DAYS.length, completed, current: `Processando ${day}...` });

        const match = text.match(pattern);
        if (match) {
          try {
            const workout = parseWorkoutFromText(match[0]);
            importedResults[day] = workout;

            // Salva automaticamente
            saveWorkout(day, workout);

            if (showDebug) {
              debugParsedData(workout);
            }
          } catch (err) {
            console.error(`Erro ao processar ${day}:`, err);
            importedResults[day] = null;
          }
        } else {
          importedResults[day] = null;
        }

        completed++;
      }

      setResults(importedResults);
      setProgress(null);
    } catch (err) {
      setError('Erro ao processar PDF. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const successCount = Object.values(results).filter(r => r !== null).length;
  const failureCount = Object.values(results).filter(r => r === null).length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm">
        <div className="container py-4 md:py-6">
          <h1 className="neon-text text-2xl md:text-4xl font-bold tracking-wider mb-2">
            IMPORTAR SEMANA COMPLETA
          </h1>
          <p className="text-[#AAAAAA] text-sm">
            Carregue seu PDF e todos os treinos da semana serão extraídos automaticamente
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Upload Area */}
          {Object.keys(results).length === 0 ? (
            <div className="space-y-6">
              <div
                className="neon-box p-8 md:p-12 rounded-lg text-center cursor-pointer hover:border-[#FF6B35] transition-all duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <Upload size={48} className="mx-auto mb-4 text-[#FF6B35]" />

                <h2 className="text-2xl font-bold text-[#FF6B35] mb-2">
                  Clique para selecionar PDF
                </h2>
                <p className="text-[#AAAAAA] mb-4">
                  ou arraste o arquivo aqui
                </p>

                {file && (
                  <div className="mt-4 p-3 bg-[#00D9FF]/10 border border-[#00D9FF] rounded text-[#00D9FF] text-sm">
                    <FileText className="inline mr-2" size={16} />
                    {file.name}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-[#FF006E]/10 border border-[#FF006E] rounded text-[#FF006E] flex items-start gap-3">
                  <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Import Button */}
              {file && !loading && (
                <button
                  onClick={handleAutoImport}
                  className="w-full px-6 py-4 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200 text-lg"
                >
                  IMPORTAR SEMANA COMPLETA
                </button>
              )}

              {/* Loading State */}
              {loading && progress && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader size={24} className="animate-spin text-[#FF6B35]" />
                    <div>
                      <p className="font-bold text-[#FF6B35]">{progress.current}</p>
                      <p className="text-[#AAAAAA] text-sm">
                        {progress.completed} de {progress.total} dias
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-[#333333] rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#FF6B35] to-[#00D9FF] h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(progress.completed / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-4 bg-[#00D9FF]/10 border border-[#00D9FF] rounded text-[#00D9FF] text-sm">
                <p className="font-bold mb-2">💡 Como funciona:</p>
                <ul className="space-y-1 text-xs">
                  <li>✓ Faça upload do seu PDF com a planilha de treinos</li>
                  <li>✓ O sistema extrai automaticamente todos os dias da semana</li>
                  <li>✓ Cada treino é salvo independentemente</li>
                  <li>✓ Você pode editar qualquer treino depois</li>
                </ul>
              </div>

              {/* Debug Toggle */}
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-[#AAAAAA] hover:text-[#FF6B35] transition-colors"
              >
                {showDebug ? '🔍 Debug ON' : '🔍 Debug OFF'}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="neon-box p-4 rounded-lg text-center">
                  <p className="text-[#AAAAAA] text-sm mb-2">IMPORTADOS COM SUCESSO</p>
                  <p className="text-3xl font-bold text-[#00D9FF]">{successCount}</p>
                </div>
                <div className="neon-box p-4 rounded-lg text-center">
                  <p className="text-[#AAAAAA] text-sm mb-2">TOTAL DE DIAS</p>
                  <p className="text-3xl font-bold text-[#FF6B35]">{Object.keys(results).length}</p>
                </div>
                <div className="neon-box p-4 rounded-lg text-center">
                  <p className="text-[#AAAAAA] text-sm mb-2">COM PROBLEMAS</p>
                  <p className="text-3xl font-bold text-[#FFD700]">{failureCount}</p>
                </div>
              </div>

              {/* Results Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-mono tracking-widest text-[#FF6B35]">DETALHES</h3>

                {Object.entries(results).map(([day, workout]) => (
                  <div
                    key={day}
                    className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                      workout
                        ? 'neon-box border-[#00D9FF]'
                        : 'border-[#FF006E] bg-[#FF006E]/5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {workout ? (
                          <CheckCircle size={20} className="text-[#00D9FF]" />
                        ) : (
                          <AlertCircle size={20} className="text-[#FF006E]" />
                        )}
                        <span className="font-bold text-[#FF6B35]">{day}</span>
                      </div>
                      {workout && (
                        <button
                          onClick={() => setLocation(`/display?day=${day}`)}
                          className="text-xs px-3 py-1 border border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] rounded transition-all duration-200"
                        >
                          VER
                        </button>
                      )}
                    </div>

                    {workout ? (
                      <div className="ml-6 space-y-1 text-sm">
                        <p className="text-[#AAAAAA]">
                          <span className="text-[#00D9FF]">Data:</span> {workout.date}
                        </p>
                        <p className="text-[#AAAAAA]">
                          <span className="text-[#00D9FF]">Foco:</span> {workout.focusTechnique}
                        </p>
                        <p className="text-[#AAAAAA]">
                          <span className="text-[#00D9FF]">Seções:</span> {workout.sections.length}
                        </p>
                      </div>
                    ) : (
                      <p className="ml-6 text-sm text-[#FF006E]">
                        Não foi possível extrair dados para este dia
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setResults({});
                    setFile(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200"
                >
                  IMPORTAR OUTRO PDF
                </button>
                <button
                  onClick={() => setLocation('/manager')}
                  className="flex-1 px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
                >
                  IR PARA GERENCIADOR
                </button>
              </div>

              {/* Success Message */}
              {successCount > 0 && (
                <div className="p-4 bg-[#00D9FF]/10 border border-[#00D9FF] rounded text-[#00D9FF] flex items-start gap-3">
                  <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <span>
                    ✓ {successCount} treino{successCount > 1 ? 's' : ''} importado{successCount > 1 ? 's' : ''} com sucesso!
                    Acesse o gerenciador para visualizar e editar.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
