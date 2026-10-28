import {
  BreathingPattern,
  DailyGoal,
  FocusObjective,
  MoodState,
  SanctuaryProgress,
} from '../types/sanctuary';

export const PRESET_BREATHING_PATTERNS: BreathingPattern[] = [
  {
    id: 'coherent-5-5',
    name: 'Coherent Resonance',
    subtitle: '5s Inhale · 5s Exhale',
    inhale: 5,
    holdIn: 0,
    exhale: 5,
    holdOut: 0,
    recommendedFor: 'Heart-brain coherence, emotional balance, and steady flow',
    accentHex: '#2DD4BF',
    targetCycles: 8,
  },
  {
    id: 'box-4-4-4-4',
    name: 'Box Equilibrium',
    subtitle: '4s Inhale · 4s Hold · 4s Exhale · 4s Rest',
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
    recommendedFor: 'Sharpening executive focus and quieting scattered thoughts',
    accentHex: '#38BDF8',
    targetCycles: 6,
  },
  {
    id: 'vagal-4-2-6',
    name: 'Vagal Tranquility',
    subtitle: '4s Inhale · 2s Hold · 6s Exhale',
    inhale: 4,
    holdIn: 2,
    exhale: 6,
    holdOut: 0,
    recommendedFor: 'Soothing acute anxiety and activating parasympathetic rest',
    accentHex: '#A78BFA',
    targetCycles: 8,
  },
  {
    id: 'relaxing-4-7-8',
    name: 'Deep Stillness 4-7-8',
    subtitle: '4s Inhale · 7s Hold · 8s Exhale',
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
    recommendedFor: 'Dissolving deep somatic tension and preparing for restorative rest',
    accentHex: '#F59E0B',
    targetCycles: 5,
  },
  {
    id: 'energizing-4-1-4-1',
    name: 'Luminous Vitality',
    subtitle: '4s Inhale · 1s Hold · 4s Exhale · 1s Rest',
    inhale: 4,
    holdIn: 1,
    exhale: 4,
    holdOut: 1,
    recommendedFor: 'Lifting mental fog and restoring gentle daytime alertness',
    accentHex: '#34D399',
    targetCycles: 10,
  },
];

export function recommendPatternForAssessment(
  mood: MoodState,
  objective: FocusObjective
): BreathingPattern {
  if (mood === 'anxious' || objective === 'calm') {
    return PRESET_BREATHING_PATTERNS[2]; // Vagal Tranquility 4-2-6
  }
  if (mood === 'scattered' || objective === 'clarity') {
    return PRESET_BREATHING_PATTERNS[1]; // Box Equilibrium 4-4-4-4
  }
  if (mood === 'tense' || objective === 'sleep') {
    return PRESET_BREATHING_PATTERNS[3]; // Deep Stillness 4-7-8
  }
  if (mood === 'fatigued' || objective === 'vitality') {
    return PRESET_BREATHING_PATTERNS[4]; // Luminous Vitality
  }
  return PRESET_BREATHING_PATTERNS[0]; // Coherent Resonance
}

export const DEFAULT_DAILY_GOALS: DailyGoal[] = [
  {
    id: 'goal-cycles',
    title: 'Complete 8 rhythmic breath cycles in sync',
    category: 'cycles',
    current: 0,
    target: 8,
    unit: 'cycles',
    completed: false,
  },
  {
    id: 'goal-lotus',
    title: 'Bloom 5 dormant Lotus Shrines across the pond',
    category: 'lotus',
    current: 0,
    target: 5,
    unit: 'shrines',
    completed: false,
  },
  {
    id: 'goal-harmony',
    title: 'Maintain 80% or higher Breath Sync accuracy',
    category: 'harmony',
    current: 0,
    target: 80,
    unit: '% sync',
    completed: false,
  },
  {
    id: 'goal-reflection',
    title: 'Set a personal daily mindfulness intention',
    category: 'reflection',
    current: 1,
    target: 1,
    unit: 'intention',
    completed: true,
  },
];

const STORAGE_KEY = 'prana_pond_sanctuary_progress_v1';

export function loadSanctuaryProgress(): SanctuaryProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SanctuaryProgress;
      if (parsed && Array.isArray(parsed.goals)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    streakDays: 3,
    totalMindfulMinutes: 42,
    totalCyclesCompleted: 28,
    totalLotusesBloomed: 14,
    dailyIntention: 'Anchor attention in the exhale and release unnecessary urgency.',
    selectedMood: 'anxious',
    selectedObjective: 'calm',
    goals: DEFAULT_DAILY_GOALS,
  };
}

export function saveSanctuaryProgress(progress: SanctuaryProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}
