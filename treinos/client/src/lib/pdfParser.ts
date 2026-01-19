import * as pdfjsLib from 'pdfjs-dist';
import { WorkoutData } from '@/components/WorkoutForm';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface RawWorkoutData {
  date: string;
  day: string;
  focusTechnique: string;
  mobility: string[];
  warmup: string[];
  skill: string[];
  strength: string[];
  wod: string[];
}

/**
 * Extrai texto do PDF
 */
export async function extractTextFromPDF(file: File): Promise<string> {
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
}

/**
 * Mapeia dias da semana em português
 */
const DAYS_MAP: Record<string, string> = {
  'segunda': 'Segunda-feira',
  'segunda-feira': 'Segunda-feira',
  'terça': 'Terça-feira',
  'terça-feira': 'Terça-feira',
  'quarta': 'Quarta-feira',
  'quarta-feira': 'Quarta-feira',
  'quinta': 'Quinta-feira',
  'quinta-feira': 'Quinta-feira',
  'sexta': 'Sexta-feira',
  'sexta-feira': 'Sexta-feira',
  'sábado': 'Sábado',
  'domingo': 'Domingo',
};

/**
 * Extrai data no formato DD/mês
 */
function extractDate(text: string): string {
  const dateMatch = text.match(/(\d{1,2})\/[a-z]{3}/i);
  return dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR').substring(0, 5);
}

/**
 * Extrai o dia da semana
 */
function extractDay(text: string): string {
  const dayMatch = text.match(/segunda|terça|quarta|quinta|sexta|sábado|domingo/i);
  if (!dayMatch) return 'Segunda-feira';
  const day = dayMatch[0].toLowerCase();
  return DAYS_MAP[day] || 'Segunda-feira';
}

/**
 * Extrai foco técnico (primeira linha em maiúsculas)
 */
function extractFocusTechnique(text: string): string {
  // Procura por palavras em maiúsculas que são técnicas conhecidas
  const techniques = [
    'THRUSTER', 'CLEAN', 'SNATCH', 'DEADLIFT', 'BENCH', 'SQUAT',
    'RING MUSCLE UP', 'CONDITIONING', 'JERK', 'PRESS', 'FRONT SQUAT',
    'BACK SQUAT', 'POWER CLEAN', 'POWER SNATCH', 'MUSCLE UP'
  ];

  for (const technique of techniques) {
    if (text.toUpperCase().includes(technique)) {
      return technique;
    }
  }

  // Se não encontrar, procura por qualquer palavra em maiúsculas
  const allCapsMatch = text.match(/\b[A-Z]{3,}\b/);
  return allCapsMatch ? allCapsMatch[0] : 'TÉCNICA';
}

/**
 * Extrai conteúdo de uma seção
 */
function extractSectionContent(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Remove caracteres especiais e quebras de linha
  const cleaned = text
    .replace(/\n+/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== '-');

  return cleaned;
}

/**
 * Calcula duração em minutos a partir de "X' a Y'"
 */
function calculateDuration(timeRange: string): number {
  const match = timeRange.match(/(\d+)'\s*a\s*(\d+)'/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Math.max(1, end - start);
  }

  // Tenta encontrar apenas um número
  const singleMatch = timeRange.match(/(\d+)'/);
  if (singleMatch) {
    return Math.max(1, parseInt(singleMatch[1]));
  }

  return 10; // Padrão
}

/**
 * Extrai duração de uma seção
 */
function extractDuration(text: string): number {
  // Procura por padrão "X' a Y'" ou apenas "X'"
  const durationMatch = text.match(/(\d+)'\s*(?:a\s*(\d+)')?/);
  
  if (durationMatch) {
    if (durationMatch[2]) {
      // Formato "X' a Y'"
      return Math.max(1, parseInt(durationMatch[2]) - parseInt(durationMatch[1]));
    } else {
      // Formato "X'"
      return Math.max(1, parseInt(durationMatch[1]));
    }
  }

  return 10; // Padrão
}

/**
 * Separa conteúdo em seções (Mobility, Warm-up, Skill, Strength, WOD)
 */
