import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Keyboard,
  Mouse,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
  ZoomIn,
} from 'lucide-react';
import { MAPS_CONFIG, Track } from '../game/maps';
import { StickmanRunner } from '../game/runner';
import { sound } from '../game/sound';
import {
  FALSE_START_FREEZE_SEC,
  LANE_OFFSETS,
  RACE_COUNTDOWN_SEC,
  STAMINA_THRESHOLD,
  ULT_UNLOCK_TIME,
  type CharType,
  type ControlMode,
  type HudSnapshot,
  type MapId,
  type PlayerCount,
  type PlayerHudState,
  type RaceResult,
  type TrackDirection,
  type TrackLengthCategory,
  type ZoomPreset,
} from '../types/game';

interface RaceViewProps {
  mapId: MapId;
  playerCount: PlayerCount;
  myCharType: CharType;
  p2CharType: CharType;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  onReturnToHub: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return m > 0 ? `${m}:${s}` : `${sec.toFixed(1)}s`;
}

type RaceAction =
  | { target: 'shared'; type: 'zoom' }
  | { target: 1; type: 'strideQ' | 'strideE' | 'sprint' | 'ability' | 'ult' | 'lane' }
  | { target: 2; type: 'sprint' | 'ability' | 'ult' | 'lane' };

function resolveRaceAction(e: KeyboardEvent, playerCount: PlayerCount): RaceAction | null {
  const code = e.code;
  const key = e.key.toLowerCase();

  if (code === 'KeyO' || key === 'o' || key === 'ô' || key === 'ơ') {
    return { target: 'shared', type: 'zoom' };
  }

  // Player 1 keys (1P & 2P)
  if (code === 'KeyQ' || key === 'q') return { target: 1, type: 'strideQ' };
  if (code === 'KeyE' || key === 'e' || key === 'ê') return { target: 1, type: 'strideE' };
  if (code === 'KeyR' || key === 'r') return { target: 1, type: 'sprint' };
  if (code === 'KeyF' || key === 'f') return { target: 1, type: 'ability' };
  if (code === 'KeyG' || key === 'g') return { target: 1, type: 'ult' };
  if (code === 'KeyT' || key === 't') return { target: 1, type: 'lane' };

  // Player 2 keys (2P only)
  if (playerCount === 2) {
    if (code === 'KeyN' || key === 'n') return { target: 2, type: 'ability' };
    if (code === 'KeyM' || key === 'm') return { target: 2, type: 'ult' };
    if (code === 'KeyL' || key === 'l') return { target: 2, type: 'sprint' };
    if (code === 'KeyK' || key === 'k') return { target: 2, type: 'lane' };
  }

  return null;
}

const ZOOM_LABELS: Record<ZoomPreset, string> = {
  normal: 'Chuẩn (0.86x)',
  wide: 'Góc rộng (0.44x)',
  overview: 'Toàn Map',
};

const CATEGORY_LABELS: Record<TrackLengthCategory, string> = {
  sprint: 'Sprint',
  mile: 'Mile',
  medium: 'Medium',
  long: 'Long',
};

const DIRECTION_LABELS: Record<TrackDirection, string> = {
  cw: '↻ Thuận kim đồng hồ',
  ccw: '↺ Ngược kim đồng hồ',
};

function createEmptyPlayerHud(charType: CharType, totalLaps: number): PlayerHudState {
  return {
    charType,
    stamina: 100,
    exhausted: false,
    iframeTimer: 0,
    baseVel: 0,
    effectiveVel: 0,
    bonusPct: 0,
    currentLap: 1,
    totalLaps,
    laneNumber: 1,
    totalLanes: LANE_OFFSETS.length,
    rank: 1,
    sprintCooldown: 0,
    spurtsLeft: 2,
    spurtBurstTimer: 0,
    spurtSustainTimer: 0,
    abilityUsed: false,
    ultUsed: false,
    activeRegenTimer: 0,
    redChargeTimer: 0,
    redHitCount: 0,
    redMarkedTargets: 0,
    heavyTimer: 0,
    heavySpeedCap: 100,
    silenceTimer: 0,
    stunTimer: 0,
    falseStartPenalty: false,
    falseStartTimer: 0,
    nextExpectedKey: 'KeyQ',
  };
}

function buildPlayerHud(
  runner: StickmanRunner,
  sorted: StickmanRunner[],
  totalLaps: number,
  totalLength: number,
  falseStartPenalty: boolean
): PlayerHudState {
  return {
    charType: runner.charType,
    stamina: runner.stamina,
    exhausted: runner.exhausted,
    iframeTimer: runner.staminaIframeTimer,
    baseVel: Math.round(runner.baseVelocity),
    effectiveVel: Math.round(runner.getEffectiveVelocity()),
    bonusPct: Math.round(runner.getTotalSpeedBonus() * 100),
    currentLap: Math.min(totalLaps, Math.floor(runner.distance / totalLength) + 1),
    totalLaps,
    laneNumber: runner.laneIndex + 1,
    totalLanes: LANE_OFFSETS.length,
    rank: sorted.indexOf(runner) + 1,
    sprintCooldown: runner.sprintCooldown,
    spurtsLeft: runner.spurtsLeft,
    spurtBurstTimer: runner.spurtBurstTimer,
    spurtSustainTimer: runner.spurtSustainTimer,
    abilityUsed: runner.abilityUsed,
    ultUsed: runner.ultUsed,
    activeRegenTimer: runner.activeRegenTimer,
    redChargeTimer: runner.redChargeTimer,
    redHitCount: runner.redHitCount,
    redMarkedTargets: runner.hitTargets.size,
    heavyTimer: runner.heavyTimer,
    heavySpeedCap: Math.round(runner.heavySpeedCap),
    silenceTimer: runner.silenceTimer,
    stunTimer: runner.stunTimer,
    falseStartPenalty,
    falseStartTimer: runner.falseStartTimer,
    nextExpectedKey: runner.lastStepKey === 'KeyQ' ? 'KeyE' : 'KeyQ',
  };
}

