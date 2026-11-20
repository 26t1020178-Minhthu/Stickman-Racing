import {
  LANE_OFFSETS,
  SPEED_MULTIPLIER,
  STAMINA_THRESHOLD,
  ULT_UNLOCK_TIME,
  type CharType,
  type SpeedBuff,
} from '../types/game';
import { Track } from './maps';
import { sound } from './sound';

export const SPURT_COOLDOWN_SEC = 10.0;
export const SPURT_STAMINA_COST = 25;
export const MAX_SPURTS_PER_LAP = 2;

export class StickmanRunner {
  public name: string;
  public color: string;
  public laneIndex: number;
  public laneOffset: number;
  public targetLaneOffset: number;
  public isPlayer: boolean;
  public playerSlot: 0 | 1 | 2;
  public charType: CharType;

  public distance = 0;
  public baseVelocity = 0;
  public stamina = 100;
  public exhausted = false;
  public animPhase = 0;
  public lastStepKey: 'KeyQ' | 'KeyE' | null = null;

  public completedLaps = 0;
  public spurtsLeft = MAX_SPURTS_PER_LAP;
  public sprintCooldown = 0;
  public spurtBurstTimer = 0;
  public spurtSustainTimer = 0;
  public abilityUsed = false;
  public ultUsed = false;

  public speedBuffs: SpeedBuff[] = [];
  public staminaIframeTimer = 0;
  public activeRegenTimer = 0;

  public redChargeTimer = 0;
  public redHitCount = 0;
  public hitTargets: Set<StickmanRunner> = new Set();

  public stunTimer = 0;
  public falseStartTimer = 0;
  public heavyTimer = 0;
  public heavySpeedCap = 100;
  public silenceTimer = 0;

  private aiLaneCooldown = 9 + Math.random() * 8;

  constructor(
    name: string,
    color: string,
    laneIndex: number,
    isPlayer: boolean,
    charType: CharType,
    playerSlot: 0 | 1 | 2 = isPlayer ? 1 : 0
  ) {
    this.name = name;
    this.color = color;
    this.laneIndex = laneIndex % LANE_OFFSETS.length;
    this.laneOffset = LANE_OFFSETS[this.laneIndex];
    this.targetLaneOffset = this.laneOffset;
    this.isPlayer = isPlayer;
    this.playerSlot = playerSlot;
    this.charType = charType;
  }

  isFrozen(): boolean {
    return this.stunTimer > 0 || this.falseStartTimer > 0;
  }

  switchLane(onLog?: (msg: string) => void) {
    if (this.isFrozen()) return;
    this.laneIndex = (this.laneIndex + 1) % LANE_OFFSETS.length;
    this.targetLaneOffset = LANE_OFFSETS[this.laneIndex];
    if (this.isPlayer) {
      sound.playLaneSwitch();
      if (onLog) onLog(`🛣️ Đổi sang Làn ${this.laneIndex + 1}/${LANE_OFFSETS.length}`);
    }
  }

  setTargetLane(laneIdx: number) {
    if (this.isFrozen()) return;
    this.laneIndex = ((laneIdx % LANE_OFFSETS.length) + LANE_OFFSETS.length) % LANE_OFFSETS.length;
    this.targetLaneOffset = LANE_OFFSETS[this.laneIndex];
  }

  applyHeavy(duration: number) {
    if (this.heavyTimer > 0) {
      this.heavySpeedCap = Math.min(this.heavySpeedCap, this.baseVelocity);
      this.heavyTimer = Math.max(this.heavyTimer, duration);
    } else {
      this.heavySpeedCap = this.baseVelocity;
      this.heavyTimer = duration;
    }
  }

  addIframes(sec: number) {
    this.staminaIframeTimer += sec;
  }

  addActiveRegen(sec: number) {
    this.activeRegenTimer += sec;
  }

  addSpeedBuff(pct: number, duration: number) {
    this.speedBuffs.push({ pct, timer: duration });
  }

  hasSkillStaminaProtection(): boolean {
    return this.staminaIframeTimer > 0 || this.activeRegenTimer > 0;
  }

  getTotalSpeedBonus(): number {
    const buffSum = this.speedBuffs.reduce((sum, b) => sum + b.pct, 0);
    const spurtBonus =
      this.spurtBurstTimer > 0 ? 2.0 : this.spurtSustainTimer > 0 ? 1.0 : 0;
    return buffSum + spurtBonus;
  }