function parseSections(text: string): {
  mobility: string[];
  warmup: string[];
  skill: string[];
  strength: string[];
  wod: string[];
} {
  const sections = {
    mobility: [] as string[],
    warmup: [] as string[],
    skill: [] as string[],
    strength: [] as string[],
    wod: [] as string[],
  };

  // Divide por seções principais
  const mobilityMatch = text.match(/Mobility[^W]*([\s\S]*?)(?=Warm-up|Skill|Strength|WOD|$)/i);
  const warmupMatch = text.match(/Warm-up[^S]*([\s\S]*?)(?=Skill|Strength|WOD|Observações|$)/i);
  const skillMatch = text.match(/Skill[^S]*([\s\S]*?)(?=Strength|WOD|Observações|$)/i);
  const strengthMatch = text.match(/Strength[^W]*([\s\S]*?)(?=WOD|Observações|$)/i);
  const wodMatch = text.match(/WOD[^O]*([\s\S]*?)(?=Observações|$)/i);

  if (mobilityMatch) {
    sections.mobility = extractSectionContent(mobilityMatch[1]);
  }

  if (warmupMatch) {
    sections.warmup = extractSectionContent(warmupMatch[1]);
  }

  if (skillMatch) {
    sections.skill = extractSectionContent(skillMatch[1]);
  }

  if (strengthMatch) {
    sections.strength = extractSectionContent(strengthMatch[1]);
  }

  if (wodMatch) {
    sections.wod = extractSectionContent(wodMatch[1]);
  }

  return sections;
}

/**
 * Parser principal - converte texto do PDF em WorkoutData
 */
export function parseWorkoutFromText(text: string): WorkoutData {
  // Extrai informações gerais
  const date = extractDate(text);
  const dayOfWeek = extractDay(text);
  const focusTechnique = extractFocusTechnique(text);

  // Parseia seções
  const sections = parseSections(text);

  // Monta estrutura de seções com duração
  const workoutSections = [
    {
      id: 'mobility',
      title: 'Mobility',
      durationMinutes: 3,
      content: sections.mobility.length > 0 ? sections.mobility : ['Mobility geral'],
    },
    {
      id: 'warmup',
      title: 'Warm-up',
      durationMinutes: 12,
      content: sections.warmup.length > 0 ? sections.warmup : ['Aquecimento específico'],
    },
    {
      id: 'skill',
      title: 'Skill',
      durationMinutes: 15,
      content: sections.skill.length > 0 ? sections.skill : ['Trabalho técnico'],
    },
    {
      id: 'strength',
      title: 'Strength',
      durationMinutes: 10,
      content: sections.strength.length > 0 ? sections.strength : ['Força'],
    },
    {
      id: 'wod',
      title: '#WOD',
      durationMinutes: 15,
      content: sections.wod.length > 0 ? sections.wod : ['Workout of the day'],
    },
  ];

  return {
    date,
    dayOfWeek,
    focusTechnique,
    sections: workoutSections,
  };
}

/**
 * Extrai múltiplos treinos de um PDF (um por dia da semana)
 */
export async function parseMultipleWorkoutsFromPDF(
  file: File
): Promise<Record<string, WorkoutData>> {
  try {
    const text = await extractTextFromPDF(file);

    // Divide o texto por dias
    const dayPatterns = [
      /segunda[^t]*terça/i,
      /terça[^q]*quarta/i,
      /quarta[^q]*quinta/i,
      /quinta[^s]*sexta/i,
      /sexta[^s]*sábado/i,
      /sábado[^d]*domingo/i,
    ];

    // Tenta extrair seções por dia
    const workouts: Record<string, WorkoutData> = {};

    // Estratégia: procura por padrões de dias e extrai conteúdo entre eles
    const lines = text.split('\n');
    let currentDay = 'Segunda-feira';
    let currentContent = '';

    for (const line of lines) {
      const dayMatch = line.match(/segunda|terça|quarta|quinta|sexta|sábado|domingo/i);

      if (dayMatch) {
        // Se temos conteúdo anterior, processa
        if (currentContent.trim().length > 0) {
          const workout = parseWorkoutFromText(currentContent);
          workouts[currentDay] = workout;
        }

        // Atualiza dia atual
        currentDay = DAYS_MAP[dayMatch[0].toLowerCase()] || currentDay;
        currentContent = line;
      } else {
        currentContent += '\n' + line;
      }
    }

    // Processa último dia
    if (currentContent.trim().length > 0) {
      const workout = parseWorkoutFromText(currentContent);
      workouts[currentDay] = workout;
    }

    return workouts;
  } catch (error) {
    console.error('Erro ao fazer parse do PDF:', error);
    throw error;
  }
}

/**
 * Função auxiliar para debug - mostra estrutura extraída
 */
export function debugParsedData(data: WorkoutData): void {
  console.log('=== PARSED WORKOUT DATA ===');
  console.log('Date:', data.date);
  console.log('Day:', data.dayOfWeek);
  console.log('Focus:', data.focusTechnique);
  console.log('Sections:');
  data.sections.forEach(section => {
    console.log(`  ${section.title} (${section.durationMinutes}'):`);
    section.content.forEach(item => console.log(`    - ${item}`));
  });
}
