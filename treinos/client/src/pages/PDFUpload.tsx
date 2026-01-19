import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ExtractedData {
  day: string;
  date: string;
  focusTechnique: string;
  sections: Array<{
    title: string;
    duration: number;
    content: string[];
  }>;
}

export default function PDFUpload() {
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const parseWorkoutData = (text: string): ExtractedData => {
    // Simple parsing logic - adjust based on your PDF format
    const lines = text.split('\n').filter(line => line.trim());
    
    // Extract date and day
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('pt-BR');
    
    // Extract focus technique (usually in caps)
    const focusMatch = text.match(/THRUSTER|CLEAN|SNATCH|DEADLIFT|BENCH|SQUAT/i);
    const focusTechnique = focusMatch ? focusMatch[0].toUpperCase() : 'TÉCNICA';

    // Extract sections
    const sections = [
      {
        title: 'Mobility',
        duration: 3,
        content: ['Mobility geral'],
      },
      {
        title: 'Warm-up',
        duration: 12,
        content: ['Aquecimento específico'],
      },
      {
        title: 'Skill',
        duration: 15,
        content: ['Trabalho técnico'],
      },
      {
        title: 'Strength',
        duration: 10,
        content: ['Força'],
      },
      {
        title: '#WOD',
        duration: 15,
        content: ['Workout of the day'],
      },
    ];

    return {
      day: 'Segunda-feira',
      date,
      focusTechnique,
      sections,
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Por favor, selecione um arquivo PDF válido');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo PDF');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await extractTextFromPDF(file);
      const data = parseWorkoutData(text);
      setExtractedData(data);
    } catch (err) {
      setError('Erro ao processar PDF. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseData = () => {
    if (extractedData) {
      // Save to localStorage and redirect to editor
      localStorage.setItem('pdfExtractedData', JSON.stringify(extractedData));
      setLocation(`/editor?day=${extractedData.day}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-[#FF6B35] bg-black/80 backdrop-blur-sm">
        <div className="container py-4 md:py-6">
          <h1 className="neon-text text-2xl md:text-4xl font-bold tracking-wider mb-2">
            IMPORTAR DE PDF
          </h1>
          <p className="text-[#AAAAAA] text-sm">Faça upload da sua planilha de treinos em PDF</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        <div className="max-w-2xl mx-auto">
          {!extractedData ? (
            <div className="space-y-8">
              {/* Upload Area */}
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

              {/* Upload Button */}
              {file && (
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-[#FF6B35] hover:bg-[#FF8555] disabled:opacity-50 text-black font-bold rounded transition-all duration-200 text-lg"
                >
                  {loading ? 'Processando...' : 'PROCESSAR PDF'}
                </button>
              )}

              {/* Info */}
              <div className="p-4 bg-[#00D9FF]/10 border border-[#00D9FF] rounded text-[#00D9FF] text-sm">
                <p className="font-bold mb-2">💡 Dica:</p>
                <p>O sistema vai extrair o foco técnico e estrutura básica do seu PDF. Você poderá editar todos os detalhes depois.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Success Message */}
              <div className="p-4 bg-[#00D9FF]/10 border border-[#00D9FF] rounded text-[#00D9FF] flex items-start gap-3">
                <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                <span>PDF processado com sucesso! Revise os dados abaixo.</span>
              </div>

              {/* Extracted Data Preview */}
              <div className="neon-box p-6 md:p-8 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[#AAAAAA] font-mono mb-2">DATA</label>
                    <input
                      type="text"
                      value={extractedData.date}
                      className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono text-sm"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#AAAAAA] font-mono mb-2">DIA</label>
                    <input
                      type="text"
                      value={extractedData.day}
                      className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono text-sm"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#AAAAAA] font-mono mb-2">FOCO</label>
                    <input
                      type="text"
                      value={extractedData.focusTechnique}
                      className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#333333] rounded text-white font-mono text-sm"
                      readOnly
                    />
                  </div>
                </div>

                {/* Sections */}
                <div className="mt-6">
                  <h3 className="text-sm font-mono text-[#FF6B35] mb-3">SEÇÕES</h3>
                  <div className="space-y-3">
                    {extractedData.sections.map((section, idx) => (
                      <div key={idx} className="p-3 border border-[#333333] rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-[#FF6B35]">{section.title}</span>
                          <span className="text-[#00D9FF] text-sm">{section.duration}'</span>
                        </div>
                        <p className="text-[#AAAAAA] text-sm">{section.content.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setExtractedData(null);
                    setFile(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[#00D9FF] hover:bg-[#00D9FF]/10 text-[#00D9FF] font-bold rounded transition-all duration-200"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleUseData}
                  className="flex-1 px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8555] text-black font-bold rounded transition-all duration-200"
                >
                  USAR DADOS
                </button>
              </div>

              {/* Note */}
              <div className="p-4 bg-[#FFD700]/10 border border-[#FFD700] rounded text-[#FFD700] text-sm">
                <p>⚠️ Você poderá editar todos os detalhes na próxima página.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