  getEffectiveVelocity(): number {
    if (this.isFrozen()) return 0;
    return this.baseVelocity * (1 + this.getTotalSpeedBonus());
  }

  handleStride(key: 'KeyQ' | 'KeyE', onLog?: (msg: string) => void) {
    if (this.exhausted || this.isFrozen()) return;
    if (this.lastStepKey !== key) {
      this.lastStepKey = key;
      const cap = this.heavyTimer > 0 ? this.heavySpeedCap : 100;
      if (this.baseVelocity < cap) {
        this.baseVelocity = Math.min(cap, this.baseVelocity + 7.8);
      } else if (this.heavyTimer > 0 && this.isPlayer && onLog) {
        onLog(`⛓️ BỊ HEAVY! Trần vận tốc gốc bị khóa ở ${Math.round(cap)}!`);
      }
      if (this.isPlayer) sound.playStride(key === 'KeyQ');
    }
  }

  useSprint(onLog?: (msg: string) => void) {
    if (
      this.spurtsLeft <= 0 ||
      this.sprintCooldown > 0 ||
      this.spurtBurstTimer > 0 ||
      this.spurtSustainTimer > 0 ||
      this.exhausted ||
      this.isFrozen()
    ) {
      if (this.spurtsLeft <= 0 && this.isPlayer && onLog) {
        onLog('⚠️ Đã hết lượt Bứt tốc trong vòng này (2/2)! Qua vòng mới để hồi lại.');
      }
      return;
    }
    if (this.heavyTimer > 0) {
      if (this.isPlayer && onLog) onLog('⛓️ BỊ HEAVY! Không thể dùng Bứt tốc!');
      return;
    }

    const isProtected = this.hasSkillStaminaProtection();
    if (!isProtected) {
      if (this.stamina < SPURT_STAMINA_COST) {
        if (this.isPlayer && onLog) {
          onLog(`⚠️ Cần ít nhất ${SPURT_STAMINA_COST}% Stamina để Bứt tốc!`);
        }
        return;
      }
      this.stamina -= SPURT_STAMINA_COST;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.baseVelocity = 0;
        this.exhausted = true;
        if (this.isPlayer && onLog) onLog('⚠️ KIỆT SỨC! Stamina = 0!');
        return;
      }
    }

    this.spurtsLeft -= 1;
    this.sprintCooldown = SPURT_COOLDOWN_SEC;
    this.spurtBurstTimer = 1.0;
    this.spurtSustainTimer = 5.0;
    if (this.baseVelocity < 60) {
      this.baseVelocity = 60;
    }