export const RaceView: React.FC<RaceViewProps> = ({
  mapId,
  playerCount,
  myCharType,
  p2CharType,
  controlMode,
  onChangeControlMode,
  onReturnToHub,
  muted,
  onToggleMute,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);

  const runnersRef = useRef<StickmanRunner[]>([]);
  const playerRef = useRef<StickmanRunner | null>(null);
  const player2Ref = useRef<StickmanRunner | null>(null);
  const trackRef = useRef<Track | null>(null);
  const raceTimeRef = useRef(0);
  const countdownTimerRef = useRef(RACE_COUNTDOWN_SEC);
  const falseStartPenaltyRef = useRef(false);
  const p2FalseStartPenaltyRef = useRef(false);
  const goBannerTimerRef = useRef(0);
  const finishedRef = useRef(false);
  const logTimerRef = useRef<number | null>(null);
  const p2LogTimerRef = useRef<number | null>(null);

  const zoomPresetRef = useRef<ZoomPreset>('normal');
  const cam1ZoomRef = useRef(0.86);
  const cam1XRef = useRef(0);
  const cam1YRef = useRef(0);
  const camInitializedRef = useRef(false);

  const mapCfg = MAPS_CONFIG[mapId];

  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('normal');
  const [goBannerVisible, setGoBannerVisible] = useState(false);
  const [eventLog, setEventLog] = useState<string>('');
  const [p2EventLog, setP2EventLog] = useState<string>('');
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...createEmptyPlayerHud(myCharType, mapCfg.laps),
    totalRunners: 4,
    raceTime: 0,
    direction: 'cw',
    countdownTimer: RACE_COUNTDOWN_SEC,
    p2: playerCount === 2 ? createEmptyPlayerHud(p2CharType, mapCfg.laps) : undefined,
    standings: [],
  }));

  const pushLog = (msg: string) => {
    setEventLog(msg);
    if (logTimerRef.current) window.clearTimeout(logTimerRef.current);
    logTimerRef.current = window.setTimeout(() => {
      setEventLog('');
    }, 2800);
  };

  const pushP2Log = (msg: string) => {
    setP2EventLog(msg);
    if (p2LogTimerRef.current) window.clearTimeout(p2LogTimerRef.current);
    p2LogTimerRef.current = window.setTimeout(() => {
      setP2EventLog('');
    }, 2800);
  };

  const pushRunnerLog = (msg: string, runner?: StickmanRunner) => {
    if (runner?.playerSlot === 2) {
      pushP2Log(msg);
    } else {
      pushLog(msg);
    }
  };

  const cycleZoom = () => {
    const order: ZoomPreset[] = ['normal', 'wide', 'overview'];
    const idx = order.indexOf(zoomPresetRef.current);
    const next = order[(idx + 1) % order.length];
    zoomPresetRef.current = next;
    setZoomPreset(next);
    pushLog(`🔍 Zoom bản đồ: ${ZOOM_LABELS[next]}`);
  };

  const refocusContainer = () => {
    containerRef.current?.focus({ preventScroll: true });
  };

  const triggerFalseStartPenalty = (slot: 1 | 2) => {
    if (slot === 1) {
      if (!falseStartPenaltyRef.current) {
        falseStartPenaltyRef.current = true;
        sound.playHit();
        pushLog(
          playerCount === 2
            ? '⛔ P1 XUẤT PHÁT LỖI! Đứng hình 1.25s khi xuất phát!'
            : '⛔ XUẤT PHÁT LỖI! Đứng hình 1.25s khi xuất phát & khóa mọi thao tác!'
        );
      }
    } else if (!p2FalseStartPenaltyRef.current) {
      p2FalseStartPenaltyRef.current = true;
      sound.playHit();
      pushP2Log('⛔ P2 XUẤT PHÁT LỖI! Đứng hình 1.25s khi xuất phát!');
    }
  };

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });

    const rolledDirection: TrackDirection = Math.random() < 0.5 ? 'cw' : 'ccw';
    const track = new Track(MAPS_CONFIG[mapId], rolledDirection);
    trackRef.current = track;
    raceTimeRef.current = 0;
    countdownTimerRef.current = RACE_COUNTDOWN_SEC;
    falseStartPenaltyRef.current = false;
    p2FalseStartPenaltyRef.current = false;
    goBannerTimerRef.current = 0;
    setGoBannerVisible(false);
    setP2EventLog('');
    finishedRef.current = false;
    camInitializedRef.current = false;
    setRaceResult(null);

    const p1 = new StickmanRunner(
      playerCount === 2
        ? `P1 (${myCharType === 'blue' ? 'Xanh Biển' : 'Đỏ'})`
        : myCharType === 'blue'
        ? 'BẠN (Xanh Biển)'
        : 'BẠN (Đỏ)',
      myCharType === 'blue' ? '#38bdf8' : '#ef4444',
      0,
      true,
      myCharType,
      1
    );
    playerRef.current = p1;

    if (playerCount === 2) {
      const p2 = new StickmanRunner(
        `P2 (${p2CharType === 'blue' ? 'Xanh Biển' : 'Đỏ'})`,
        p2CharType === 'blue' ? '#0ea5e9' : '#f43f5e',
        1,
        true,
        p2CharType,
        2
      );
      player2Ref.current = p2;
      runnersRef.current = [
        p1,
        p2,
        new StickmanRunner('Bot Xanh 3', '#0284c7', 2, false, 'blue', 0),
        new StickmanRunner('Bot Đỏ 4', '#dc2626', 3, false, 'red', 0),
      ];
    } else {
      player2Ref.current = null;
      runnersRef.current = [
        p1,
        new StickmanRunner('Bot Đỏ 1', '#ef4444', 1, false, 'red', 0),
        new StickmanRunner('Bot Xanh 2', '#0284c7', 2, false, 'blue', 0),
        new StickmanRunner('Bot Đỏ 3', '#dc2626', 3, false, 'red', 0),
      ];
    }

    sound.playCountdownBeep();
    pushLog(
      `⏳ ${track.config.name} (${track.config.laps} vòng · ${DIRECTION_LABELS[rolledDirection]}) — Chờ đếm ngược 3s!`
    );

    const onKeyDown = (e: KeyboardEvent) => {
      if (finishedRef.current || e.repeat) return;
      const action = resolveRaceAction(e, playerCount);
      if (!action) return;

      e.preventDefault();
      if (action.target === 'shared') {
        cycleZoom();
        return;
      }

      const runner = action.target === 1 ? playerRef.current : player2Ref.current;
      const logFn = action.target === 1 ? pushLog : pushP2Log;
      if (!runner) return;

      if (countdownTimerRef.current > 0) {
        if (action.type === 'strideQ' || action.type === 'strideE') {
          triggerFalseStartPenalty(action.target);
        }
        return;
      }

      if (runner.isFrozen()) return;

      if (action.type === 'strideQ') runner.handleStride('KeyQ', logFn);
      else if (action.type === 'strideE') runner.handleStride('KeyE', logFn);
      else if (action.type === 'sprint') runner.useSprint(logFn);
      else if (action.type === 'ability') runner.useAbility(logFn);
      else if (action.type === 'ult') runner.useUltimate(raceTimeRef.current, logFn);
      else if (action.type === 'lane') runner.switchLane(logFn);
    };

    window.addEventListener('keydown', onKeyDown, true);

    let rafId = 0;
    let lastTime = performance.now();

    const computeCamera = (
      runner: StickmanRunner,
      currentTrack: Track,
      viewW: number,
      viewH: number
    ) => {
      const pos = currentTrack.getPositionAt(runner.distance, runner.laneOffset);
      const b = currentTrack.bounds;

      let targetZoom = 0.86;
      let targetX = pos.x;
      let targetY = pos.y;

      if (zoomPresetRef.current === 'wide') {
        targetZoom = 0.44;
      } else if (zoomPresetRef.current === 'overview') {
        const padW = b.width + 1800;
        const padH = b.height + 1400;
        targetZoom = Math.min(viewW / padW, viewH / padH);
        targetX = b.minX + b.width / 2;
        targetY = b.minY + b.height / 2;
      }
      return { targetZoom, targetX, targetY };
    };

    const loop = (now: number) => {
      if (finishedRef.current) return;

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const currentTrack = trackRef.current;
      const runners = runnersRef.current;
      const p1 = playerRef.current;
      const p2 = player2Ref.current;
      if (!currentTrack || !p1) return;

      const totalLaps = currentTrack.config.laps;
      const finishDistance = currentTrack.totalLength * totalLaps;
      let winner: StickmanRunner | null = null;

      if (countdownTimerRef.current > 0) {
        const prevSec = Math.ceil(countdownTimerRef.current);
        countdownTimerRef.current = Math.max(0, countdownTimerRef.current - dt);
        const nextSec = Math.ceil(countdownTimerRef.current);

        if (countdownTimerRef.current > 0 && nextSec < prevSec && nextSec >= 1) {
          sound.playCountdownBeep();
        } else if (countdownTimerRef.current === 0) {
          sound.playStartWhistle();
          goBannerTimerRef.current = 0.9;
          setGoBannerVisible(true);

          if (falseStartPenaltyRef.current) {
            p1.falseStartTimer = FALSE_START_FREEZE_SEC;
            falseStartPenaltyRef.current = false;
            pushLog('⛔ PHẠT XUẤT PHÁT LỖI! Đứng hình 1.25s — khóa mọi thao tác!');
          } else {
            p1.baseVelocity = 100;
            pushLog('🚀 XUẤT PHÁT HOÀN HẢO! Nhận ngay MAX SPEED (100)!');
          }

          if (p2) {
            if (p2FalseStartPenaltyRef.current) {
              p2.falseStartTimer = FALSE_START_FREEZE_SEC;
              p2FalseStartPenaltyRef.current = false;
              pushP2Log('⛔ P2 PHẠT XUẤT PHÁT LỖI! Đứng hình 1.25s!');
            } else {
              p2.baseVelocity = 100;
              pushP2Log('🚀 P2 XUẤT PHÁT HOÀN HẢO! Nhận ngay MAX SPEED (100)!');
            }
          }
        }
      } else {
        if (goBannerTimerRef.current > 0) {
          goBannerTimerRef.current = Math.max(0, goBannerTimerRef.current - dt);
          if (goBannerTimerRef.current === 0) {
            setGoBannerVisible(false);
          }
        }
        raceTimeRef.current += dt;
        runners.forEach((r) => {
          r.update(dt, runners, currentTrack, raceTimeRef.current, pushRunnerLog);
          if (r.distance >= finishDistance && !winner) {
            winner = r;
          }
        });
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        let c1: { targetZoom: number; targetX: number; targetY: number };

        if (playerCount === 2 && p2) {
          const pos1 = currentTrack.getPositionAt(p1.distance, p1.laneOffset);
          const pos2 = currentTrack.getPositionAt(p2.distance, p2.laneOffset);
          const b = currentTrack.bounds;
          const overviewZoom = Math.min(
            canvas.width / (b.width + 1800),
            canvas.height / (b.height + 1400)
          );

          if (zoomPresetRef.current === 'overview') {
            c1 = {
              targetZoom: overviewZoom,
              targetX: b.minX + b.width / 2,
              targetY: b.minY + b.height / 2,
            };
          } else {
            const maxPresetZoom = zoomPresetRef.current === 'wide' ? 0.44 : 0.86;
            const spanX = Math.abs(pos1.x - pos2.x) + 720;
            const spanY = Math.abs(pos1.y - pos2.y) + 460;
            const fitZoom = Math.min(canvas.width / spanX, canvas.height / spanY);
            c1 = {
              targetZoom: Math.max(overviewZoom, Math.min(maxPresetZoom, fitZoom)),
              targetX: (pos1.x + pos2.x) / 2,
              targetY: (pos1.y + pos2.y) / 2,
            };
          }
        } else {
          c1 = computeCamera(p1, currentTrack, canvas.width, canvas.height);
        }

        if (!camInitializedRef.current) {
          cam1ZoomRef.current = c1.targetZoom;
          cam1XRef.current = c1.targetX;
          cam1YRef.current = c1.targetY;
          camInitializedRef.current = true;
        } else {
          const lerp = Math.min(1, 9 * dt);
          cam1ZoomRef.current += (c1.targetZoom - cam1ZoomRef.current) * lerp;
          cam1XRef.current += (c1.targetX - cam1XRef.current) * lerp;
          cam1YRef.current += (c1.targetY - cam1YRef.current) * lerp;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(cam1ZoomRef.current, cam1ZoomRef.current);
        ctx.translate(-cam1XRef.current, -cam1YRef.current);
        currentTrack.draw(ctx);
        runners.forEach((r) => r.draw(ctx, currentTrack, cam1ZoomRef.current));
        ctx.restore();
      }

      // Draw minimap auto-fitted to track bounds
      const miniCanvas = miniRef.current;
      const miniCtx = miniCanvas?.getContext('2d');
      if (miniCanvas && miniCtx) {
        miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
        const b = currentTrack.bounds;
        const pad = 14;
        const availW = miniCanvas.width - pad * 2;
        const availH = miniCanvas.height - pad * 2;
        const scale = Math.min(availW / b.width, availH / b.height);
        const offsetX = pad + (availW - b.width * scale) / 2 - b.minX * scale;
        const offsetY = pad + (availH - b.height * scale) / 2 - b.minY * scale;

        miniCtx.lineJoin = 'round';
        miniCtx.strokeStyle = '#94a3b8';
        miniCtx.lineWidth = 6;
        miniCtx.beginPath();
        currentTrack.points.forEach((pt, i) =>
          i === 0
            ? miniCtx.moveTo(pt.x * scale + offsetX, pt.y * scale + offsetY)
            : miniCtx.lineTo(pt.x * scale + offsetX, pt.y * scale + offsetY)
        );
        miniCtx.closePath();
        miniCtx.stroke();

        runners.forEach((r) => {
          const pos = currentTrack.getPositionAt(r.distance, r.laneOffset);
          miniCtx.fillStyle =
            r.playerSlot === 1 ? '#fde047' : r.playerSlot === 2 ? '#34d399' : r.color;
          miniCtx.beginPath();
          miniCtx.arc(
            pos.x * scale + offsetX,
            pos.y * scale + offsetY,
            r.isPlayer ? 5.5 : 3.5,
            0,
            Math.PI * 2
          );
          miniCtx.fill();
        });
      }

      const sorted = runners.slice().sort((a, b) => b.distance - a.distance);
      const standings = sorted.map((r, idx) => ({
        rank: idx + 1,
        name: r.name,
        charType: r.charType,
        isPlayer: r.isPlayer,
        playerSlot: r.playerSlot,
        progressPct: Math.min(100, Math.round((r.distance / finishDistance) * 100)),
      }));

      setHud({
        ...buildPlayerHud(
          p1,
          sorted,
          totalLaps,
          currentTrack.totalLength,
          falseStartPenaltyRef.current
        ),
        totalRunners: runners.length,
        raceTime: raceTimeRef.current,
        direction: currentTrack.direction,
        countdownTimer: countdownTimerRef.current,
        p2: p2
          ? buildPlayerHud(
              p2,
              sorted,
              totalLaps,
              currentTrack.totalLength,
              p2FalseStartPenaltyRef.current
            )
          : undefined,
        standings,
      });

      if (winner) {
        finishedRef.current = true;
        const winRunner = winner as StickmanRunner;
        sound.playFinish(winRunner.isPlayer);
        setRaceResult({
          winnerName: winRunner.name,
          winnerSlot: winRunner.playerSlot,
          isPlayerWin: winRunner.isPlayer,
          raceTime: raceTimeRef.current,
          mapName: currentTrack.config.name,
          durationLabel: currentTrack.config.durationLabel,
          direction: currentTrack.direction,
          standings,
        });
        return;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown, true);
      if (logTimerRef.current) window.clearTimeout(logTimerRef.current);
      if (p2LogTimerRef.current) window.clearTimeout(p2LogTimerRef.current);
    };
  }, [mapId, playerCount, myCharType, p2CharType, restartToken]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    refocusContainer();
    if (finishedRef.current) return;

    // In 2P mode, mouse controls P2; in 1P mode, mouse controls P1 only when controlMode === 'mouse'
    const mouseRunner = playerCount === 2 ? player2Ref.current : playerRef.current;
    const mouseSlot: 1 | 2 = playerCount === 2 ? 2 : 1;
    const mouseLog = playerCount === 2 ? pushP2Log : pushLog;

    if (playerCount === 1 && controlMode !== 'mouse') return;
    if (!mouseRunner) return;

    if (e.button === 1 && playerCount === 2) {
      e.preventDefault();
      if (countdownTimerRef.current > 0 || mouseRunner.isFrozen()) return;
      mouseRunner.switchLane(mouseLog);
      return;
    }

    if (e.button !== 0 && e.button !== 2) return;

    if (countdownTimerRef.current > 0) {
      triggerFalseStartPenalty(mouseSlot);
      return;
    }
    if (mouseRunner.isFrozen()) return;
    if (e.button === 0) {
      mouseRunner.handleStride('KeyQ', mouseLog);
    } else if (e.button === 2) {
      mouseRunner.handleStride('KeyE', mouseLog);
    }
  };

  const triggerStride = (key: 'KeyQ' | 'KeyE') => {
    if (finishedRef.current || !playerRef.current) return;
    if (countdownTimerRef.current > 0) {
      triggerFalseStartPenalty(1);
      refocusContainer();
      return;
    }
    playerRef.current.handleStride(key, pushLog);
    refocusContainer();
  };

  const triggerLaneSwitch = () => {
    if (finishedRef.current || !playerRef.current || countdownTimerRef.current > 0) return;
    playerRef.current.switchLane(pushLog);
    refocusContainer();
  };

  const triggerSprint = () => {
    if (finishedRef.current || !playerRef.current || countdownTimerRef.current > 0) return;
    playerRef.current.useSprint(pushLog);
    refocusContainer();
  };

  const triggerAbility = () => {
    if (finishedRef.current || !playerRef.current || countdownTimerRef.current > 0) return;
    playerRef.current.useAbility(pushLog);
    refocusContainer();
  };

  const triggerUltimate = () => {
    if (finishedRef.current || !playerRef.current || countdownTimerRef.current > 0) return;
    playerRef.current.useUltimate(raceTimeRef.current, pushLog);
    refocusContainer();
  };

  const ultReady = hud.raceTime >= ULT_UNLOCK_TIME && !hud.ultUsed;
  const ultCountdown = Math.max(0, ULT_UNLOCK_TIME - hud.raceTime);
  const isActionLocked = hud.falseStartPenalty || hud.falseStartTimer > 0 || hud.stunTimer > 0;
  const isCountdownActive = hud.countdownTimer > 0;

  const renderPlayerHudCard = (
    pHud: PlayerHudState,
    slotLabel: string | null,
    keys: { sprint: string; ability: string; ult: string },
    accentBorder: string
  ) => {
    const pUltReady = hud.raceTime >= ULT_UNLOCK_TIME && !pHud.ultUsed;
    const pUltCd = Math.max(0, ULT_UNLOCK_TIME - hud.raceTime);

    return (
      <div
        className={`grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-slate-900 border ${accentBorder} rounded-xl px-3.5 py-2.5 items-center`}
      >
        {/* Stamina */}
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span className="truncate">
              {slotLabel && (
                <strong
                  className={`mr-1 ${
                    slotLabel === 'P1' ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {slotLabel}
                </strong>
              )}
              Stamina:{' '}
              <strong className="font-mono text-slate-100 tabular-nums">
                {Math.round(pHud.stamina)}%
              </strong>
            </span>
            {pHud.iframeTimer > 0 ? (
              <span className="inline-flex items-center gap-1 text-cyan-300 font-bold">
                <Shield className="w-3 h-3" />
                {pHud.iframeTimer.toFixed(1)}s
              </span>
            ) : pHud.exhausted ? (
              <span className="text-red-400 font-bold">KIỆT SỨC</span>
            ) : null}
          </div>
          <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                pHud.iframeTimer > 0
                  ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : pHud.exhausted
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, pHud.stamina))}%` }}
            />
          </div>
        </div>

        {/* Velocity */}
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>
              Vận tốc:{' '}
              <strong className="font-mono text-slate-100 tabular-nums">
                {pHud.effectiveVel}
              </strong>
            </span>
            {pHud.bonusPct > 0 ? (
              <span className="text-amber-400 font-bold">+{pHud.bonusPct}%</span>
            ) : (
              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                Gốc {pHud.baseVel}
              </span>
            )}
          </div>
          <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
            <div
              className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-white/90 z-10"
              title="Ngưỡng vận tốc gốc hao Stamina (80)"
            />
            <div
              className={`h-full transition-all duration-75 ${
                pHud.iframeTimer > 0 && pHud.baseVel > STAMINA_THRESHOLD
                  ? 'bg-cyan-400'
                  : pHud.baseVel > STAMINA_THRESHOLD
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, pHud.baseVel)}%` }}
            />
          </div>
        </div>

        {/* Lap & Rank & Lane */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400">Vòng · Hạng · Làn</div>
          <div className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
            {pHud.currentLap}/{pHud.totalLaps} · #{pHud.rank} · L{pHud.laneNumber}
          </div>
        </div>

        {/* Spurt */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400">
            Bứt tốc [{keys.sprint}] ({pHud.spurtsLeft}/2)
          </div>
          <div
            className={`font-mono text-xs font-bold tabular-nums mt-1 ${
              pHud.spurtBurstTimer > 0
                ? 'text-amber-300'
                : pHud.spurtSustainTimer > 0
                ? 'text-amber-400'
                : pHud.spurtsLeft <= 0
                ? 'text-slate-500'
                : pHud.sprintCooldown > 0
                ? 'text-slate-400'
                : pHud.iframeTimer > 0 || pHud.activeRegenTimer > 0
                ? 'text-cyan-300'
                : pHud.stamina >= 25
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {pHud.spurtBurstTimer > 0
              ? `BÙNG NỔ (${pHud.spurtBurstTimer.toFixed(1)}s)`
              : pHud.spurtSustainTimer > 0
              ? `DUY TRÌ (${pHud.spurtSustainTimer.toFixed(1)}s)`
              : pHud.spurtsLeft <= 0
              ? 'Hết lượt (0/2)'
              : pHud.sprintCooldown > 0
              ? `Hồi ${pHud.sprintCooldown.toFixed(1)}s`
              : pHud.iframeTimer > 0 || pHud.activeRegenTimer > 0
              ? `Miễn phí [${keys.sprint}]!`
              : 'Sẵn sàng (-25%)'}
          </div>
        </div>

        {/* Ability */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400">
            Ability [{keys.ability}]
            {pHud.charType === 'red' && pHud.redMarkedTargets > 0 ? (
              <span className="ml-1 text-rose-300">· Ấn {pHud.redMarkedTargets}</span>
            ) : null}
          </div>
          <div
            className={`text-xs font-bold mt-1 ${
              pHud.silenceTimer > 0
                ? 'text-rose-400'
                : !pHud.abilityUsed
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {pHud.silenceTimer > 0
              ? `SILENCE (${pHud.silenceTimer.toFixed(1)}s)`
              : !pHud.abilityUsed
              ? `Sẵn sàng [${keys.ability}]`
              : 'Đã dùng'}
          </div>
        </div>

        {/* Ultimate */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400">
            Ultimate [{keys.ult}]
            {pHud.heavyTimer > 0 ? (
              <span className="ml-1 text-rose-400 font-mono">
                HEAVY≤{pHud.heavySpeedCap}
              </span>
            ) : null}
          </div>
          <div
            className={`text-xs font-bold font-mono tabular-nums mt-1 ${
              pHud.silenceTimer > 0
                ? 'text-rose-400'
                : pHud.ultUsed
                ? 'text-slate-500'
                : pUltReady
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {pHud.silenceTimer > 0
              ? `SILENCE (${pHud.silenceTimer.toFixed(1)}s)`
              : pHud.ultUsed
              ? 'Đã dùng'
              : pUltReady
              ? `SẴN SÀNG [${keys.ult}]`
              : `Sau ${pUltCd.toFixed(1)}s`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="w-full max-w-[1060px] mx-auto flex flex-col gap-2.5 outline-none"
    >
      {/* Top Action & Race Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={onReturnToHub}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sảnh chờ</span>
          </button>
          <span className="font-display font-bold text-white">{mapCfg.name}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-400">
            {CATEGORY_LABELS[mapCfg.category]} ({mapCfg.durationLabel})
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-semibold text-amber-300">
            {DIRECTION_LABELS[hud.direction]}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs text-slate-200 tabular-nums font-semibold">
            {formatTime(hud.raceTime)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Control Mode Option Toggle (1P only; 2P uses fixed P1 Q/E + P2 Mouse L/R) */}
          {playerCount === 1 ? (
            <div
              role="group"
              aria-label="Chế độ điều khiển tăng tốc"
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeControlMode('keyboard');
                  refocusContainer();
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  controlMode === 'keyboard'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Phím Q/E</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeControlMode('mouse');
                  refocusContainer();
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  controlMode === 'mouse'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mouse className="w-3.5 h-3.5" />
                <span>Chuột L/R</span>
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold">
              2 Người chơi (Chung màn hình)
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              cycleZoom();
              refocusContainer();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
            <span>Zoom [O]: {ZOOM_LABELS[zoomPreset]}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
              refocusContainer();
            }}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{muted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>
        </div>
      </div>

      {/* Primary HUD Strip(s) */}
      {playerCount === 1 ? (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 items-center">
          {/* Stamina */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>
                Stamina:{' '}
                <strong className="font-mono text-slate-100 tabular-nums">
                  {Math.round(hud.stamina)}%
                </strong>
              </span>
              {hud.iframeTimer > 0 ? (
                <span className="inline-flex items-center gap-1 text-cyan-300 font-bold">
                  <Shield className="w-3 h-3" />
                  {hud.iframeTimer.toFixed(1)}s
                </span>
              ) : hud.exhausted ? (
                <span className="text-red-400 font-bold">KIỆT SỨC</span>
              ) : null}
            </div>
            <div className="relative w-full h-3.5 bg-slate-950 rounded-full overflow-hidden mt-1.5 border border-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.iframeTimer > 0
                    ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]'
                    : hud.exhausted
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
              />
            </div>
          </div>

          {/* Velocity */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>
                Vận tốc:{' '}
                <strong className="font-mono text-slate-100 tabular-nums">
                  {hud.effectiveVel}
                </strong>
              </span>
              {hud.bonusPct > 0 ? (
                <span className="text-amber-400 font-bold">+{hud.bonusPct}%</span>
              ) : (
                <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                  Gốc {hud.baseVel}
                </span>
              )}
            </div>
            <div className="relative w-full h-3.5 bg-slate-950 rounded-full overflow-hidden mt-1.5 border border-slate-800">
              <div
                className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-white/90 z-10"
                title="Ngưỡng vận tốc gốc hao Stamina (80)"
              />
              <div
                className={`h-full transition-all duration-75 ${
                  hud.iframeTimer > 0 && hud.baseVel > STAMINA_THRESHOLD
                    ? 'bg-cyan-400'
                    : hud.baseVel > STAMINA_THRESHOLD
                    ? 'bg-rose-500'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, hud.baseVel)}%` }}
              />
            </div>
          </div>

          {/* Lap & Rank & Lane */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Vòng · Hạng · Làn</div>
            <div className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
              {hud.currentLap}/{hud.totalLaps} · #{hud.rank} · L{hud.laneNumber}
            </div>
          </div>

          {/* Spurt [R] */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400">
              Bứt tốc [R] ({hud.spurtsLeft}/2)
            </div>
            <div
              className={`font-mono text-xs font-bold tabular-nums mt-1 ${
                hud.spurtBurstTimer > 0
                  ? 'text-amber-300'
                  : hud.spurtSustainTimer > 0
                  ? 'text-amber-400'
                  : hud.spurtsLeft <= 0
                  ? 'text-slate-500'
                  : hud.sprintCooldown > 0
                  ? 'text-slate-400'
                  : hud.iframeTimer > 0 || hud.activeRegenTimer > 0
                  ? 'text-cyan-300'
                  : hud.stamina >= 25
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {hud.spurtBurstTimer > 0
                ? `BÙNG NỔ (${hud.spurtBurstTimer.toFixed(1)}s)`
                : hud.spurtSustainTimer > 0
                ? `DUY TRÌ (${hud.spurtSustainTimer.toFixed(1)}s)`
                : hud.spurtsLeft <= 0
                ? 'Hết lượt (0/2)'
                : hud.sprintCooldown > 0
                ? `Hồi ${hud.sprintCooldown.toFixed(1)}s`
                : hud.iframeTimer > 0 || hud.activeRegenTimer > 0
                ? 'Miễn phí [R]!'
                : 'Sẵn sàng (-25%)'}
            </div>
          </div>

          {/* Ability [F] */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Ability [F]</div>
            <div
              className={`text-xs font-bold mt-1 ${
                hud.silenceTimer > 0
                  ? 'text-rose-400'
                  : !hud.abilityUsed
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              {hud.silenceTimer > 0
                ? `SILENCE (${hud.silenceTimer.toFixed(1)}s)`
                : !hud.abilityUsed
                ? 'Sẵn sàng [F]'
                : 'Đã dùng'}
            </div>
          </div>

          {/* Ultimate [G] */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Ultimate [G]</div>
            <div
              className={`text-xs font-bold font-mono tabular-nums mt-1 ${
                hud.silenceTimer > 0
                  ? 'text-rose-400'
                  : hud.ultUsed
                  ? 'text-slate-500'
                  : ultReady
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {hud.silenceTimer > 0
                ? `SILENCE (${hud.silenceTimer.toFixed(1)}s)`
                : hud.ultUsed
                ? 'Đã dùng'
                : ultReady
                ? 'SẴN SÀNG [G]'
                : `Sau ${ultCountdown.toFixed(1)}s`}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {renderPlayerHudCard(
            hud,
            'P1',
            { sprint: 'R', ability: 'F', ult: 'G' },
            'border-amber-500/50'
          )}
          {hud.p2 &&
            renderPlayerHudCard(
              hud.p2,
              'P2',
              { sprint: 'L', ability: 'N', ult: 'M' },
              'border-emerald-500/50'
            )}
        </div>
      )}

      {/* Main Race Canvas + Minimap + Event Toast + Result Modal */}
      <div
        onMouseDown={handleCanvasMouseDown}
        onContextMenu={(e) => e.preventDefault()}
        className="relative w-full aspect-[1020/480] rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-2xl select-none"
      >
        <canvas
          ref={canvasRef}
          width={1020}
          height={480}
          className={`block w-full h-full ${
            playerCount === 2 || controlMode === 'mouse' ? 'cursor-pointer' : 'cursor-default'
          }`}
        />

        {/* Mouse mode click hint (1P only) */}
        {playerCount === 1 && controlMode === 'mouse' && !raceResult && (
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-md bg-slate-950/80 border border-slate-700 text-[11px] text-slate-200 pointer-events-none">
            Nhấn luân phiên <strong className="text-sky-400">Chuột Trái</strong> /{' '}
            <strong className="text-sky-400">Chuột Phải</strong> trên đường đua để tăng tốc
          </div>
        )}

        {/* Pre-race 3s Countdown & False Start Penalty Overlay */}
        {isCountdownActive && !raceResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="px-8 py-5 rounded-2xl bg-slate-950/85 border-2 border-slate-700 text-center shadow-2xl">
              <div className="font-display text-6xl font-black text-amber-400 tabular-nums leading-none">
                {Math.ceil(hud.countdownTimer)}
              </div>
              {playerCount === 2 ? (
                <div className="mt-2.5 space-y-1 text-xs sm:text-sm font-semibold text-slate-200">
                  <div>
                    Chờ hiệu lệnh để nhận{' '}
                    <span className="text-emerald-400 font-bold">MAX SPEED (100)</span>!
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                    <span className={hud.falseStartPenalty ? 'text-rose-400 font-bold' : 'text-amber-300'}>
                      {hud.falseStartPenalty ? '⛔ P1 PHẠT LỖI (1.25s)' : 'P1: Chờ Q/E'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span
                      className={
                        hud.p2?.falseStartPenalty ? 'text-rose-400 font-bold' : 'text-emerald-300'
                      }
                    >
                      {hud.p2?.falseStartPenalty
                        ? '⛔ P2 PHẠT LỖI (1.25s)'
                        : 'P2: Chờ Chuột L/R'}
                    </span>
                  </div>
                </div>
              ) : hud.falseStartPenalty ? (
                <div className="mt-2.5 px-3 py-1 rounded-lg bg-rose-950 border border-rose-500 text-rose-300 text-xs sm:text-sm font-extrabold">
                  XUẤT PHÁT LỖI! Đứng hình {FALSE_START_FREEZE_SEC.toFixed(2)}s khi xuất phát (khóa mọi thao tác)
                </div>
              ) : (
                <div className="mt-2 text-xs sm:text-sm font-semibold text-slate-200">
                  Chờ hiệu lệnh để nhận <span className="text-emerald-400 font-bold">MAX SPEED (100)</span> · Không spam{' '}
                  <span className="text-amber-300">
                    {controlMode === 'mouse' ? 'Chuột Trái/Phải' : 'Q/E'}
                  </span>{' '}
                  sớm!
                </div>
              )}
            </div>
          </div>
        )}

        {!isCountdownActive &&
          (hud.falseStartTimer > 0 || (playerCount === 2 && hud.p2 && hud.p2.falseStartTimer > 0)) &&
          !raceResult && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none z-10">
              {hud.falseStartTimer > 0 && (
                <div className="px-4 py-1.5 rounded-xl bg-rose-950/95 border-2 border-rose-500 text-rose-200 text-xs sm:text-sm font-extrabold shadow-xl whitespace-nowrap">
                  ⛔ {playerCount === 2 ? 'P1 ' : ''}ĐỨNG HÌNH XUẤT PHÁT LỖI ·{' '}
                  {hud.falseStartTimer.toFixed(2)}s
                </div>
              )}
              {playerCount === 2 && hud.p2 && hud.p2.falseStartTimer > 0 && (
                <div className="px-4 py-1.5 rounded-xl bg-rose-950/95 border-2 border-rose-500 text-rose-200 text-xs sm:text-sm font-extrabold shadow-xl whitespace-nowrap">
                  ⛔ P2 ĐỨNG HÌNH XUẤT PHÁT LỖI · {hud.p2.falseStartTimer.toFixed(2)}s
                </div>
              )}
            </div>
          )}

        {!isCountdownActive &&
          hud.falseStartTimer <= 0 &&
          (!hud.p2 || hud.p2.falseStartTimer <= 0) &&
          goBannerVisible &&
          !raceResult && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 px-6 py-2 rounded-xl bg-emerald-600/95 border-2 border-emerald-300 text-white font-display text-2xl font-black tracking-wide shadow-xl pointer-events-none z-10">
              XUẤT PHÁT · MAX SPEED!
            </div>
          )}

        {/* Event Log Toasts */}
        {(eventLog || (playerCount === 2 && p2EventLog)) && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-10">
            {eventLog && (
              <div className="px-4 py-1 rounded-lg bg-slate-950/90 border border-slate-700 text-xs font-semibold text-amber-300 shadow-lg whitespace-nowrap">
                {eventLog}
              </div>
            )}
            {playerCount === 2 && p2EventLog && (
              <div className="px-4 py-1 rounded-lg bg-slate-950/90 border border-emerald-600/60 text-xs font-semibold text-emerald-300 shadow-lg whitespace-nowrap">
                {p2EventLog}
              </div>
            )}
          </div>
        )}

        {/* Minimap */}
        <canvas
          ref={miniRef}
          width={196}
          height={108}
          className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-600 rounded-lg shadow-lg pointer-events-none"
        />

        {/* Result Modal */}
        {raceResult && (
          <div
            role="dialog"
            aria-label="Kết quả cuộc đua"
            className="absolute inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-20"
          >
            <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
              <h2
                className={`font-display text-2xl font-extrabold ${
                  raceResult.winnerSlot === 2
                    ? 'text-emerald-400'
                    : raceResult.isPlayerWin
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {playerCount === 2
                  ? raceResult.winnerSlot === 1
                    ? 'NGƯỜI CHƠI 1 (P1) CHIẾN THẮNG!'
                    : raceResult.winnerSlot === 2
                    ? 'NGƯỜI CHƠI 2 (P2) CHIẾN THẮNG!'
                    : `${raceResult.winnerName.toUpperCase()} VỀ ĐÍCH TRƯỚC!`
                  : raceResult.isPlayerWin
                  ? 'CHIẾN THẮNG CHUNG CUỘC!'
                  : `${raceResult.winnerName.toUpperCase()} VỀ ĐÍCH TRƯỚC!`}
              </h2>
              <p className="text-sm text-slate-300 mt-1.5">
                {raceResult.mapName} ({raceResult.durationLabel} · {DIRECTION_LABELS[raceResult.direction]}) ·{' '}
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatTime(raceResult.raceTime)}
                </span>
              </p>

              <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 text-left">
                {raceResult.standings.map((row) => (
                  <div
                    key={row.name}
                    className={`flex items-center justify-between px-3.5 py-2 text-xs ${
                      row.playerSlot === 1
                        ? 'bg-sky-950/50 font-bold text-amber-300'
                        : row.playerSlot === 2
                        ? 'bg-emerald-950/50 font-bold text-emerald-300'
                        : 'bg-slate-950/50 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-slate-400 w-5">#{row.rank}</span>
                      <span>{row.name}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400">
                      {row.progressPct}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRestartToken((t) => t + 1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-300"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Đua lại</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại sảnh chờ</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Rhythm & Skill Controls (1P interactive bar, or 2P compact control legend) */}
      {playerCount === 1 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 mr-1">
                {controlMode === 'mouse' ? 'Nhịp chuột:' : 'Nhịp chạy:'}
              </span>
              <button
                type="button"
                disabled={isActionLocked}
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerStride('KeyQ');
                }}
                className={`px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs sm:text-sm border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
                  hud.nextExpectedKey === 'KeyQ'
                    ? 'bg-sky-400 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {controlMode === 'mouse' ? 'Chuột Trái' : 'Q'}
              </button>
              <button
                type="button"
                disabled={isActionLocked}
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerStride('KeyE');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isActionLocked) triggerStride('KeyE');
                }}
                className={`px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs sm:text-sm border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
                  hud.nextExpectedKey === 'KeyE'
                    ? 'bg-sky-400 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {controlMode === 'mouse' ? 'Chuột Phải' : 'E'}
              </button>

              <button
                type="button"
                disabled={isCountdownActive || isActionLocked}
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerLaneSwitch();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>
                  Đổi làn [T] ({hud.laneNumber}/{hud.totalLanes})
                </span>
              </button>

              <span className="text-slate-700 mx-0.5" aria-hidden="true">
                |
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerSprint();
                }}
                disabled={
                  isCountdownActive ||
                  isActionLocked ||
                  hud.spurtsLeft <= 0 ||
                  hud.sprintCooldown > 0 ||
                  hud.spurtBurstTimer > 0 ||
                  hud.spurtSustainTimer > 0 ||
                  (hud.iframeTimer <= 0 && hud.activeRegenTimer <= 0 && hud.stamina < 25)
                }
                className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tabular-nums bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.spurtsLeft <= 0
                  ? 'Bứt tốc [R] (0/2)'
                  : hud.sprintCooldown > 0
                  ? `Bứt tốc [R] (${hud.sprintCooldown.toFixed(0)}s · ${hud.spurtsLeft}/2)`
                  : hud.iframeTimer > 0 || hud.activeRegenTimer > 0
                  ? `Bứt tốc [R] (${hud.spurtsLeft}/2 · Free)`
                  : `Bứt tốc [R] (${hud.spurtsLeft}/2 · -25%)`}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerAbility();
                }}
                disabled={isCountdownActive || isActionLocked || hud.abilityUsed || hud.silenceTimer > 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ability [F]
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  triggerUltimate();
                }}
                disabled={isCountdownActive || isActionLocked || !ultReady || hud.silenceTimer > 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ultimate [G]
              </button>
            </div>

            {/* Active Buff / Debuff Tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {hud.spurtBurstTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-950 border border-amber-500 text-amber-300 font-mono tabular-nums">
                  Bùng nổ +200% ({hud.spurtBurstTimer.toFixed(1)}s)
                </span>
              )}
              {hud.spurtBurstTimer <= 0 && hud.spurtSustainTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-950 border border-amber-700 text-amber-300 font-mono tabular-nums">
                  Duy trì +100% ({hud.spurtSustainTimer.toFixed(1)}s)
                </span>
              )}
              {hud.activeRegenTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono tabular-nums">
                  +Hồi sức {hud.activeRegenTimer.toFixed(1)}s
                </span>
              )}
              {hud.bonusPct > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-950 border border-amber-700 text-amber-300 font-mono tabular-nums">
                  +{hud.bonusPct}% Speed
                </span>
              )}
              {hud.redChargeTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-red-950 border border-red-700 text-red-300 font-mono tabular-nums">
                  Càn lướt ({hud.redHitCount}/2)
                </span>
              )}
              {myCharType === 'red' && hud.redMarkedTargets > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-950 border border-rose-500 text-rose-200 font-mono tabular-nums">
                  Ấn ký [G]: {hud.redMarkedTargets} mục tiêu
                </span>
              )}
              {hud.heavyTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-950 border border-rose-700 text-rose-300 font-mono tabular-nums">
                  HEAVY ≤{hud.heavySpeedCap} ({hud.heavyTimer.toFixed(1)}s)
                </span>
              )}
              {hud.falseStartTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-950 border border-rose-500 text-rose-300 font-mono tabular-nums">
                  ĐỨNG HÌNH {hud.falseStartTimer.toFixed(2)}s
                </span>
              )}
              {hud.stunTimer > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-950 border border-rose-700 text-rose-300 font-mono tabular-nums">
                  CHOÁNG {hud.stunTimer.toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {/* In-game Detailed Ability / Ultimate / Spurt Reference (1P) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] leading-relaxed text-slate-300">
            <div>
              <span className="font-bold text-amber-400">Bứt tốc [R]</span>
              <span className="text-slate-500 mx-1">·</span>
              <span>
                <strong className="text-white">+200%</strong> Speed (1s) →{' '}
                <strong className="text-white">+100%</strong> (5s). Tốn 25% Stamina (miễn phí khi có
                I-frames / Hồi sức). Tối đa <strong className="text-white">2 lần/Lap</strong>, hồi
                10s giữa mỗi lần &amp; làm mới mỗi Lap.
              </span>
            </div>

            <div>
              <span
                className={`font-bold ${myCharType === 'blue' ? 'text-sky-400' : 'text-red-400'}`}
              >
                Ability [F] ({myCharType === 'blue' ? 'Xanh Biển' : 'Đỏ'})
              </span>
              <span className="text-slate-500 mx-1">·</span>
              {myCharType === 'blue' ? (
                <span>
                  Hồi Stamina <strong className="text-white">1s</strong>,{' '}
                  <strong className="text-cyan-300">I-frames 2s</strong>,{' '}
                  <strong className="text-white">+30% Speed (4s)</strong>. Làm mới mỗi Lap.
                </span>
              ) : (
                <span>
                  Hồi <strong className="text-white">0.5s</strong>,{' '}
                  <strong className="text-cyan-300">I-frames 1s</strong>,{' '}
                  <strong className="text-white">+15% Speed (4s)</strong>. Đâm đối thủ{' '}
                  <strong className="text-white">cùng làn</strong> gây Choáng 1s &amp; cộng tối đa
                  2 lần (+2s I-frames, +15% Speed 2s).
                </span>
              )}
            </div>

            <div>
              <span
                className={`font-bold ${myCharType === 'blue' ? 'text-sky-400' : 'text-red-400'}`}
              >
                Ultimate [G] (Mở sau 12s)
              </span>
              <span className="text-slate-500 mx-1">·</span>
              {myCharType === 'blue' ? (
                <span>
                  Hồi Stamina <strong className="text-white">2s</strong>,{' '}
                  <strong className="text-cyan-300">I-frames 4s</strong>,{' '}
                  <strong className="text-white">+50% Speed (4s)</strong>. Làm mới mỗi Lap.
                </span>
              ) : (
                <span>
                  Hồi <strong className="text-white">1s</strong>,{' '}
                  <strong className="text-cyan-300">I-frames 2s</strong>,{' '}
                  <strong className="text-white">+30% Speed (4s)</strong>. Ám{' '}
                  <strong className="text-rose-300">Heavy</strong> (khóa trần tốc, spam để giữ)
                  &amp; <strong className="text-rose-300">Silence</strong> (3s) lên mục tiêu đã
                  húc + cộng siêu buff.
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] leading-relaxed text-slate-300">
          <div>
            <span className="font-bold text-amber-300">
              P1 ({myCharType === 'blue' ? 'Xanh Biển' : 'Đỏ'})
            </span>
            <span className="text-slate-500 mx-1.5">·</span>
            <span>
              Tăng tốc <strong className="text-white">Q / E</strong> · Ability{' '}
              <strong className="text-white">F</strong> · Ultimate{' '}
              <strong className="text-white">G</strong> · Bứt tốc{' '}
              <strong className="text-white">R</strong> (2 lần/Lap) · Đổi làn{' '}
              <strong className="text-white">T</strong>
            </span>
          </div>
          <div>
            <span className="font-bold text-emerald-300">
              P2 ({p2CharType === 'blue' ? 'Xanh Biển' : 'Đỏ'})
            </span>
            <span className="text-slate-500 mx-1.5">·</span>
            <span>
              Tăng tốc <strong className="text-white">Chuột Trái / Phải</strong> · Ability{' '}
              <strong className="text-white">N</strong> · Ultimate{' '}
              <strong className="text-white">M</strong> · Bứt tốc{' '}
              <strong className="text-white">L</strong> (2 lần/Lap) · Đổi làn{' '}
              <strong className="text-white">K</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
