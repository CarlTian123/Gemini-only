import React, { useCallback, useEffect, useState } from 'react';
import { SanctuaryCanvas } from './components/SanctuaryCanvas';
import {
  PRESET_BREATHING_PATTERNS,
  loadSanctuaryProgress,
  recommendPatternForAssessment,
  saveSanctuaryProgress,
} from './data/breathingPatterns';
import {
  BreathingPattern,
  FocusObjective,
  GameState,
  LiveHudSnapshot,
  MoodState,
  PlayStyleMode,
  SanctuaryProgress,
  SessionSummary,
} from './types/sanctuary';
import { soundEngine } from './utils/soundEngine';

type TitleDrawerTab = 'none' | 'personalize' | 'goals';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [progress, setProgress] = useState<SanctuaryProgress>(() => loadSanctuaryProgress());
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>(() =>
    recommendPatternForAssessment(progress.selectedMood, progress.selectedObjective)
  );
  const [customInhale, setCustomInhale] = useState<number>(4);
  const [customHoldIn, setCustomHoldIn] = useState<number>(2);
  const [customExhale, setCustomExhale] = useState<number>(6);
  const [customHoldOut, setCustomHoldOut] = useState<number>(0);
  const [isCustomCadence, setIsCustomCadence] = useState<boolean>(false);

  const [playStyle, setPlayStyle] = useState<PlayStyleMode>('challenge');
  const [sessionRunId, setSessionRunId] = useState<number>(1);
  const [activeDrawer, setActiveDrawer] = useState<TitleDrawerTab>('none');
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [intentionDraft, setIntentionDraft] = useState<string>(progress.dailyIntention);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  const [hud, setHud] = useState<LiveHudSnapshot>({
    breathPhase: 'INHALE',
    phaseTimeLeft: selectedPattern.inhale,
    phaseDuration: selectedPattern.inhale,
    phaseProgress: 0,
    auraCharge: 0.2,
    cyclesCompleted: 0,
    targetCycles: selectedPattern.targetCycles,
    serenityIntegrity: 100,
    harmonyScore: 0,
    streakMultiplier: 1,
    lotusBloomed: 0,
    totalLotusTarget: 5,
    shadowsPurified: 0,
    activeWave: 1,
    breathSyncAccuracy: 100,
    guidanceText: 'Hold Space during Inhale to gather glowing Prana',
  });

  useEffect(() => {
    saveSanctuaryProgress(progress);
  }, [progress]);

  const effectivePattern: BreathingPattern = isCustomCadence
    ? {
        id: 'custom-cadence',
        name: 'Custom Personal Cadence',
        subtitle: `${customInhale}s Inhale · ${customHoldIn}s Hold · ${customExhale}s Exhale · ${customHoldOut}s Rest`,
        inhale: customInhale,
        holdIn: customHoldIn,
        exhale: customExhale,
        holdOut: customHoldOut,
        recommendedFor: 'Tailored to your exact respiratory comfort and rhythm',
        accentHex: '#2DD4BF',
        targetCycles: 7,
      }
    : selectedPattern;

  const handleStartSession = useCallback(() => {
    soundEngine.playBowlStrike(432, 0.24, 2.2);
    setActiveDrawer('none');
    setSessionSummary(null);
    setSessionRunId((prev) => prev + 1);
    setGameState('PLAYING');
  }, []);

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSessionEnd = useCallback((summary: SessionSummary) => {
    setSessionSummary(summary);
    setGameState(summary.victory ? 'VICTORY' : 'GAME_OVER');

    // Update Daily Mindfulness Goals & Sanctuary Progress
    setProgress((prev) => {
      const addedMinutes = Math.max(1, Math.round(summary.durationSeconds / 60));
      const updatedGoals = prev.goals.map((g) => {
        if (g.category === 'cycles') {
          const nextCur = g.current + summary.cyclesCompleted;
          return { ...g, current: nextCur, completed: nextCur >= g.target };
        }
        if (g.category === 'lotus') {
          const nextCur = g.current + summary.lotusBloomed;
          return { ...g, current: nextCur, completed: nextCur >= g.target };
        }
        if (g.category === 'harmony') {
          const bestSync = Math.max(g.current, summary.breathSyncAccuracy);
          return { ...g, current: bestSync, completed: bestSync >= g.target };
        }
        return g;
      });

      return {
        ...prev,
        totalMindfulMinutes: prev.totalMindfulMinutes + addedMinutes,
        totalCyclesCompleted: prev.totalCyclesCompleted + summary.cyclesCompleted,
        totalLotusesBloomed: prev.totalLotusesBloomed + summary.lotusBloomed,
        goals: updatedGoals,
      };
    });
  }, []);

  const handleApplyPersonalizer = (mood: MoodState, objective: FocusObjective) => {
    const recommended = recommendPatternForAssessment(mood, objective);
    setIsCustomCadence(false);
    setSelectedPattern(recommended);
    setProgress((prev) => ({
      ...prev,
      selectedMood: mood,
      selectedObjective: objective,
    }));
    soundEngine.playBowlStrike(528, 0.16, 1.5);
  };

  const handleSaveIntention = () => {
    if (!intentionDraft.trim()) return;
    setProgress((prev) => ({
      ...prev,
      dailyIntention: intentionDraft.trim(),
      goals: prev.goals.map((g) =>
        g.category === 'reflection' ? { ...g, current: 1, completed: true } : g
      ),
    }));
    soundEngine.playBowlStrike(528, 0.15, 1.2);
  };

  const handleToggleGoalCheck = (goalId: string) => {
    setProgress((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const nextCompleted = !g.completed;
        return {
          ...g,
          completed: nextCompleted,
          current: nextCompleted ? g.target : 0,
        };
      }),
    }));
  };

  const handleAddCustomGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGoalTitle.trim();
    if (!trimmed) return;
    setProgress((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          id: `custom-${Date.now()}`,
          title: trimmed,
          category: 'custom',
          current: 0,
          target: 1,
          unit: 'practice',
          completed: false,
        },
      ],
    }));
    setNewGoalTitle('');
  };

  const completedGoalsCount = progress.goals.filter((g) => g.completed).length;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07111A] select-none">
      {/* Isolated 60fps Canvas Simulation */}
      <SanctuaryCanvas
        gameState={gameState}
        pattern={effectivePattern}
        playStyle={playStyle}
        sessionRunId={sessionRunId}
        onHudUpdate={setHud}
        onSessionEnd={handleSessionEnd}
        onTogglePause={handleTogglePause}
        onStartFromKey={handleStartSession}
      />

      {/* =====================================================================
          STATE 1: TITLE SCREEN (Full-Viewport Game Shell with 35-40% Negative Space)
         ===================================================================== */}
      {gameState === 'TITLE_MENU' && (
        <div className="relative z-10 flex flex-col justify-between w-full h-full px-8 py-7 pointer-events-none">
          {/* Top Perimeter Bar: Quiet World-Matched Sanctuary Telemetry & Audio Toggle */}
          <div className="flex items-center justify-between w-full max-w-[1360px] mx-auto">
            <div className="flex items-center gap-4 text-xs text-slate-300 font-mono-num pointer-events-auto bg-[#081521]/85 border border-slate-800/80 px-4 py-2 rounded-lg">
              <span>{progress.streakDays} Day Streak</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{progress.totalMindfulMinutes} Mindful Min</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-[#2DD4BF]">
                {completedGoalsCount}/{progress.goals.length} Daily Goals Completed
              </span>
            </div>

            <div className="flex items-center gap-3 pointer-events-auto">
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer((prev) => (prev === 'personalize' ? 'none' : 'personalize'))
                }
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  activeDrawer === 'personalize'
                    ? 'bg-[#2DD4BF] text-[#06121A] border-[#2DD4BF]'
                    : 'bg-[#081521]/90 text-slate-200 border-slate-700/80 hover:border-[#2DD4BF]/60'
                }`}
              >
                Personalize Breath ({effectivePattern.inhale}-{effectivePattern.holdIn}-
                {effectivePattern.exhale})
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer((prev) => (prev === 'goals' ? 'none' : 'goals'))}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  activeDrawer === 'goals'
                    ? 'bg-[#FBBF24] text-[#06121A] border-[#FBBF24]'
                    : 'bg-[#081521]/90 text-slate-200 border-slate-700/80 hover:border-[#FBBF24]/60'
                }`}
              >
                Daily Goals ({completedGoalsCount}/{progress.goals.length})
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute sanctuary audio' : 'Mute sanctuary audio'}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#081521]/90 border border-slate-700/80 rounded-lg hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
              >
                <svg className="w-4 h-4 text-[#2DD4BF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  )}
                </svg>
                <span>{isMuted ? 'Audio Muted' : 'Singing Bowls On'}</span>
              </button>
            </div>
          </div>

          {/* Centerpiece: Bespoke SVG Title Lockup OR Active Personalizer / Daily Goals Drawer */}
          <div className="flex flex-col items-center justify-center my-auto w-full max-w-[980px] mx-auto">
            {activeDrawer === 'none' && (
              <div className="flex flex-col items-center text-center max-w-xl px-6 py-8">
                {/* Bespoke Inline SVG Lotus & Koi Sanctuary Lockup */}
                <svg
                  className="w-24 h-24 mb-4 text-[#2DD4BF]"
                  viewBox="0 0 120 120"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="60" cy="60" r="52" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="3 5" />
                  <circle cx="60" cy="60" r="38" stroke="#FBBF24" strokeOpacity="0.4" strokeWidth="1.2" />
                  {/* Lotus Crown Petals */}
                  <path
                    d="M60 22C68 36 72 48 60 60C48 48 52 36 60 22Z"
                    fill="rgba(45, 212, 191, 0.25)"
                    stroke="#2DD4BF"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M60 60C72 46 86 44 94 54C82 64 70 64 60 60Z"
                    fill="rgba(45, 212, 191, 0.16)"
                    stroke="#2DD4BF"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M60 60C48 46 34 44 26 54C38 64 50 64 60 60Z"
                    fill="rgba(45, 212, 191, 0.16)"
                    stroke="#2DD4BF"
                    strokeWidth="1.5"
                  />
                  {/* Stylized Yin-Yang Koi Arc */}
                  <path
                    d="M42 74C49 85 71 85 78 72"
                    stroke="#FDE68A"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <circle cx="60" cy="60" r="4" fill="#FDE68A" />
                </svg>

                <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-wide text-[#F8FAFC] mb-3">
                  Prana Pond
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-md mb-5 leading-relaxed">
                  Guide the Spirit Koi through twilight waters. Synchronize your breath to bloom dormant Lotus Shrines and dissolve encroaching mental static.
                </p>

                {/* Active Personalized Cadence Summary Line (Zero-Pill Unboxed Metadata) */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300 font-mono-num mb-6">
                  <span className="text-[#2DD4BF] font-medium">{effectivePattern.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{effectivePattern.subtitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FDE68A]">Target: {effectivePattern.targetCycles} Cycles</span>
                </div>

                {/* Play Style Selector + Primary Start CTA */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pointer-events-auto">
                  <div className="flex items-center p-1 bg-[#081521]/90 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPlayStyle('challenge')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        playStyle === 'challenge'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Mindful Encounter Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayStyle('zen')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        playStyle === 'zen'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tranquil Zen Flow
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartSession}
                    className="px-7 py-3 text-sm font-semibold text-[#041017] bg-[#2DD4BF] hover:bg-[#5EEAD4] rounded-lg transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
                  >
                    Begin Breath Session
                  </button>
                </div>
              </div>
            )}

            {/* DRAWER 1: PERSONALIZED BREATHING EXERCISE CALIBRATOR */}
            {activeDrawer === 'personalize' && (
              <div
                data-ui-interactive="true"
                className="w-full max-w-3xl bg-[#081521]/95 border border-slate-800 rounded-xl p-6 pointer-events-auto shadow-2xl"
              >
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      Personalized Breath Calibration
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select your current mental state or customize your exact respiratory rhythm.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer('none')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg whitespace-nowrap shrink-0"
                  >
                    Done
                  </button>
                </div>

                {/* Step 1: Quick State-of-Mind Personalizer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      01. How does your mind feel right now?
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['anxious', 'scattered', 'tense', 'fatigued', 'balanced'] as MoodState[]).map(
                        (m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              handleApplyPersonalizer(m, progress.selectedObjective)
                            }
                            className={`px-3 py-2 text-xs font-medium capitalize rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                              progress.selectedMood === m && !isCustomCadence
                                ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] text-[#2DD4BF]'
                                : 'bg-[#0B1C2C] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      02. Primary intention for this session
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'calm', label: 'Deep Calm' },
                          { id: 'clarity', label: 'Mental Clarity' },
                          { id: 'sleep', label: 'Evening Unwind' },
                          { id: 'vitality', label: 'Steady Energy' },
                        ] as { id: FocusObjective; label: string }[]
                      ).map((obj) => (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() =>
                            handleApplyPersonalizer(progress.selectedMood, obj.id)
                          }
                          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                            progress.selectedObjective === obj.id && !isCustomCadence
                              ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] text-[#2DD4BF]'
                              : 'bg-[#0B1C2C] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {obj.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 2: Curated Science-Backed Presets */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">
                      03. Breathing Cadence Protocols
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomCadence((prev) => !prev)}
                      className="text-xs text-[#2DD4BF] hover:underline whitespace-nowrap shrink-0"
                    >
                      {isCustomCadence ? 'Use Curated Presets' : 'Configure Custom Ratio'}
                    </button>
                  </div>

                  {!isCustomCadence ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {PRESET_BREATHING_PATTERNS.map((pat) => {
                        const isSelected = selectedPattern.id === pat.id;
                        return (
                          <button
                            key={pat.id}
                            type="button"
                            onClick={() => {
                              setSelectedPattern(pat);
                              soundEngine.playBowlStrike(432, 0.14, 1.2);
                            }}
                            className={`text-left p-3.5 rounded-lg border transition-colors ${
                              isSelected
                                ? 'bg-[#0F293D] border-[#2DD4BF]'
                                : 'bg-[#0B1C2C] border-slate-800/90 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{pat.name}</div>
                            <div className="text-xs font-mono-num text-[#2DD4BF] mt-0.5">
                              {pat.subtitle}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                              {pat.recommendedFor}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#0B1C2C] border border-slate-800 rounded-lg">
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono-num">
                          <span>Inhale</span>
                          <span className="text-[#2DD4BF]">{customInhale}s</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={10}
                          value={customInhale}
                          onChange={(e) => setCustomInhale(Number(e.target.value))}
                          className="w-full accent-[#2DD4BF]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono-num">
                          <span>Hold In</span>
                          <span className="text-[#FBBF24]">{customHoldIn}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={customHoldIn}
                          onChange={(e) => setCustomHoldIn(Number(e.target.value))}
                          className="w-full accent-[#FBBF24]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono-num">
                          <span>Exhale</span>
                          <span className="text-[#38BDF8]">{customExhale}s</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={12}
                          value={customExhale}
                          onChange={(e) => setCustomExhale(Number(e.target.value))}
                          className="w-full accent-[#38BDF8]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono-num">
                          <span>Rest Out</span>
                          <span className="text-slate-300">{customHoldOut}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={8}
                          value={customHoldOut}
                          onChange={(e) => setCustomHoldOut(Number(e.target.value))}
                          className="w-full accent-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    Active Protocol:{' '}
                    <span className="text-slate-200 font-medium">{effectivePattern.name}</span> ·{' '}
                    <span className="font-mono-num text-[#2DD4BF]">{effectivePattern.subtitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartSession}
                    className="px-5 py-2 text-xs font-semibold text-[#041017] bg-[#2DD4BF] hover:bg-[#5EEAD4] rounded-lg whitespace-nowrap shrink-0"
                  >
                    Start With This Cadence
                  </button>
                </div>
              </div>
            )}

            {/* DRAWER 2: DAILY MINDFULNESS GOALS & INTENTION SETTING */}
            {activeDrawer === 'goals' && (
              <div
                data-ui-interactive="true"
                className="w-full max-w-2xl bg-[#081521]/95 border border-slate-800 rounded-xl p-6 pointer-events-auto shadow-2xl"
              >
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      Daily Mindfulness Goals
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Goals automatically progress as you breathe in sync and bloom Lotus Shrines.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer('none')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg whitespace-nowrap shrink-0"
                  >
                    Close
                  </button>
                </div>

                {/* Daily Intention Input */}
                <div className="mb-5 p-3.5 bg-[#0B1C2C] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Today&apos;s Mindful Intention
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={intentionDraft}
                      onChange={(e) => setIntentionDraft(e.target.value)}
                      placeholder="Set a gentle focus for today..."
                      className="flex-1 bg-[#07111A] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-[#2DD4BF]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveIntention}
                      className="px-4 py-1.5 text-xs font-medium text-[#041017] bg-[#2DD4BF] hover:bg-[#5EEAD4] rounded-lg whitespace-nowrap shrink-0"
                    >
                      Save Intention
                    </button>
                  </div>
                </div>

                {/* Goals Checklist */}
                <div className="space-y-2 mb-5 max-h-52 overflow-y-auto pr-1">
                  {progress.goals.map((g) => {
                    const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100));
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-4 p-3 bg-[#0B1C2C] border border-slate-800/90 rounded-lg"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleGoalCheck(g.id)}
                          className="flex items-center gap-3 text-left flex-1"
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                              g.completed
                                ? 'bg-[#2DD4BF] border-[#2DD4BF] text-[#041017]'
                                : 'border-slate-600 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span
                            className={`text-xs ${
                              g.completed ? 'line-through text-slate-400' : 'text-slate-100'
                            }`}
                          >
                            {g.title}
                          </span>
                        </button>

                        <div className="flex items-center gap-3 font-mono-num text-xs text-slate-400 shrink-0">
                          <span>
                            {g.current}/{g.target} {g.unit}
                          </span>
                          <span className="w-10 text-right text-[#2DD4BF]">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Daily Mindfulness Goal */}
                <form onSubmit={handleAddCustomGoal} className="flex gap-2">
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="Add a personal daily mindfulness habit..."
                    className="flex-1 bg-[#0B1C2C] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#2DD4BF]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg whitespace-nowrap shrink-0"
                  >
                    Add Goal
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Bottom Control-Hint Line (Single Flat Control-Hint Line as Required) */}
          <div className="flex items-center justify-center w-full pb-1">
            <p className="text-xs font-mono-num tracking-wide text-slate-400">
              WASD Move · Hold Space Inhale &amp; Release on Exhale · Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: ACTIVE PLAY VIEW HUD (World-Matched, >85% Unobstructed, Zero Backdrop-Filter)
         ===================================================================== */}
      {gameState === 'PLAYING' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-5">
          {/* Top Perimeter Status Row */}
          <div className="flex items-start justify-between w-full max-w-[1400px] mx-auto gap-4">
            {/* Left Cluster: Serenity Integrity & Sanctuary Objectives */}
            <div className="flex flex-col gap-1.5 bg-[#081521]/90 border border-slate-800/80 px-4 py-2.5 rounded-lg">
              <div className="flex items-center gap-3 text-xs font-mono-num">
                <span className="text-slate-300 font-medium">
                  SERENITY {hud.serenityIntegrity}/100 ·{' '}
                  {hud.serenityIntegrity >= 70
                    ? 'HARMONIOUS'
                    : hud.serenityIntegrity >= 35
                      ? 'WAVERING'
                      : 'DISRUPTED'}
                </span>
              </div>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-transform duration-150 origin-left"
                  style={{
                    backgroundColor:
                      hud.serenityIntegrity >= 70
                        ? '#2DD4BF'
                        : hud.serenityIntegrity >= 35
                          ? '#FBBF24'
                          : '#FB7185',
                    transform: `scaleX(${hud.serenityIntegrity / 100})`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-num pt-0.5">
                <span className="text-[#FDE68A]">
                  Lotus {hud.lotusBloomed}/{hud.totalLotusTarget}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#2DD4BF]">
                  Cycles {hud.cyclesCompleted}/{hud.targetCycles}
                </span>
                <span aria-hidden="true">·</span>
                <span>Sync {hud.breathSyncAccuracy}%</span>
              </div>
            </div>

            {/* Center Cluster: Live Personalized Breathing Cadence Guide */}
            <div className="flex flex-col items-center bg-[#081521]/90 border border-slate-800/80 px-6 py-2.5 rounded-lg">
              <div className="flex items-center gap-3 font-mono-num">
                <span
                  className="text-sm font-semibold tracking-wider"
                  style={{
                    color:
                      hud.breathPhase === 'INHALE'
                        ? '#2DD4BF'
                        : hud.breathPhase === 'HOLD_IN'
                          ? '#FBBF24'
                          : hud.breathPhase === 'EXHALE'
                            ? '#38BDF8'
                            : '#94A3B8',
                  }}
                >
                  {hud.breathPhase === 'INHALE'
                    ? 'INHALE'
                    : hud.breathPhase === 'HOLD_IN'
                      ? 'HOLD BREATH'
                      : hud.breathPhase === 'EXHALE'
                        ? 'EXHALE RELEASE'
                        : 'REST STILL'}
                </span>
                <span className="text-sm text-white font-semibold">
                  {hud.phaseTimeLeft.toFixed(1)}s
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{hud.guidanceText}</p>
            </div>

            {/* Right Cluster: Harmony Score & Controls */}
            <div className="flex items-center gap-2.5">
              <div className="bg-[#081521]/90 border border-slate-800/80 px-4 py-2 rounded-lg text-right font-mono-num">
                <div className="text-xs text-slate-400">
                  HARMONY · <span className="text-[#2DD4BF]">{hud.streakMultiplier}x FLOW</span>
                </div>
                <div className="text-base font-semibold text-white">{hud.harmonyScore}</div>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                className="pointer-events-auto p-2.5 bg-[#081521]/90 border border-slate-800/80 hover:border-slate-600 rounded-lg text-slate-200 transition-colors"
              >
                <svg className="w-4 h-4 text-[#2DD4BF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                onClick={handleTogglePause}
                className="pointer-events-auto px-3.5 py-2 text-xs font-medium bg-[#081521]/90 border border-slate-800/80 hover:border-slate-600 rounded-lg text-slate-200 whitespace-nowrap shrink-0"
              >
                Pause (Esc)
              </button>
            </div>
          </div>

          {/* Bottom Subtle Intention Anchor */}
          <div className="flex items-center justify-between w-full max-w-[1400px] mx-auto text-xs text-slate-400 font-mono-num">
            <span>Intention: {progress.dailyIntention}</span>
            <span>
              {effectivePattern.name} ({effectivePattern.inhale}-{effectivePattern.holdIn}-
              {effectivePattern.exhale})
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: PAUSE MODAL
         ===================================================================== */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050C14]/85 p-6">
          <div className="w-full max-w-md bg-[#081521] border border-slate-800 rounded-xl p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-semibold text-white mb-2">
              Sanctuary Paused
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {effectivePattern.name} · {effectivePattern.subtitle}
            </p>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#0B1C2C] border border-slate-800/80 rounded-lg mb-6 font-mono-num">
              <div>
                <div className="text-xs text-slate-400">Cycles</div>
                <div className="text-lg font-semibold text-[#2DD4BF]">
                  {hud.cyclesCompleted}/{hud.targetCycles}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Lotus Shrines</div>
                <div className="text-lg font-semibold text-[#FDE68A]">
                  {hud.lotusBloomed}/{hud.totalLotusTarget}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Breath Sync</div>
                <div className="text-lg font-semibold text-white">{hud.breathSyncAccuracy}%</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-5 py-2.5 text-xs font-semibold text-[#041017] bg-[#2DD4BF] hover:bg-[#5EEAD4] rounded-lg whitespace-nowrap shrink-0"
              >
                Resume Session
              </button>
              <button
                type="button"
                onClick={handleStartSession}
                className="px-5 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg whitespace-nowrap shrink-0"
              >
                Restart Session
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 bg-[#0B1C2C] border border-slate-700 hover:border-slate-500 rounded-lg whitespace-nowrap shrink-0"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 4: VICTORY / SESSION COMPLETE & GAME OVER MODAL
         ===================================================================== */}
      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && sessionSummary && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050C14]/88 p-6">
          <div className="w-full max-w-lg bg-[#081521] border border-slate-800 rounded-xl p-7 text-center shadow-2xl">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mb-2">
              {gameState === 'VICTORY'
                ? 'Sanctuary in Full Bloom'
                : 'Breath Rhythm Interrupted'}
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              {gameState === 'VICTORY'
                ? `You completed ${sessionSummary.cyclesCompleted} mindful cycles of ${sessionSummary.patternName} and awakened all 5 Lotus Shrines.`
                : 'Mental static overwhelmed the pond before all shrines bloomed. Take a gentle breath and begin anew.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0B1C2C] border border-slate-800 rounded-lg mb-6 font-mono-num">
              <div>
                <div className="text-xs text-slate-400">Harmony</div>
                <div className="text-lg font-semibold text-[#2DD4BF]">
                  {sessionSummary.harmonyScore}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Breath Sync</div>
                <div className="text-lg font-semibold text-white">
                  {sessionSummary.breathSyncAccuracy}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Shrines</div>
                <div className="text-lg font-semibold text-[#FDE68A]">
                  {sessionSummary.lotusBloomed}/5
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Thoughts Cleared</div>
                <div className="text-lg font-semibold text-slate-200">
                  {sessionSummary.shadowsPurified}
                </div>
              </div>
            </div>

            {/* Daily Mindfulness Goals Progress Summary */}
            <div className="text-left p-4 bg-[#0B1C2C]/70 border border-slate-800/80 rounded-lg mb-6">
              <div className="text-xs font-medium text-slate-300 mb-2">
                Daily Mindfulness Goals Progress ({completedGoalsCount}/{progress.goals.length})
              </div>
              <div className="space-y-1.5">
                {progress.goals.slice(0, 4).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between text-xs font-mono-num"
                  >
                    <span className={g.completed ? 'text-[#2DD4BF]' : 'text-slate-300'}>
                      {g.completed ? '✓ ' : '· '}
                      {g.title}
                    </span>
                    <span className="text-slate-400">
                      {g.current}/{g.target}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStartSession}
                className="px-6 py-2.5 text-xs font-semibold text-[#041017] bg-[#2DD4BF] hover:bg-[#5EEAD4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="px-5 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Personalize Cadence &amp; Goals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