    if (this.isPlayer) {
      sound.playSprint();
      if (onLog) {
        onLog(
          isProtected
            ? `🔥 BỨT TỐC MIỄN PHÍ (${this.spurtsLeft}/${MAX_SPURTS_PER_LAP})! +200% Speed (1s) → +100% (5s)!`
            : `🔥 BỨT TỐC (-25% Stamina, còn ${this.spurtsLeft}/${MAX_SPURTS_PER_LAP})! +200% Speed (1s) → +100% (5s)!`
        );
      }
    }
  }

  useAbility(onLog?: (msg: string) => void) {
    if (this.abilityUsed || this.exhausted || this.isFrozen()) return;
    if (this.silenceTimer > 0) {
      if (this.isPlayer && onLog) onLog('🔇 BỊ SILENCE! Không thể dùng Ability!');
      return;
    }
    this.abilityUsed = true;
    if (this.isPlayer) sound.playSkill(false);

    if (this.charType === 'blue') {
      this.addActiveRegen(1.0);
      this.addIframes(2.0);
      this.addSpeedBuff(0.3, 4.0);
      if (this.isPlayer && onLog) {
        onLog('🔵 ABILITY: +1s Hồi Stamina | +2s I-frames | +30% Speed (4s)!');
      }
    } else if (this.charType === 'red') {
      this.addActiveRegen(0.5);
      this.addIframes(1.0);
      this.addSpeedBuff(0.15, 4.0);
      this.redChargeTimer = 4.0;
      this.redHitCount = 0;
      this.hitTargets.clear();
      if (this.isPlayer && onLog) {
        onLog('🔴 ABILITY: Càn lướt 4s! Đâm đối thủ CÙNG LÀN để húc choáng 1s & cộng dồn buff!');
      }
    }
  }

  useUltimate(raceTime: number, onLog?: (msg: string) => void) {
    if (raceTime < ULT_UNLOCK_TIME || this.ultUsed || this.exhausted || this.isFrozen()) return;
    if (this.silenceTimer > 0) {
      if (this.isPlayer && onLog) onLog('🔇 BỊ SILENCE! Không thể dùng Ultimate!');
      return;
    }
    this.ultUsed = true;
    if (this.isPlayer) sound.playSkill(true);

    if (this.charType === 'blue') {
      this.addActiveRegen(2.0);
      this.addIframes(4.0);
      this.addSpeedBuff(0.5, 4.0);
      if (this.isPlayer && onLog) {
        onLog('🔵 ULTIMATE: +2s Hồi Stamina | +4s I-frames | +50% Speed (4s)!');
      }
    } else if (this.charType === 'red') {
      this.addActiveRegen(1.0);
      this.addIframes(2.0);
      this.addSpeedBuff(0.3, 4.0);
      let debuffedCount = 0;
      this.hitTargets.forEach((target) => {
        target.applyHeavy(3.0);
        target.silenceTimer = 3.0;
        debuffedCount++;
        this.addActiveRegen(0.5);
        this.addIframes(2.0);
        this.addSpeedBuff(0.2, 2.0);
      });
      if (this.isPlayer && onLog) {
        onLog(
          debuffedCount > 0
            ? `🔴 ULTIMATE: Ám Heavy & Silence (3s) lên ${debuffedCount} mục tiêu! Cộng dồn siêu buff!`
            : '🔴 ULTIMATE: +1s Stamina, +2s I-frames, +30% Speed!'
        );
      }
    }
  }

  update(
    dt: number,
    runners: StickmanRunner[],
    track: Track,
    raceTime: number,
    onLog?: (msg: string, runner?: StickmanRunner) => void
  ) {
    if (this.sprintCooldown > 0) this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);

    if (this.spurtBurstTimer > 0) {
      const overflow = Math.max(0, dt - this.spurtBurstTimer);
      this.spurtBurstTimer = Math.max(0, this.spurtBurstTimer - dt);
      if (overflow > 0 && this.spurtSustainTimer > 0) {
        this.spurtSustainTimer = Math.max(0, this.spurtSustainTimer - overflow);
      }
    } else if (this.spurtSustainTimer > 0) {
      this.spurtSustainTimer = Math.max(0, this.spurtSustainTimer - dt);
    }

    if (this.staminaIframeTimer > 0) this.staminaIframeTimer = Math.max(0, this.staminaIframeTimer - dt);
    if (this.activeRegenTimer > 0) this.activeRegenTimer = Math.max(0, this.activeRegenTimer - dt);
    if (this.redChargeTimer > 0) this.redChargeTimer = Math.max(0, this.redChargeTimer - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.falseStartTimer > 0) this.falseStartTimer = Math.max(0, this.falseStartTimer - dt);
    if (this.heavyTimer > 0) {
      this.heavyTimer = Math.max(0, this.heavyTimer - dt);
      if (this.heavyTimer === 0) this.heavySpeedCap = 100;
    }
    if (this.silenceTimer > 0) this.silenceTimer = Math.max(0, this.silenceTimer - dt);

    // Smooth lane transition
    if (this.laneOffset !== this.targetLaneOffset) {
      const diff = this.targetLaneOffset - this.laneOffset;
      const step = 360 * dt;
      if (Math.abs(diff) <= step) {
        this.laneOffset = this.targetLaneOffset;
      } else {
        this.laneOffset += Math.sign(diff) * step;
      }
    }

    for (let i = this.speedBuffs.length - 1; i >= 0; i--) {
      this.speedBuffs[i].timer -= dt;
      if (this.speedBuffs[i].timer <= 0) this.speedBuffs.splice(i, 1);
    }

    // Red Charge collision: requires BOTH longitudinal proximity (<= 55) AND SAME LANE (|laneOffset - other.laneOffset| <= 22)
    if (this.charType === 'red' && this.redChargeTimer > 0) {
      runners.forEach((other) => {
        if (other !== this && !this.hitTargets.has(other)) {
          const sameLane = Math.abs(this.laneOffset - other.laneOffset) <= 22;
          const closeDist = Math.abs(this.distance - other.distance) <= 55;
          if (sameLane && closeDist) {
            this.hitTargets.add(other);
            other.stunTimer = 1.0;
            if (this.redHitCount < 2) {
              this.redHitCount++;
              this.addIframes(2.0);
              this.addSpeedBuff(0.15, 2.0);
            }
            if (this.isPlayer) {
              sound.playHit();
              if (onLog) {
                onLog(
                  `💥 HÚC TRÚNG ${other.name.toUpperCase()} CÙNG LÀN! Choáng 1s | Cộng dồn buff (${this.redHitCount}/2)!`,
                  this
                );
              }
            }
            if (other.isPlayer) {
              if (!this.isPlayer) sound.playHit();
              if (onLog) {
                onLog(`💥 Bị ${this.name} húc choáng 1s!`, other);
              }
            }
          }
        }
      });
    }

    if (!this.isPlayer) this.updateAI(dt, runners, track, raceTime);

    if (this.isFrozen()) this.baseVelocity = 0;
    else this.baseVelocity = Math.max(0, this.baseVelocity - 24 * dt);

    // Active regen from Ability / Ultimate / Zone
    if (this.activeRegenTimer > 0) {
      this.stamina = Math.min(100, this.stamina + 28 * dt);
      if (this.exhausted && this.stamina >= 30) this.exhausted = false;
    }

    // Stamina drain depends ONLY on baseVelocity (buffed speed from Ability/Zone/Spurt does NOT increase drain)
    const isProtected = this.hasSkillStaminaProtection();
    if (this.baseVelocity > STAMINA_THRESHOLD) {
      if (!isProtected) {
        const overSpeed = this.baseVelocity - STAMINA_THRESHOLD;
        const drainRate = 2.5 + Math.pow(overSpeed, 1.42) * 0.32;
        this.stamina -= drainRate * dt;
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.baseVelocity = 0;
          this.exhausted = true;
          if (this.isPlayer && onLog) onLog('⚠️ KIỆT SỨC! Stamina = 0, vận tốc về 0!', this);
        }
      }
    } else if (this.baseVelocity < STAMINA_THRESHOLD) {
      const slowRatio = (STAMINA_THRESHOLD - this.baseVelocity) / STAMINA_THRESHOLD;
      const regenRate = 2 + Math.pow(slowRatio, 1.3) * 22;
      this.stamina = Math.min(100, this.stamina + regenRate * dt);
      if (this.exhausted && this.stamina >= 30) this.exhausted = false;
    }

    const effectiveVel = this.getEffectiveVelocity();
    this.distance += effectiveVel * SPEED_MULTIPLIER * dt;
    if (effectiveVel > 5) this.animPhase += Math.min(180, effectiveVel) * 0.22 * dt;

    // Reset Spurt charges/cooldown, Ability & Ultimate whenever completing a lap
    const newCompletedLaps = Math.floor(this.distance / track.totalLength);
    if (newCompletedLaps > this.completedLaps && newCompletedLaps < track.config.laps) {
      this.completedLaps = newCompletedLaps;
      const refreshed =
        this.abilityUsed ||
        this.ultUsed ||
        this.sprintCooldown > 0 ||
        this.spurtsLeft < MAX_SPURTS_PER_LAP;
      this.abilityUsed = false;
      this.ultUsed = false;
      this.sprintCooldown = 0;
      this.spurtsLeft = MAX_SPURTS_PER_LAP;
      if (this.isPlayer && refreshed && onLog) {
        const keyHint =
          this.playerSlot === 2
            ? 'Bứt tốc [L], Ability [N] & Ultimate [M]'
            : 'Bứt tốc [R], Ability [F] & Ultimate [G]';
        onLog(
          `🔄 Hoàn thành Vòng ${newCompletedLaps}! Làm mới 2/2 ${keyHint}!`,
          this
        );
      }
    }
  }

  private updateAI(dt: number, runners: StickmanRunner[], track: Track, raceTime: number) {
    if (this.exhausted || this.isFrozen()) return;

    // Red AI tries to align lane with a nearby target while charging
    if (this.charType === 'red' && this.redChargeTimer > 0) {
      let nearest: StickmanRunner | null = null;
      let bestDist = 220;
      for (const other of runners) {
        if (other !== this && !this.hitTargets.has(other)) {
          const d = Math.abs(this.distance - other.distance);
          if (d < bestDist) {
            bestDist = d;
            nearest = other;
          }
        }
      }
      if (nearest && nearest.laneIndex !== this.laneIndex) {
        this.setTargetLane(nearest.laneIndex);
      }
    } else {
      this.aiLaneCooldown -= dt;
      if (this.aiLaneCooldown <= 0) {
        this.aiLaneCooldown = 10 + Math.random() * 12;
        if (Math.random() < 0.6) this.switchLane();
      }
    }

    let targetSpeed = this.stamina > 30 ? 88 : 55;
    if (this.hasSkillStaminaProtection()) targetSpeed = 100;

    if (this.heavyTimer > 0) {
      // Heavy caps AI velocity at heavySpeedCap, and slows AI slightly if not spamming fast enough
      const cap = this.heavySpeedCap;
      if (this.baseVelocity < cap) {
        this.baseVelocity = Math.min(cap, this.baseVelocity + 22 * dt);
      }
    } else if (this.baseVelocity < targetSpeed) {
      this.baseVelocity = Math.min(100, this.baseVelocity + 55 * dt);
    }

    const lapProgress = (this.distance % track.totalLength) / track.totalLength;
    if (!this.abilityUsed && lapProgress > 0.25) {
      this.useAbility();
    }
    if (raceTime >= ULT_UNLOCK_TIME && !this.ultUsed && lapProgress > 0.55) {
      this.useUltimate(raceTime);
    }
    if (
      this.spurtsLeft > 0 &&
      this.sprintCooldown <= 0 &&
      (this.hasSkillStaminaProtection() || this.stamina >= 60)
    ) {
      this.useSprint();
    }
  }

  draw(ctx: CanvasRenderingContext2D, track: Track, camZoom = 1) {
    const pos = track.getPositionAt(this.distance, this.laneOffset);
    ctx.save();
    ctx.translate(pos.x, pos.y);

    if (camZoom < 0.45) {
      const r = Math.min(95, 14 / camZoom);
      ctx.fillStyle =
        this.playerSlot === 1 ? '#fde047' : this.playerSlot === 2 ? '#34d399' : this.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(4, 3 / camZoom);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (this.playerSlot === 1 || this.playerSlot === 2) {
      ctx.strokeStyle =
        this.playerSlot === 1 ? 'rgba(253, 224, 71, 0.45)' : 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.redChargeTimer > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fill();
    }

    if (this.staminaIframeTimer > 0) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
      ctx.fill();
    }

    if (this.spurtBurstTimer > 0 || this.spurtSustainTimer > 0) {
      ctx.strokeStyle = this.spurtBurstTimer > 0 ? '#f59e0b' : '#fbbf24';
      ctx.lineWidth = this.spurtBurstTimer > 0 ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.spurtBurstTimer > 0 ? 29 : 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(pos.angle);

    const effVel = this.getEffectiveVelocity();
    if (effVel > 85) {
      const isSpurt = this.spurtBurstTimer > 0 || this.spurtSustainTimer > 0;
      ctx.strokeStyle = isSpurt ? 'rgba(251, 191, 36, 0.85)' : 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = isSpurt ? 2.8 : 2;
      ctx.beginPath();
      ctx.moveTo(-16, -7);
      ctx.lineTo(isSpurt ? -44 : -32, -7);
      ctx.moveTo(-18, 0);
      ctx.lineTo(isSpurt ? -52 : -38, 0);
      ctx.moveTo(-16, 7);
      ctx.lineTo(isSpurt ? -44 : -32, 7);
      ctx.stroke();
    }

    const drawColor = this.exhausted ? '#64748b' : this.color;
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = drawColor;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const swing = Math.sin(this.animPhase) * 11;

    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4 + swing, -9);
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4 - swing, 9);
    ctx.moveTo(-8, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(2, 0);
    ctx.lineTo(2 - swing * 0.8, -10);
    ctx.moveTo(2, 0);
    ctx.lineTo(2 + swing * 0.8, 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(11, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (this.falseStartTimer > 0) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
      ctx.fill();
    }

    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;

    let statusText = this.name;
    if (this.falseStartTimer > 0) statusText += ' [⛔ ĐỨNG HÌNH]';
    else if (this.stunTimer > 0) statusText += ' [💫 CHOÁNG]';
    else if (this.heavyTimer > 0 || this.silenceTimer > 0) statusText += ' [⛓️🔇 DEBUFF]';
    else if (this.exhausted) statusText += ' [💤 KIỆT SỨC]';

    ctx.strokeText(statusText, 0, -24);
    ctx.fillStyle =
      this.falseStartTimer > 0 || this.stunTimer > 0 || this.heavyTimer > 0
        ? '#fb7185'
        : this.playerSlot === 1
        ? '#fde047'
        : this.playerSlot === 2
        ? '#34d399'
        : '#ffffff';
    ctx.fillText(statusText, 0, -24);

    ctx.restore();
  }
}
