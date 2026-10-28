import React, { useEffect, useRef } from 'react';
import {
  BreathPhase,
  BreathingPattern,
  GameState,
  LiveHudSnapshot,
  PlayStyleMode,
  SessionSummary,
} from '../types/sanctuary';
import { soundEngine } from '../utils/soundEngine';

interface SanctuaryCanvasProps {
  gameState: GameState;
  pattern: BreathingPattern;
  playStyle: PlayStyleMode;
  sessionRunId: number;
  onHudUpdate: (snapshot: LiveHudSnapshot) => void;
  onSessionEnd: (summary: SessionSummary) => void;
  onTogglePause: () => void;
  onStartFromKey: () => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface WaterRipple {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

interface FloatingCallout {
  active: boolean;
  x: number;
  y: number;
  text: string;
  subtext: string;
  color: string;
  life: number;
  maxLife: number;
}

interface LotusShrine {
  id: number;
  x: number;
  y: number;
  progress: number; // 0 to 100
  bloomed: boolean;
  petalAngle: number;
  flashTimer: number;
}

type HazardKind = 'vortex' | 'spark' | 'mist';
type HazardBehaviorState = 'APPROACH' | 'WINDUP' | 'STRIKE' | 'COOLDOWN';

interface MentalHazard {
  active: boolean;
  kind: HazardKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  state: HazardBehaviorState;
  stateTimer: number;
  windupDuration: number;
  aimX: number;
  aimY: number;
  flashTimer: number;
  angle: number;
}

interface PranaMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phaseOffset: number;
  color: string;
}

interface HarmonicWave {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  power: number;
  resonant: boolean;
  color: string;
  alpha: number;
}

const MAX_PARTICLES = 180;
const MAX_RIPPLES = 45;
const MAX_CALLOUTS = 16;
const MAX_HAZARDS = 14;
const MAX_WAVES = 6;

export const SanctuaryCanvas: React.FC<SanctuaryCanvasProps> = React.memo(
  ({
    gameState,
    pattern,
    playStyle,
    sessionRunId,
    onHudUpdate,
    onSessionEnd,
    onTogglePause,
    onStartFromKey,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Keep latest props in refs so the 60fps loop never restarts or stutters on React state updates
    const stateRef = useRef({
      gameState,
      pattern,
      playStyle,
      sessionRunId,
      onHudUpdate,
      onSessionEnd,
      onTogglePause,
      onStartFromKey,
    });

    useEffect(() => {
      stateRef.current = {
        gameState,
        pattern,
        playStyle,
        sessionRunId,
        onHudUpdate,
        onSessionEnd,
        onTogglePause,
        onStartFromKey,
      };
    }, [
      gameState,
      pattern,
      playStyle,
      sessionRunId,
      onHudUpdate,
      onSessionEnd,
      onTogglePause,
      onStartFromKey,
    ]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const handleResize = () => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', handleResize);

      // Input state: separated continuous held vs edge-triggered justPressed + buffer
      const heldKeys = new Set<string>();
      const justPressedKeys = new Set<string>();
      let mouseHeld = false;
      let mouseJustPressed = false;
      let mouseJustReleased = false;
      let spaceJustReleased = false;
      let pointerX = width * 0.5;
      let pointerY = height * 0.5;
      let pulseInputBufferTimer = 0; // 220ms input buffer
      let exhaleCoyoteTimer = 0; // 350ms coyote window after EXHALE ends

      const clearInputs = () => {
        heldKeys.clear();
        justPressedKeys.clear();
        mouseHeld = false;
        mouseJustPressed = false;
        mouseJustReleased = false;
        spaceJustReleased = false;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if typing in an input or textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (e.code === 'Escape') {
          e.preventDefault();
          if (
            stateRef.current.gameState === 'PLAYING' ||
            stateRef.current.gameState === 'PAUSED'
          ) {
            stateRef.current.onTogglePause();
          }
          return;
        }

        if (
          stateRef.current.gameState === 'TITLE_MENU' &&
          (e.code === 'Enter' || e.code === 'Space')
        ) {
          e.preventDefault();
          stateRef.current.onStartFromKey();
          return;
        }

        if (!heldKeys.has(e.code)) {
          justPressedKeys.add(e.code);
          if (e.code === 'Space') {
            pulseInputBufferTimer = 0.22;
          }
        }
        heldKeys.add(e.code);
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space' && heldKeys.has('Space')) {
          spaceJustReleased = true;
          pulseInputBufferTimer = 0.22;
        }
        heldKeys.delete(e.code);
      };

      const handlePointerDown = (e: MouseEvent) => {
        if (stateRef.current.gameState !== 'PLAYING') return;
        const target = e.target as HTMLElement;
        if (target && target.closest('button, input, a, [data-ui-interactive="true"]')) {
          return;
        }
        mouseHeld = true;
        mouseJustPressed = true;
        pulseInputBufferTimer = 0.22;
        pointerX = e.clientX;
        pointerY = e.clientY;
      };

      const handlePointerUp = () => {
        if (mouseHeld) {
          mouseJustReleased = true;
          pulseInputBufferTimer = 0.22;
        }
        mouseHeld = false;
      };

      const handlePointerMove = (e: MouseEvent) => {
        pointerX = e.clientX;
        pointerY = e.clientY;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousedown', handlePointerDown);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('blur', clearInputs);

      // Pooled Entities
      const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        alpha: 1,
        color: '#2DD4BF',
        life: 0,
        maxLife: 1,
      }));

      const ripples: WaterRipple[] = Array.from({ length: MAX_RIPPLES }, () => ({
        active: false,
        x: 0,
        y: 0,
        radius: 5,
        maxRadius: 80,
        alpha: 0.5,
        color: '#2DD4BF',
        lineWidth: 1.5,
      }));

      const callouts: FloatingCallout[] = Array.from({ length: MAX_CALLOUTS }, () => ({
        active: false,
        x: 0,
        y: 0,
        text: '',
        subtext: '',
        color: '#FDE68A',
        life: 0,
        maxLife: 1.2,
      }));

      const hazards: MentalHazard[] = Array.from({ length: MAX_HAZARDS }, () => ({
        active: false,
        kind: 'vortex',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 22,
        hp: 1,
        maxHp: 1,
        state: 'APPROACH',
        stateTimer: 0,
        windupDuration: 1.15,
        aimX: 0,
        aimY: 0,
        flashTimer: 0,
        angle: 0,
      }));

      const waves: HarmonicWave[] = Array.from({ length: MAX_WAVES }, () => ({
        active: false,
        x: 0,
        y: 0,
        radius: 16,
        maxRadius: 240,
        power: 1,
        resonant: true,
        color: '#2DD4BF',
        alpha: 1,
      }));

      const spawnParticleBurst = (
        x: number,
        y: number,
        count: number,
        color: string,
        speed = 110
      ) => {
        let spawned = 0;
        for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
          const p = particles[i];
          if (!p.active) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (0.3 + Math.random() * 0.85) * speed;
            p.active = true;
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * spd;
            p.vy = Math.sin(angle) * spd;
            p.size = 2 + Math.random() * 3.5;
            p.alpha = 1;
            p.color = color;
            p.life = 0;
            p.maxLife = 0.55 + Math.random() * 0.55;
            spawned++;
          }
        }
      };

      const spawnRipple = (
        x: number,
        y: number,
        maxRadius: number,
        color = 'rgba(45, 212, 191, 0.5)',
        lineWidth = 1.6
      ) => {
        for (let i = 0; i < MAX_RIPPLES; i++) {
          const r = ripples[i];
          if (!r.active) {
            r.active = true;
            r.x = x;
            r.y = y;
            r.radius = 8;
            r.maxRadius = maxRadius;
            r.alpha = 0.65;
            r.color = color;
            r.lineWidth = lineWidth;
            break;
          }
        }
      };

      const spawnCallout = (x: number, y: number, text: string, subtext = '', color = '#FDE68A') => {
        for (let i = 0; i < MAX_CALLOUTS; i++) {
          const c = callouts[i];
          if (!c.active) {
            c.active = true;
            c.x = x;
            c.y = y;
            c.text = text;
            c.subtext = subtext;
            c.color = color;
            c.life = 0;
            c.maxLife = 1.35;
            break;
          }
        }
      };

      // Koi Player & Sanctuary World State
      const koi = {
        x: width * 0.5,
        y: height * 0.55,
        vx: 0,
        vy: 0,
        angle: -Math.PI * 0.5,
        scaleX: 1,
        scaleY: 1,
        hitFlash: 0,
        wakeTimer: 0,
        tailSegments: Array.from({ length: 8 }, () => ({ x: width * 0.5, y: height * 0.55 })),
      };

      let shrines: LotusShrine[] = [];
      let pranaMotes: PranaMote[] = [];

      // Simulation & Breath State
      let currentRunId = -1;
      let breathPhase: BreathPhase = 'INHALE';
      let phaseElapsed = 0;
      let auraCharge = 0;
      let cyclesCompleted = 0;
      let serenityIntegrity = 100;
      let harmonyScore = 0;
      let streakMultiplier = 1;
      let shadowsPurified = 0;
      let syncedExhales = 0;
      let totalExhaleAttempts = 0;
      let sessionDurationSeconds = 0;
      let hitstopTimer = 0;
      let shakeIntensity = 0;
      let hazardSpawnTimer = 2.4;
      let hudUpdateAccumulator = 0;
      let pulseCooldown = 0;
      let hasPulsedThisExhale = false;

      const initWorld = () => {
        koi.x = width * 0.5;
        koi.y = height * 0.55;
        koi.vx = 0;
        koi.vy = 0;
        koi.angle = -Math.PI * 0.5;
        koi.scaleX = 1;
        koi.scaleY = 1;
        koi.hitFlash = 0;
        for (let i = 0; i < koi.tailSegments.length; i++) {
          koi.tailSegments[i].x = koi.x;
          koi.tailSegments[i].y = koi.y + i * 7;
        }

        // Position 5 Lotus Shrines in a balanced sacred pentagon around the playfield
        const cx = width * 0.5;
        const cy = height * 0.52;
        const rx = Math.min(width * 0.34, 420);
        const ry = Math.min(height * 0.28, 250);
        shrines = Array.from({ length: 5 }, (_, idx) => {
          const theta = -Math.PI * 0.5 + (idx * Math.PI * 2) / 5;
          return {
            id: idx,
            x: cx + Math.cos(theta) * rx,
            y: cy + Math.sin(theta) * ry,
            progress: 0,
            bloomed: false,
            petalAngle: idx * 0.7,
            flashTimer: 0,
          };
        });

        pranaMotes = Array.from({ length: 28 }, (_, idx) => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 18,
          vy: (Math.random() - 0.5) * 18,
          radius: 2.2 + (idx % 3) * 1.1,
          phaseOffset: Math.random() * Math.PI * 2,
          color: idx % 2 === 0 ? '#2DD4BF' : '#FDE68A',
        }));

        particles.forEach((p) => (p.active = false));
        ripples.forEach((r) => (r.active = false));
        callouts.forEach((c) => (c.active = false));
        hazards.forEach((h) => (h.active = false));
        waves.forEach((w) => (w.active = false));

        breathPhase = 'INHALE';
        phaseElapsed = 0;
        auraCharge = 0.15;
        cyclesCompleted = 0;
        serenityIntegrity = 100;
        harmonyScore = 0;
        streakMultiplier = 1;
        shadowsPurified = 0;
        syncedExhales = 0;
        totalExhaleAttempts = 0;
        sessionDurationSeconds = 0;
        hitstopTimer = 0;
        shakeIntensity = 0;
        hazardSpawnTimer = 2.0;
        hasPulsedThisExhale = false;
      };

      initWorld();

      const getPhaseDuration = (phase: BreathPhase, pat: BreathingPattern): number => {
        if (phase === 'INHALE') return Math.max(2, pat.inhale);
        if (phase === 'HOLD_IN') return Math.max(0, pat.holdIn);
        if (phase === 'EXHALE') return Math.max(2, pat.exhale);
        return Math.max(0, pat.holdOut);
      };

      const advanceBreathPhase = (pat: BreathingPattern) => {
        if (breathPhase === 'INHALE') {
          if (pat.holdIn > 0) {
            breathPhase = 'HOLD_IN';
          } else {
            breathPhase = 'EXHALE';
            hasPulsedThisExhale = false;
          }
        } else if (breathPhase === 'HOLD_IN') {
          breathPhase = 'EXHALE';
          hasPulsedThisExhale = false;
        } else if (breathPhase === 'EXHALE') {
          exhaleCoyoteTimer = 0.38;
          if (pat.holdOut > 0) {
            breathPhase = 'HOLD_OUT';
          } else {
            completeBreathCycle(pat);
          }
        } else {
          completeBreathCycle(pat);
        }
        phaseElapsed = 0;
        if (stateRef.current.gameState === 'PLAYING') {
          soundEngine.playBreathPhaseCue(breathPhase);
        }
      };

      const completeBreathCycle = (pat: BreathingPattern) => {
        breathPhase = 'INHALE';
        cyclesCompleted += 1;
        harmonyScore += 100 * streakMultiplier;
        serenityIntegrity = Math.min(100, serenityIntegrity + 8);
        spawnRipple(koi.x, koi.y, 160, 'rgba(52, 211, 153, 0.55)', 2.2);
        spawnCallout(koi.x, koi.y - 36, `CYCLE ${cyclesCompleted} COMPLETE`, '+100 SERENITY', '#6EE7B7');

        const bloomedCount = shrines.filter((s) => s.bloomed).length;
        if (cyclesCompleted >= pat.targetCycles && bloomedCount >= 5) {
          stateRef.current.onSessionEnd({
            victory: true,
            cyclesCompleted,
            targetCycles: pat.targetCycles,
            harmonyScore,
            lotusBloomed: bloomedCount,
            shadowsPurified,
            breathSyncAccuracy:
              totalExhaleAttempts > 0
                ? Math.min(100, Math.round((syncedExhales / totalExhaleAttempts) * 100))
                : 94,
            durationSeconds: Math.max(12, Math.round(sessionDurationSeconds)),
            patternName: pat.name,
          });
        }
      };

      const spawnMentalHazard = (waveLevel: number) => {
        for (let i = 0; i < MAX_HAZARDS; i++) {
          const h = hazards[i];
          if (!h.active) {
            const edge = Math.floor(Math.random() * 4);
            const margin = 50;
            if (edge === 0) {
              h.x = Math.random() * width;
              h.y = -margin;
            } else if (edge === 1) {
              h.x = width + margin;
              h.y = Math.random() * height;
            } else if (edge === 2) {
              h.x = Math.random() * width;
              h.y = height + margin;
            } else {
              h.x = -margin;
              h.y = Math.random() * height;
            }

            const roll = Math.random();
            if (waveLevel >= 3 && roll > 0.68) {
              h.kind = 'mist';
              h.radius = 28;
              h.hp = 2;
              h.maxHp = 2;
              h.windupDuration = 1.3;
            } else if (waveLevel >= 2 && roll > 0.36) {
              h.kind = 'spark';
              h.radius = 16;
              h.hp = 1;
              h.maxHp = 1;
              h.windupDuration = 0.95;
            } else {
              h.kind = 'vortex';
              h.radius = 21;
              h.hp = 1;
              h.maxHp = 1;
              h.windupDuration = 1.15;
            }

            h.active = true;
            h.state = 'APPROACH';
            h.stateTimer = 0;
            h.vx = 0;
            h.vy = 0;
            h.flashTimer = 0;
            h.angle = Math.random() * Math.PI * 2;
            break;
          }
        }
      };

      const triggerHarmonicWave = () => {
        if (pulseCooldown > 0) return;
        pulseCooldown = 0.32;
        pulseInputBufferTimer = 0;

        const isResonantWindow =
          breathPhase === 'EXHALE' || exhaleCoyoteTimer > 0 || auraCharge >= 0.65;
        totalExhaleAttempts += 1;

        if (isResonantWindow) {
          syncedExhales += 1;
          streakMultiplier = Math.min(5, streakMultiplier + 1);
          hasPulsedThisExhale = true;
        }

        const chargeFactor = Math.max(0.25, auraCharge);
        const maxRad = isResonantWindow ? 190 + chargeFactor * 145 : 125 + chargeFactor * 60;

        for (let i = 0; i < MAX_WAVES; i++) {
          const w = waves[i];
          if (!w.active) {
            w.active = true;
            w.x = koi.x;
            w.y = koi.y;
            w.radius = 20;
            w.maxRadius = maxRad;
            w.power = isResonantWindow && chargeFactor > 0.7 ? 2 : 1;
            w.resonant = isResonantWindow;
            w.color = isResonantWindow ? '#2DD4BF' : '#38BDF8';
            w.alpha = 0.95;
            break;
          }
        }

        // Squash-and-stretch impulse on Koi
        koi.scaleX = 1.28;
        koi.scaleY = 0.76;
        soundEngine.playHarmonicPulse(isResonantWindow ? Math.max(0.6, chargeFactor) : 0.3);
        spawnParticleBurst(
          koi.x,
          koi.y,
          isResonantWindow ? 20 : 10,
          isResonantWindow ? '#2DD4BF' : '#7DD3FC',
          135
        );

        if (isResonantWindow) {
          serenityIntegrity = Math.min(100, serenityIntegrity + 4);
          spawnCallout(
            koi.x,
            koi.y - 32,
            chargeFactor > 0.75 ? 'HARMONIC RELEASE' : 'RESONANT EXHALE',
            `${streakMultiplier}x FLOW`,
            '#2DD4BF'
          );
        }

        auraCharge = Math.max(0.1, auraCharge * 0.25);
      };

      let lastTime = performance.now();
      let animFrameId = 0;

      const loop = (now: number) => {
        animFrameId = requestAnimationFrame(loop);

        // Clamp delta time as required: Math.min(rawDt, 0.05)
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

        const { gameState: curGameState, pattern: curPattern, playStyle: curPlayStyle, sessionRunId: curRunId } =
          stateRef.current;

        if (curRunId !== currentRunId) {
          currentRunId = curRunId;
          initWorld();
        }

        // Hitstop freeze for heavy impact feel (30-80ms)
        if (hitstopTimer > 0) {
          hitstopTimer -= dt;
          renderScene(ctx, now / 1000);
          return;
        }

        if (curGameState === 'PAUSED' || curGameState === 'VICTORY' || curGameState === 'GAME_OVER') {
          renderScene(ctx, now / 1000);
          justPressedKeys.clear();
          mouseJustPressed = false;
          mouseJustReleased = false;
          spaceJustReleased = false;
          return;
        }

        // Update decaying camera shake
        if (shakeIntensity > 0) {
          shakeIntensity = Math.max(0, shakeIntensity - dt * 28);
        }

        // Update timers
        if (pulseCooldown > 0) pulseCooldown = Math.max(0, pulseCooldown - dt);
        if (pulseInputBufferTimer > 0) pulseInputBufferTimer = Math.max(0, pulseInputBufferTimer - dt);
        if (exhaleCoyoteTimer > 0) exhaleCoyoteTimer = Math.max(0, exhaleCoyoteTimer - dt);

        // Breath Phase Progression
        const currentPhaseMax = getPhaseDuration(breathPhase, curPattern);
        phaseElapsed += dt;
        if (phaseElapsed >= currentPhaseMax) {
          advanceBreathPhase(curPattern);
        }
        const phaseProgress = Math.min(1, phaseElapsed / Math.max(0.1, getPhaseDuration(breathPhase, curPattern)));

        if (curGameState === 'TITLE_MENU') {
          // Atmospheric autonomous Koi figure-eight swim on Title Screen
          const t = now * 0.00055;
          const targetX = width * 0.5 + Math.sin(t) * Math.min(width * 0.26, 310);
          const targetY = height * 0.54 + Math.sin(t * 2) * Math.min(height * 0.16, 145);
          const dx = targetX - koi.x;
          const dy = targetY - koi.y;
          koi.vx = dx * 2.1;
          koi.vy = dy * 2.1;
          koi.x += koi.vx * dt;
          koi.y += koi.vy * dt;
          koi.angle = Math.atan2(koi.vy, koi.vx);

          koi.wakeTimer += dt;
          if (koi.wakeTimer > 0.35) {
            koi.wakeTimer = 0;
            spawnRipple(koi.x, koi.y, 68, 'rgba(45, 212, 191, 0.25)', 1.2);
          }
        } else if (curGameState === 'PLAYING') {
          sessionDurationSeconds += dt;

          // Movement input: WASD / Arrow Keys
          let moveX = 0;
          let moveY = 0;
          if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) moveY -= 1;
          if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveY += 1;
          if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) moveX -= 1;
          if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;

          // Normalize diagonal movement
          if (moveX !== 0 && moveY !== 0) {
            const inv = 1 / Math.sqrt(2);
            moveX *= inv;
            moveY *= inv;
          }

          const accel = 980;
          const drag = 4.2;
          koi.vx += moveX * accel * dt;
          koi.vy += moveY * accel * dt;
          koi.vx -= koi.vx * drag * dt;
          koi.vy -= koi.vy * drag * dt;

          koi.x += koi.vx * dt;
          koi.y += koi.vy * dt;

          // Keep Koi comfortably inside pond bounds
          const pad = 42;
          if (koi.x < pad) {
            koi.x = pad;
            koi.vx *= -0.4;
          } else if (koi.x > width - pad) {
            koi.x = width - pad;
            koi.vx *= -0.4;
          }
          if (koi.y < pad) {
            koi.y = pad;
            koi.vy *= -0.4;
          } else if (koi.y > height - pad) {
            koi.y = height - pad;
            koi.vy *= -0.4;
          }

          const speed = Math.hypot(koi.vx, koi.vy);
          if (speed > 12) {
            const targetAngle = Math.atan2(koi.vy, koi.vx);
            let diff = targetAngle - koi.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            koi.angle += diff * Math.min(1, dt * 10);
          }

          koi.wakeTimer += dt * (1 + speed / 180);
          if (koi.wakeTimer > 0.26) {
            koi.wakeTimer = 0;
            spawnRipple(koi.x, koi.y, 62, 'rgba(45, 212, 191, 0.28)', 1.2);
          }

          // Breath Holding / Action Mechanics
          const isHoldingAction = heldKeys.has('Space') || mouseHeld;
          if (breathPhase === 'INHALE' || breathPhase === 'HOLD_IN') {
            if (isHoldingAction) {
              auraCharge = Math.min(1, auraCharge + dt * 0.52);
              koi.scaleX += (1.14 - koi.scaleX) * dt * 6;
              koi.scaleY += (1.14 - koi.scaleY) * dt * 6;
            } else {
              auraCharge = Math.min(0.85, auraCharge + dt * 0.2);
            }
          }

          // Trigger Harmonic Exhale Wave on Space/Mouse release during EXHALE or on buffered press during EXHALE
          const shouldFireFromRelease =
            (spaceJustReleased || mouseJustReleased) &&
            (breathPhase === 'EXHALE' || exhaleCoyoteTimer > 0 || auraCharge > 0.6);
          const shouldFireFromBuffer =
            pulseInputBufferTimer > 0 &&
            (justPressedKeys.has('Space') || mouseJustPressed) &&
            (breathPhase === 'EXHALE' || exhaleCoyoteTimer > 0 || !isHoldingAction);

          if (shouldFireFromRelease || shouldFireFromBuffer) {
            triggerHarmonicWave();
          }

          // Smoothly relax squash-and-stretch back to 1.0
          koi.scaleX += (1 - koi.scaleX) * Math.min(1, dt * 9);
          koi.scaleY += (1 - koi.scaleY) * Math.min(1, dt * 9);
          if (koi.hitFlash > 0) koi.hitFlash = Math.max(0, koi.hitFlash - dt * 4);

          // Update Lotus Shrines proximity resonance
          let bloomedCount = 0;
          for (let i = 0; i < shrines.length; i++) {
            const s = shrines[i];
            s.petalAngle += dt * (s.bloomed ? 0.55 : 0.2);
            if (s.flashTimer > 0) s.flashTimer = Math.max(0, s.flashTimer - dt * 3);

            const dist = Math.hypot(koi.x - s.x, koi.y - s.y);
            if (!s.bloomed && dist < 115) {
              const rate = isHoldingAction ? 26 : 15;
              s.progress = Math.min(100, s.progress + dt * rate);
              if (s.progress >= 100) {
                s.bloomed = true;
                s.flashTimer = 1;
                hitstopTimer = 0.055;
                shakeIntensity = 6;
                harmonyScore += 250 * streakMultiplier;
                serenityIntegrity = Math.min(100, serenityIntegrity + 12);
                soundEngine.playLotusBloom();
                spawnRipple(s.x, s.y, 190, 'rgba(251, 191, 36, 0.75)', 2.8);
                spawnParticleBurst(s.x, s.y, 32, '#FDE68A', 165);
                spawnCallout(s.x, s.y - 30, 'LOTUS SHRINE BLOOMED', '+250 HARMONY', '#FDE68A');
              }
            }
            if (s.bloomed) bloomedCount++;
          }

          // Smooth Difficulty Ramp & Encounter Spawning
          const activeWave = 1 + Math.floor(cyclesCompleted / 2);
          const maxConcurrentHazards = curPlayStyle === 'zen' ? 3 : Math.min(8, 3 + activeWave);
          const currentActiveHazards = hazards.filter((h) => h.active).length;

          hazardSpawnTimer -= dt;
          if (hazardSpawnTimer <= 0 && currentActiveHazards < maxConcurrentHazards) {
            spawnMentalHazard(activeWave);
            hazardSpawnTimer = Math.max(1.6, 3.6 - activeWave * 0.28);
          }

          // Update Mental Distraction Hazards (Distinct Behaviors + Windup Telegraphs)
          for (let i = 0; i < MAX_HAZARDS; i++) {
            const h = hazards[i];
            if (!h.active) continue;

            h.angle += dt * 1.8;
            if (h.flashTimer > 0) h.flashTimer = Math.max(0, h.flashTimer - dt * 5);

            const dx = koi.x - h.x;
            const dy = koi.y - h.y;
            const distToKoi = Math.hypot(dx, dy);

            if (h.state === 'APPROACH') {
              const approachSpeed = h.kind === 'mist' ? 52 : h.kind === 'spark' ? 92 : 74;
              const nx = distToKoi > 1 ? dx / distToKoi : 0;
              const ny = distToKoi > 1 ? dy / distToKoi : 0;
              h.vx = nx * approachSpeed;
              h.vy = ny * approachSpeed;
              h.x += h.vx * dt;
              h.y += h.vy * dt;

              const triggerDist = h.kind === 'spark' ? 230 : h.kind === 'vortex' ? 165 : 140;
              if (distToKoi < triggerDist) {
                h.state = 'WINDUP';
                h.stateTimer = 0;
                h.aimX = koi.x;
                h.aimY = koi.y;
              }
            } else if (h.state === 'WINDUP') {
              h.stateTimer += dt;
              // Gently track player during early windup so telegraph is fair and readable
              if (h.stateTimer < h.windupDuration * 0.55) {
                h.aimX = koi.x;
                h.aimY = koi.y;
              }
              if (h.stateTimer >= h.windupDuration) {
                h.state = 'STRIKE';
                h.stateTimer = 0;
                const sdx = h.aimX - h.x;
                const sdy = h.aimY - h.y;
                const sdist = Math.max(1, Math.hypot(sdx, sdy));
                const dashSpeed = h.kind === 'spark' ? 360 : h.kind === 'vortex' ? 255 : 155;
                h.vx = (sdx / sdist) * dashSpeed;
                h.vy = (sdy / sdist) * dashSpeed;
              }
            } else if (h.state === 'STRIKE') {
              h.stateTimer += dt;
              h.x += h.vx * dt;
              h.y += h.vy * dt;
              const strikeDuration = h.kind === 'spark' ? 0.55 : 0.65;
              if (h.stateTimer >= strikeDuration) {
                h.state = 'COOLDOWN';
                h.stateTimer = 0;
              }
            } else if (h.state === 'COOLDOWN') {
              h.stateTimer += dt;
              h.vx *= 0.9;
              h.vy *= 0.9;
              h.x += h.vx * dt;
              h.y += h.vy * dt;
              if (h.stateTimer >= 0.85) {
                h.state = 'APPROACH';
                h.stateTimer = 0;
              }
            }

            // Collision with Koi
            if (distToKoi < h.radius + 17) {
              h.active = false;
              koi.hitFlash = 1;
              koi.scaleX = 0.78;
              koi.scaleY = 1.24;
              hitstopTimer = 0.045;
              shakeIntensity = 7;
              streakMultiplier = 1;
              soundEngine.playDisruptionHit();
              spawnParticleBurst(h.x, h.y, 16, '#FB7185', 130);

              if (curPlayStyle === 'challenge') {
                serenityIntegrity = Math.max(0, serenityIntegrity - 16);
                spawnCallout(koi.x, koi.y - 28, 'SERENITY DISRUPTED', '-16 CALM', '#FDA4AF');
                if (serenityIntegrity <= 0) {
                  stateRef.current.onSessionEnd({
                    victory: false,
                    cyclesCompleted,
                    targetCycles: curPattern.targetCycles,
                    harmonyScore,
                    lotusBloomed: shrines.filter((s) => s.bloomed).length,
                    shadowsPurified,
                    breathSyncAccuracy:
                      totalExhaleAttempts > 0
                        ? Math.min(100, Math.round((syncedExhales / totalExhaleAttempts) * 100))
                        : 75,
                    durationSeconds: Math.max(5, Math.round(sessionDurationSeconds)),
                    patternName: curPattern.name,
                  });
                }
              } else {
                spawnCallout(koi.x, koi.y - 28, 'GENTLE REMINDER', 'RETURN TO BREATH', '#FCD34D');
              }
            }
          }
        }

        // Update Harmonic Exhale Waves & Check Collisions with Hazards / Shrines
        for (let i = 0; i < MAX_WAVES; i++) {
          const w = waves[i];
          if (!w.active) continue;

          w.radius += dt * 340;
          w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);

          // Check Lotus Shrines
          for (let sIdx = 0; sIdx < shrines.length; sIdx++) {
            const s = shrines[sIdx];
            if (!s.bloomed) {
              const dist = Math.hypot(s.x - w.x, s.y - w.y);
              if (Math.abs(dist - w.radius) < 30) {
                s.progress = Math.min(100, s.progress + dt * (w.resonant ? 145 : 85));
                if (s.progress >= 100) {
                  s.bloomed = true;
                  s.flashTimer = 1;
                  hitstopTimer = 0.055;
                  shakeIntensity = 6;
                  harmonyScore += 250 * streakMultiplier;
                  serenityIntegrity = Math.min(100, serenityIntegrity + 12);
                  soundEngine.playLotusBloom();
                  spawnRipple(s.x, s.y, 190, 'rgba(251, 191, 36, 0.75)', 2.8);
                  spawnParticleBurst(s.x, s.y, 32, '#FDE68A', 165);
                  spawnCallout(s.x, s.y - 30, 'LOTUS SHRINE BLOOMED', '+250 HARMONY', '#FDE68A');
                }
              }
            }
          }

          // Check Mental Distraction Hazards
          for (let hIdx = 0; hIdx < MAX_HAZARDS; hIdx++) {
            const h = hazards[hIdx];
            if (!h.active || h.flashTimer > 0.15) continue;
            const dist = Math.hypot(h.x - w.x, h.y - w.y);
            if (dist <= w.radius + h.radius && dist >= w.radius - 42) {
              h.hp -= w.power;
              h.flashTimer = 0.4;
              if (h.hp <= 0) {
                h.active = false;
                shadowsPurified += 1;
                const pts = (h.kind === 'mist' ? 180 : 120) * streakMultiplier;
                harmonyScore += pts;
                hitstopTimer = 0.05;
                shakeIntensity = Math.min(10, shakeIntensity + 4.5);
                soundEngine.playPurifyImpact(shadowsPurified);
                spawnParticleBurst(h.x, h.y, 24, '#FDE68A', 150);
                spawnRipple(h.x, h.y, 110, 'rgba(253, 230, 138, 0.65)', 2);
                spawnCallout(
                  h.x,
                  h.y - 20,
                  `+${pts} PURIFIED`,
                  h.kind === 'mist' ? 'DOUBT DISSOLVED' : 'THOUGHT RELEASED',
                  '#FDE68A'
                );
              } else {
                // Knockback on 2-HP Mist Cloud
                const kdx = h.x - w.x;
                const kdy = h.y - w.y;
                const kd = Math.max(1, Math.hypot(kdx, kdy));
                h.x += (kdx / kd) * 28;
                h.y += (kdy / kd) * 28;
                spawnParticleBurst(h.x, h.y, 10, '#38BDF8', 90);
              }
            }
          }

          if (w.radius >= w.maxRadius) {
            w.active = false;
          }
        }

        // Update Koi articulated tail segments
        let prevX = koi.x;
        let prevY = koi.y;
        const swimWave = Math.sin(now * 0.011) * 2.2;
        for (let i = 0; i < koi.tailSegments.length; i++) {
          const seg = koi.tailSegments[i];
          const dx = prevX - seg.x;
          const dy = prevY - seg.y;
          const dist = Math.max(0.01, Math.hypot(dx, dy));
          const spacing = 6.8;
          if (dist > spacing) {
            const angle = Math.atan2(dy, dx);
            const perpX = -Math.sin(angle) * Math.sin(now * 0.014 - i * 0.6) * (i * 0.35);
            const perpY = Math.cos(angle) * Math.sin(now * 0.014 - i * 0.6) * (i * 0.35);
            seg.x = prevX - Math.cos(angle) * spacing + perpX * 0.15;
            seg.y = prevY - Math.sin(angle) * spacing + perpY * 0.15 + swimWave * 0.05;
          }
          prevX = seg.x;
          prevY = seg.y;
        }

        // Update Prana Motes (attracted when holding breath during INHALE)
        const isChargingInhale =
          curGameState === 'PLAYING' &&
          (heldKeys.has('Space') || mouseHeld) &&
          (breathPhase === 'INHALE' || breathPhase === 'HOLD_IN');

        for (let i = 0; i < pranaMotes.length; i++) {
          const m = pranaMotes[i];
          if (isChargingInhale) {
            const dx = koi.x - m.x;
            const dy = koi.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < 240 && d > 8) {
              m.x += (dx / d) * 140 * dt;
              m.y += (dy / d) * 140 * dt;
            }
            if (d <= 22) {
              auraCharge = Math.min(1, auraCharge + 0.045);
              harmonyScore += 15;
              m.x = Math.random() * width;
              m.y = Math.random() * height;
            }
          }
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.x < 0) m.x = width;
          if (m.x > width) m.x = 0;
          if (m.y < 0) m.y = height;
          if (m.y > height) m.y = 0;
        }

        // Update Pooled Ripples, Particles, and Callouts
        for (let i = 0; i < MAX_RIPPLES; i++) {
          const r = ripples[i];
          if (!r.active) continue;
          r.radius += dt * 58;
          r.alpha = Math.max(0, (1 - r.radius / r.maxRadius) * 0.6);
          if (r.radius >= r.maxRadius) r.active = false;
        }

        for (let i = 0; i < MAX_PARTICLES; i++) {
          const p = particles[i];
          if (!p.active) continue;
          p.life += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life >= p.maxLife) p.active = false;
        }

        for (let i = 0; i < MAX_CALLOUTS; i++) {
          const c = callouts[i];
          if (!c.active) continue;
          c.life += dt;
          c.y -= dt * 28;
          if (c.life >= c.maxLife) c.active = false;
        }

        // Emit throttled HUD snapshot (~15Hz) so React UI stays crisp without saturating re-renders
        hudUpdateAccumulator += dt;
        if (hudUpdateAccumulator >= 0.065) {
          hudUpdateAccumulator = 0;
          const phaseDur = getPhaseDuration(breathPhase, curPattern);
          let guidance = 'Hold Space to draw in glowing Prana';
          if (breathPhase === 'HOLD_IN') {
            guidance = 'Center your awareness in the stillness';
          } else if (breathPhase === 'EXHALE') {
            guidance = hasPulsedThisExhale
              ? 'Glide smoothly and let tension dissolve'
              : 'Release Space now to send a Harmonic Exhale Wave';
          } else if (breathPhase === 'HOLD_OUT') {
            guidance = 'Rest in quiet equilibrium before the next breath';
          }

          stateRef.current.onHudUpdate({
            breathPhase,
            phaseTimeLeft: Math.max(0, phaseDur - phaseElapsed),
            phaseDuration: phaseDur,
            phaseProgress,
            auraCharge,
            cyclesCompleted,
            targetCycles: curPattern.targetCycles,
            serenityIntegrity: Math.round(serenityIntegrity),
            harmonyScore: Math.round(harmonyScore),
            streakMultiplier,
            lotusBloomed: shrines.filter((s) => s.bloomed).length,
            totalLotusTarget: shrines.length,
            shadowsPurified,
            activeWave: 1 + Math.floor(cyclesCompleted / 2),
            breathSyncAccuracy:
              totalExhaleAttempts > 0
                ? Math.min(100, Math.round((syncedExhales / totalExhaleAttempts) * 100))
                : 100,
            guidanceText: guidance,
          });
        }

        renderScene(ctx, now / 1000);

        // Clear edge-triggered inputs at end of frame
        justPressedKeys.clear();
        mouseJustPressed = false;
        mouseJustReleased = false;
        spaceJustReleased = false;
      };

      const renderScene = (c: CanvasRenderingContext2D, timeSec: number) => {
        c.save();

        // Apply decaying camera shake
        if (shakeIntensity > 0.1) {
          const sx = (Math.random() - 0.5) * shakeIntensity * 2;
          const sy = (Math.random() - 0.5) * shakeIntensity * 2;
          c.translate(sx, sy);
        }

        // 1. Deep Twilight Sanctuary Pond Gradient
        const bgGrad = c.createRadialGradient(
          width * 0.5,
          height * 0.45,
          40,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.75
        );
        bgGrad.addColorStop(0, '#0D2233');
        bgGrad.addColorStop(0.55, '#081521');
        bgGrad.addColorStop(1, '#050C14');
        c.fillStyle = bgGrad;
        c.fillRect(0, 0, width, height);

        // Subtle sacred geometry pond floor grid rings
        c.strokeStyle = 'rgba(45, 212, 191, 0.04)';
        c.lineWidth = 1;
        for (let r = 140; r < Math.max(width, height) * 0.65; r += 140) {
          c.beginPath();
          c.arc(width * 0.5, height * 0.52, r, 0, Math.PI * 2);
          c.stroke();
        }

        // 2. Ambient Prana Motes
        for (let i = 0; i < pranaMotes.length; i++) {
          const m = pranaMotes[i];
          const pulse = 0.55 + 0.45 * Math.sin(timeSec * 2.2 + m.phaseOffset);
          c.fillStyle = m.color;
          c.globalAlpha = pulse * 0.55;
          c.beginPath();
          c.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;

        // 3. Water Ripples
        for (let i = 0; i < MAX_RIPPLES; i++) {
          const r = ripples[i];
          if (!r.active) continue;
          c.save();
          c.strokeStyle = r.color;
          c.globalAlpha = r.alpha;
          c.lineWidth = r.lineWidth;
          c.beginPath();
          c.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }

        // 4. Lotus Shrines (Lily pads + charging rings + blooming multi-petal lotus)
        for (let i = 0; i < shrines.length; i++) {
          const s = shrines[i];
          c.save();
          c.translate(s.x, s.y);

          // Lily pad base
          c.fillStyle = s.bloomed ? 'rgba(16, 185, 129, 0.24)' : 'rgba(15, 118, 110, 0.18)';
          c.strokeStyle = s.bloomed ? 'rgba(52, 211, 153, 0.6)' : 'rgba(45, 212, 191, 0.28)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(0, 0, 34, 0.25, Math.PI * 2 - 0.15);
          c.lineTo(0, 0);
          c.closePath();
          c.fill();
          c.stroke();

          // Progress ring around dormant shrine
          if (!s.bloomed && s.progress > 0) {
            c.strokeStyle = '#FBBF24';
            c.lineWidth = 2.5;
            c.beginPath();
            c.arc(0, 0, 40, -Math.PI * 0.5, -Math.PI * 0.5 + (s.progress / 100) * Math.PI * 2);
            c.stroke();
          }

          // Lotus Petals
          const petalCount = s.bloomed ? 8 : 5;
          const petalLen = s.bloomed ? 22 : 12 + (s.progress / 100) * 8;
          c.rotate(s.petalAngle);
          for (let p = 0; p < petalCount; p++) {
            c.save();
            c.rotate((p * Math.PI * 2) / petalCount);
            c.fillStyle =
              s.flashTimer > 0
                ? '#FFFFFF'
                : s.bloomed
                  ? 'rgba(251, 191, 36, 0.88)'
                  : 'rgba(148, 163, 184, 0.45)';
            c.beginPath();
            c.ellipse(petalLen * 0.55, 0, petalLen * 0.55, 6.5, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
          }

          // Core jewel
          c.fillStyle = s.bloomed ? '#FEF08A' : '#475569';
          c.beginPath();
          c.arc(0, 0, s.bloomed ? 7 : 4.5, 0, Math.PI * 2);
          c.fill();

          c.restore();
        }

        // 5. Harmonic Exhale Waves
        for (let i = 0; i < MAX_WAVES; i++) {
          const w = waves[i];
          if (!w.active) continue;
          c.save();
          c.strokeStyle = w.color;
          c.globalAlpha = w.alpha;
          c.lineWidth = w.resonant ? 3.5 : 2;
          c.beginPath();
          c.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
          c.stroke();

          if (w.resonant) {
            c.strokeStyle = '#FDE68A';
            c.globalAlpha = w.alpha * 0.55;
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(w.x, w.y, Math.max(4, w.radius - 10), 0, Math.PI * 2);
            c.stroke();
          }
          c.restore();
        }

        // 6. Rhythmic Breath Cadence Guide Ring around the Spirit Koi
        const pat = stateRef.current.pattern;
        const phaseDur = getPhaseDuration(breathPhase, pat);
        const phaseProg = Math.min(1, phaseElapsed / Math.max(0.1, phaseDur));

        let breathRadius = 46;
        if (breathPhase === 'INHALE') {
          breathRadius = 38 + phaseProg * 56;
        } else if (breathPhase === 'HOLD_IN') {
          breathRadius = 94 + Math.sin(timeSec * 6) * 3;
        } else if (breathPhase === 'EXHALE') {
          breathRadius = 94 - phaseProg * 56;
        } else {
          breathRadius = 38;
        }

        c.save();
        c.translate(koi.x, koi.y);

        // Outer reference ring (max inhale circumference)
        c.strokeStyle = 'rgba(148, 163, 184, 0.18)';
        c.setLineDash([4, 6]);
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(0, 0, 94, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);

        // Active dynamic breath ring
        const ringColor =
          breathPhase === 'INHALE'
            ? '#2DD4BF'
            : breathPhase === 'HOLD_IN'
              ? '#FBBF24'
              : breathPhase === 'EXHALE'
                ? '#38BDF8'
                : '#94A3B8';

        c.strokeStyle = ringColor;
        c.lineWidth = 2.4 + auraCharge * 2;
        c.globalAlpha = 0.78;
        c.beginPath();
        c.arc(0, 0, breathRadius, 0, Math.PI * 2);
        c.stroke();

        // Soft aura fill proportional to Prana charge
        const auraGrad = c.createRadialGradient(0, 0, 8, 0, 0, breathRadius);
        auraGrad.addColorStop(0, 'rgba(45, 212, 191, 0.22)');
        auraGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        c.fillStyle = auraGrad;
        c.beginPath();
        c.arc(0, 0, breathRadius, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // 7. Spirit Koi Character (Articulated tail + fins + head)
        c.save();
        // Draw tail segments from back to front
        for (let i = koi.tailSegments.length - 1; i >= 0; i--) {
          const seg = koi.tailSegments[i];
          const tRatio = 1 - i / koi.tailSegments.length;
          const r = 3.5 + tRatio * 10.5;
          c.fillStyle =
            koi.hitFlash > 0
              ? '#FFFFFF'
              : i % 2 === 0
                ? '#F8FAFC'
                : '#2DD4BF';
          c.globalAlpha = 0.35 + tRatio * 0.65;
          c.beginPath();
          c.arc(seg.x, seg.y, r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;

        // Koi Head & Pectoral Fins with Squash & Stretch
        c.translate(koi.x, koi.y);
        c.rotate(koi.angle);
        c.scale(koi.scaleX, koi.scaleY);

        const finFlutter = Math.sin(timeSec * 9) * 0.22;
        c.fillStyle = koi.hitFlash > 0 ? '#FFFFFF' : 'rgba(45, 212, 191, 0.72)';
        // Left fin
        c.save();
        c.translate(-2, -10);
        c.rotate(-0.65 + finFlutter);
        c.beginPath();
        c.ellipse(0, -7, 5, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // Right fin
        c.save();
        c.translate(-2, 10);
        c.rotate(0.65 - finFlutter);
        c.beginPath();
        c.ellipse(0, 7, 5, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // Main Koi torso
        c.fillStyle = koi.hitFlash > 0 ? '#FFFFFF' : '#F8FAFC';
        c.beginPath();
        c.ellipse(2, 0, 17, 11, 0, 0, Math.PI * 2);
        c.fill();

        // Golden forehead crown marking
        c.fillStyle = '#F59E0B';
        c.beginPath();
        c.arc(9, 0, 5.2, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // 8. Mental Distraction Hazards & Windup Telegraphs
        for (let i = 0; i < MAX_HAZARDS; i++) {
          const h = hazards[i];
          if (!h.active) continue;

          c.save();
          // Visible Windup Telegraph before strike!
          if (h.state === 'WINDUP') {
            const wProg = Math.min(1, h.stateTimer / Math.max(0.1, h.windupDuration));
            if (h.kind === 'spark') {
              // Dashed directional laser trajectory telegraph
              c.strokeStyle = `rgba(251, 113, 133, ${0.35 + wProg * 0.6})`;
              c.lineWidth = 2;
              c.setLineDash([6, 6]);
              c.beginPath();
              c.moveTo(h.x, h.y);
              c.lineTo(h.aimX, h.aimY);
              c.stroke();
              c.setLineDash([]);
            } else {
              // Shrinking crimson-amber telegraph ring + target indicator
              const teleRad = h.radius + (1 - wProg) * 38;
              c.strokeStyle = `rgba(251, 113, 133, ${0.4 + wProg * 0.6})`;
              c.lineWidth = 2.2;
              c.beginPath();
              c.arc(h.x, h.y, teleRad, 0, Math.PI * 2);
              c.stroke();
            }
          }

          c.translate(h.x, h.y);
          c.rotate(h.angle);

          if (h.kind === 'vortex') {
            c.fillStyle = h.flashTimer > 0 ? '#FFFFFF' : '#1E1B4B';
            c.strokeStyle = h.state === 'WINDUP' ? '#FB7185' : '#F43F5E';
            c.lineWidth = 2.2;
            c.beginPath();
            c.arc(0, 0, h.radius, 0, Math.PI * 2);
            c.fill();
            c.stroke();

            // Inner spiral spikes
            for (let s = 0; s < 4; s++) {
              c.rotate(Math.PI * 0.5);
              c.beginPath();
              c.moveTo(6, 0);
              c.lineTo(h.radius + 5, 4);
              c.stroke();
            }
          } else if (h.kind === 'spark') {
            c.fillStyle = h.flashTimer > 0 ? '#FFFFFF' : '#F43F5E';
            c.beginPath();
            for (let p = 0; p < 8; p++) {
              const r = p % 2 === 0 ? h.radius + 4 : h.radius * 0.48;
              const a = (p * Math.PI) / 4;
              if (p === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
              else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            c.closePath();
            c.fill();
          } else {
            // Heavy Doubt Mist (2 HP)
            c.fillStyle = h.flashTimer > 0 ? '#FFFFFF' : 'rgba(49, 46, 129, 0.88)';
            c.strokeStyle = h.hp === 2 ? '#A78BFA' : '#FB7185';
            c.lineWidth = 2.5;
            c.beginPath();
            c.arc(0, 0, h.radius, 0, Math.PI * 2);
            c.fill();
            c.stroke();
          }

          c.restore();
        }

        // 9. Pooled Particle Bursts
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const p = particles[i];
          if (!p.active) continue;
          c.fillStyle = p.color;
          c.globalAlpha = p.alpha;
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;

        // 10. Floating World Callouts
        c.textAlign = 'center';
        for (let i = 0; i < MAX_CALLOUTS; i++) {
          const cal = callouts[i];
          if (!cal.active) continue;
          const alpha = Math.max(0, 1 - cal.life / cal.maxLife);
          c.globalAlpha = alpha;
          c.font = '600 13px "Plus Jakarta Sans", sans-serif';
          c.fillStyle = cal.color;
          c.fillText(cal.text, cal.x, cal.y);
          if (cal.subtext) {
            c.font = '500 11px "JetBrains Mono", monospace';
            c.fillStyle = '#E2E8F0';
            c.fillText(cal.subtext, cal.x, cal.y + 15);
          }
        }
        c.globalAlpha = 1;

        c.restore();
      };

      animFrameId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handlePointerDown);
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('blur', clearInputs);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="fixed inset-0 block w-full h-full pointer-events-auto"
        aria-label="Prana Pond interactive breathing sanctuary canvas"
      />
    );
  }
);
