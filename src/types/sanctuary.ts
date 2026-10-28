export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type BreathPhase = 'INHALE' | 'HOLD_IN' | 'EXHALE' | 'HOLD_OUT';

export type MoodState = 'anxious' | 'scattered' | 'fatigued' | 'tense' | 'balanced';
export type FocusObjective = 'calm' | 'clarity' | 'sleep' | 'vitality';
export type PlayStyleMode = 'challenge' | 'zen';

export interface BreathingPattern {
  id: string;
  name: string;
  subtitle: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  recommendedFor: string;
  accentHex: string;
  targetCycles: number;
}

export interface DailyGoal {
  id: string;
  title: string;
  category: 'cycles' | 'harmony' | 'lotus' | 'reflection' | 'custom';
  current: number;
  target: number;
  unit: string;
  completed: boolean;
}

export interface SanctuaryProgress {
  streakDays: number;
  totalMindfulMinutes: number;
  totalCyclesCompleted: number;
  totalLotusesBloomed: number;
  dailyIntention: string;
  selectedMood: MoodState;
  selectedObjective: FocusObjective;
  goals: DailyGoal[];
}

export interface LiveHudSnapshot {
  breathPhase: BreathPhase;
  phaseTimeLeft: number;
  phaseDuration: number;
  phaseProgress: number; // 0 to 1
  auraCharge: number; // 0 to 1
  cyclesCompleted: number;
  targetCycles: number;
  serenityIntegrity: number; // 0 to 100
  harmonyScore: number;
  streakMultiplier: number;
  lotusBloomed: number;
  totalLotusTarget: number;
  shadowsPurified: number;
  activeWave: number;
  breathSyncAccuracy: number; // percentage 0 to 100
  guidanceText: string;
}

export interface SessionSummary {
  victory: boolean;
  cyclesCompleted: number;
  targetCycles: number;
  harmonyScore: number;
  lotusBloomed: number;
  shadowsPurified: number;
  breathSyncAccuracy: number;
  durationSeconds: number;
  patternName: string;
}
