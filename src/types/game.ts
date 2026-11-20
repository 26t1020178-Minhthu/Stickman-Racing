export const SPEED_MULTIPLIER = 6.2;
export const ULT_UNLOCK_TIME = 12.0;
export const STAMINA_THRESHOLD = 80;
export const RACE_COUNTDOWN_SEC = 3.0;
export const FALSE_START_FREEZE_SEC = 1.25;
export const LANE_OFFSETS = [-69, -23, 23, 69] as const;

export type CharType = 'blue' | 'red';
export type PlayerCount = 1 | 2;
export type MapId = 'oanquan' | 'ngoisao' | 'dongho' | 'kinhthanhhue';
export type TrackLengthCategory = 'sprint' | 'mile' | 'medium' | 'long';
export type TrackDirection = 'cw' | 'ccw';
export type GameScreen = 'HUB' | 'PLAYING' | 'FINISHED';
export type ControlMode = 'keyboard' | 'mouse';
export type ZoomPreset = 'normal' | 'wide' | 'overview';

export interface Point2D {
  x: number;
  y: number;
}

export interface TrackBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TrackPosition {
  x: number;
  y: number;
  angle: number;
}

export interface MapConfig {
  id: MapId;
  name: string;
  subtitle: string;
  category: TrackLengthCategory;
  laps: number;
  durationLabel: string;
  bgGrass: string;
  trackColor: string;
  trackWidth: number;
  generatePoints: () => Point2D[];
  drawScenery: (ctx: CanvasRenderingContext2D) => void;
}

export interface HubPlayer {
  id: string;
  name: string;
  charType: CharType;
  x: number;
  y: number;
  isMe: boolean;
  playerSlot?: 1 | 2;
  animPhase: number;
  wanderTarget?: Point2D;
  wanderWait?: number;
}

export interface SpeedBuff {
  pct: number;
  timer: number;
}

export interface PlayerHudState {
  charType: CharType;
  stamina: number;
  exhausted: boolean;
  iframeTimer: number;
  baseVel: number;
  effectiveVel: number;
  bonusPct: number;
  currentLap: number;
  totalLaps: number;
  laneNumber: number;
  totalLanes: number;
  rank: number;
  sprintCooldown: number;
  spurtsLeft: number;
  spurtBurstTimer: number;
  spurtSustainTimer: number;
  abilityUsed: boolean;
  ultUsed: boolean;
  activeRegenTimer: number;
  redChargeTimer: number;
  redHitCount: number;
  redMarkedTargets: number;
  heavyTimer: number;
  heavySpeedCap: number;
  silenceTimer: number;
  stunTimer: number;
  falseStartPenalty: boolean;
  falseStartTimer: number;
  nextExpectedKey: 'KeyQ' | 'KeyE';
}

export interface HudSnapshot extends PlayerHudState {
  totalRunners: number;
  raceTime: number;
  direction: TrackDirection;
  countdownTimer: number;
  p2?: PlayerHudState;
  standings: Array<{
    name: string;
    charType: CharType;
    isPlayer: boolean;
    playerSlot: 0 | 1 | 2;
    progressPct: number;
    rank: number;
  }>;
}

export interface RaceResult {
  winnerName: string;
  winnerSlot: 0 | 1 | 2;
  isPlayerWin: boolean;
  raceTime: number;
  mapName: string;
  durationLabel: string;
  direction: TrackDirection;
  standings: Array<{
    rank: number;
    name: string;
    charType: CharType;
    isPlayer: boolean;
    playerSlot: 0 | 1 | 2;
    progressPct: number;
  }>;
}
