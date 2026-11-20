import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Map, Mouse, Play, Settings, UserCheck, Users, Volume2, VolumeX, X } from 'lucide-react';
import { MAPS_CONFIG, drawMapThumbnail } from '../game/maps';
import type { CharType, ControlMode, HubPlayer, MapId, PlayerCount } from '../types/game';

interface HubViewProps {
  playerCount: PlayerCount;
  onChangePlayerCount: (count: PlayerCount) => void;
  myCharType: CharType;
  onSelectChar: (char: CharType) => void;
  p2CharType: CharType;
  onSelectP2Char: (char: CharType) => void;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  voteCandidates: MapId[];
  myVotedMap: MapId;
  botVotes: Record<string, MapId>;
  onVoteMap: (mapId: MapId) => void;
  onStartRace: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const MapThumbnailCanvas: React.FC<{ mapId: MapId }> = ({ mapId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMapThumbnail(canvas, MAPS_CONFIG[mapId]);
  }, [mapId]);

  return (
    <canvas
      ref={canvasRef}
      width={210}
      height={136}
      className="w-full h-32 rounded-lg bg-slate-200 block"
    />
  );
};

function resolveWasdDirection(e: KeyboardEvent): 'up' | 'down' | 'left' | 'right' | null {
  const code = e.code;
  const key = e.key.toLowerCase();
  if (code === 'KeyW' || key === 'w' || key === 'ư') return 'up';
  if (code === 'KeyS' || key === 's') return 'down';
  if (code === 'KeyA' || key === 'a' || key === 'ă' || key === 'â') return 'left';
  if (code === 'KeyD' || key === 'd' || key === 'đ') return 'right';
  return null;
}

function resolveArrowDirection(e: KeyboardEvent): 'up' | 'down' | 'left' | 'right' | null {
  if (e.code === 'ArrowUp') return 'up';
  if (e.code === 'ArrowDown') return 'down';
  if (e.code === 'ArrowLeft') return 'left';
  if (e.code === 'ArrowRight') return 'right';
  return null;
}

export const HubView: React.FC<HubViewProps> = ({
  playerCount,
  onChangePlayerCount,
  myCharType,
  onSelectChar,
  p2CharType,
  onSelectP2Char,
  controlMode,
  onChangeControlMode,
  voteCandidates,
  myVotedMap,
  botVotes,
  onVoteMap,
  onStartRace,
  muted,
  onToggleMute,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeModal, setActiveModal] = useState<'none' | 'voting' | 'char' | 'settings'>('voting');
  const [editingCharSlot, setEditingCharSlot] = useState<1 | 2>(1);
  const playerCountRef = useRef<PlayerCount>(playerCount);

  const p1DirsRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const p2DirsRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const playersRef = useRef<HubPlayer[]>([
    {
      id: 'me',
      name: 'BẠN',
      charType: myCharType,
      x: 510,
      y: 315,
      isMe: true,
      playerSlot: 1,
      animPhase: 0,
    },
    {
      id: 'slot2',
      name: 'Bot Đỏ 1',
      charType: 'red',
      x: 390,
      y: 265,
      isMe: false,
      animPhase: 0,
      wanderWait: 1.2,
    },
    {
      id: 'b2',
      name: 'Bot Xanh 2',
      charType: 'blue',
      x: 635,
      y: 275,
      isMe: false,
      animPhase: 0,
      wanderWait: 0.6,
    },
    {
      id: 'b3',
      name: 'Bot Đỏ 3',
      charType: 'red',
      x: 455,
      y: 375,
      isMe: false,
      animPhase: 0,
      wanderWait: 1.8,
    },
  ]);

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    playerCountRef.current = playerCount;
    if (playerCount === 1) setEditingCharSlot(1);

    const players = playersRef.current;
    players[0].name = playerCount === 2 ? 'P1 (BẠN)' : 'BẠN';
    players[0].charType = myCharType;
    players[0].playerSlot = 1;

    if (playerCount === 2) {
      players[1].name = 'P2 (BẠN 2)';
      players[1].charType = p2CharType;
      players[1].isMe = true;
      players[1].playerSlot = 2;
      players[1].wanderTarget = undefined;
      players[2].name = 'Bot Xanh 3';
      players[3].name = 'Bot Đỏ 4';
    } else {
      players[1].name = 'Bot Đỏ 1';
      players[1].charType = 'red';
      players[1].isMe = false;
      players[1].playerSlot = undefined;
      players[2].name = 'Bot Xanh 2';
      players[3].name = 'Bot Đỏ 3';
    }
  }, [playerCount, myCharType, p2CharType]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const wasd = resolveWasdDirection(e);
      const arrow = resolveArrowDirection(e);
      if (arrow) e.preventDefault();

      if (playerCountRef.current === 2) {
        if (wasd) p1DirsRef.current[wasd] = true;
        if (arrow) p2DirsRef.current[arrow] = true;
      } else {
        const dir = wasd || arrow;
        if (dir) p1DirsRef.current[dir] = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const wasd = resolveWasdDirection(e);
      const arrow = resolveArrowDirection(e);
      if (playerCountRef.current === 2) {
        if (wasd) p1DirsRef.current[wasd] = false;
        if (arrow) p2DirsRef.current[arrow] = false;
      } else {
        const dir = wasd || arrow;
        if (dir) p1DirsRef.current[dir] = false;
      }
    };
    const onBlur = () => {
      p1DirsRef.current = { up: false, down: false, left: false, right: false };
      p2DirsRef.current = { up: false, down: false, left: false, right: false };
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const players = playersRef.current;
      const moveSpeed = 240;

      const applyManualMove = (
        runner: HubPlayer,
        dirs: { up: boolean; down: boolean; left: boolean; right: boolean }
      ) => {
        let dx = 0;
        let dy = 0;
        if (dirs.up) dy -= 1;
        if (dirs.down) dy += 1;
        if (dirs.left) dx -= 1;
        if (dirs.right) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          runner.x = Math.max(55, Math.min(965, runner.x + (dx / len) * moveSpeed * dt));
          runner.y = Math.max(85, Math.min(485, runner.y + (dy / len) * moveSpeed * dt));
          runner.animPhase += 14 * dt;
        } else {
          runner.animPhase = 0;
        }
      };

      applyManualMove(players[0], p1DirsRef.current);
      if (playerCountRef.current === 2) {
        applyManualMove(players[1], p2DirsRef.current);
      }

      const botStartIdx = playerCountRef.current === 2 ? 2 : 1;
      for (let i = botStartIdx; i < players.length; i++) {
        const bot = players[i];
        if (!bot.wanderTarget) {
          bot.wanderWait = (bot.wanderWait ?? 1) - dt;
          if (bot.wanderWait <= 0) {
            bot.wanderTarget = {
              x: 200 + Math.random() * 620,
              y: 170 + Math.random() * 260,
            };
          }
          bot.animPhase = 0;
        } else {
          const bdx = bot.wanderTarget.x - bot.x;
          const bdy = bot.wanderTarget.y - bot.y;
          const dist = Math.hypot(bdx, bdy);
          if (dist < 6) {
            bot.wanderTarget = undefined;
            bot.wanderWait = 1.4 + Math.random() * 2.2;
            bot.animPhase = 0;
          } else {
            const bSpeed = 90;
            bot.x += (bdx / dist) * bSpeed * dt;
            bot.y += (bdy / dist) * bSpeed * dt;
            bot.animPhase += 9 * dt;
          }
        }
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      for (let x = -200; x < 1200; x += 65) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 180, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 55) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 110, canvas.width, 28);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, 104, canvas.width, 6);
      ctx.fillRect(0, 138, canvas.width, 6);

      ctx.save();
      ctx.translate(510, 310);
      ctx.scale(1.45, 0.85);
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(0, 0, 185, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e40af';
      ctx.beginPath();
      ctx.arc(0, 0, 162, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-65, 35);
      ctx.lineTo(-80, -35);
      ctx.lineTo(-30, 0);
      ctx.lineTo(0, -55);
      ctx.lineTo(30, 0);
      ctx.lineTo(80, -35);
      ctx.lineTo(65, 35);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-65, 42, 130, 16);
      ctx.restore();

      const sorted = players.slice().sort((a, b) => a.y - b.y);
      sorted.forEach((p) => {
        const col = p.charType === 'blue' ? '#0284c7' : '#ef4444';
        const swing = Math.sin(p.animPhase) * 6;
        ctx.save();
        ctx.translate(p.x, p.y);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 22, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(0, -16, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-11, 2 + swing * 0.5);
        ctx.lineTo(0, -4);
        ctx.lineTo(11, 2 - swing * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-8 + swing, 22);
        ctx.lineTo(0, 10);
        ctx.lineTo(8 - swing, 22);
        ctx.stroke();

        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3.5;
        ctx.strokeText(p.name, 0, -30);
        ctx.fillStyle =
          p.playerSlot === 2 ? '#34d399' : p.isMe ? '#fbbf24' : '#ffffff';
        ctx.fillText(p.name, 0, -30);
        ctx.restore();
      });

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const voteCounts: Record<MapId, number> = {
    oanquan: 0,
    ngoisao: 0,
    dongho: 0,
    kinhthanhhue: 0,
  };
  if (myVotedMap) voteCounts[myVotedMap] += 1;
  Object.values(botVotes).forEach((m) => {
    if (voteCounts[m] !== undefined) voteCounts[m] += 1;
  });

  let leadingMapId = voteCandidates[0];
  let maxVotes = -1;
  voteCandidates.forEach((id) => {
    if (voteCounts[id] > maxVotes) {
      maxVotes = voteCounts[id];
      leadingMapId = id;
    }
  });

  const lobbyRoster: Array<{
    id: string;
    name: string;
    charType: CharType;
    playerSlot?: 1 | 2;
  }> =
    playerCount === 2
      ? [
          { id: 'p1', name: 'P1 (BẠN)', charType: myCharType, playerSlot: 1 },
          { id: 'p2', name: 'P2 (BẠN 2)', charType: p2CharType, playerSlot: 2 },
          { id: 'b2', name: 'Bot Xanh 3', charType: 'blue' },
          { id: 'b3', name: 'Bot Đỏ 4', charType: 'red' },
        ]
      : [
          { id: 'me', name: 'BẠN', charType: myCharType, playerSlot: 1 },
          { id: 'b1', name: 'Bot Đỏ 1', charType: 'red' },
          { id: 'b2', name: 'Bot Xanh 2', charType: 'blue' },
          { id: 'b3', name: 'Bot Đỏ 3', charType: 'red' },
        ];

  const refocusContainer = () => {
    containerRef.current?.focus({ preventScroll: true });
  };

  const activeCharValue = editingCharSlot === 2 && playerCount === 2 ? p2CharType : myCharType;
  const handlePickChar = (char: CharType) => {
    if (editingCharSlot === 2 && playerCount === 2) {
      onSelectP2Char(char);
    } else {
      onSelectChar(char);
      if (playerCount === 1) setActiveModal('none');
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onClick={refocusContainer}
      className="w-full max-w-[1060px] mx-auto flex flex-col gap-3 outline-none"
    >
      {/* Compact Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            Đua Người Que 2D
          </h1>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <p className="text-xs sm:text-sm text-slate-300">
            {playerCount === 2 ? (
              <>
                2 Người chơi · P1{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-amber-300">
                  WASD
                </kbd>{' '}
                · P2{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-emerald-300">
                  Mũi tên
                </kbd>
              </>
            ) : (
              <>
                Sảnh chờ · Dùng{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-slate-200">
                  WASD
                </kbd>{' '}
                hoặc mũi tên để di chuyển
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-slate-300">
          <span>
            Map:{' '}
            <strong className="text-emerald-400 font-semibold">
              {MAPS_CONFIG[leadingMapId].name}
            </strong>{' '}
            <span className="text-slate-400">
              ({MAPS_CONFIG[leadingMapId].durationLabel})
            </span>
          </span>

          {/* Control Mode Option (only shown in 1P mode; 2P uses P1 Q/E & P2 Mouse L/R) */}
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setActiveModal(activeModal === 'settings' ? 'none' : 'settings');
                refocusContainer();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>2 Người chơi</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setActiveModal(activeModal === 'settings' ? 'none' : 'settings');
              refocusContainer();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
              activeModal === 'settings'
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cài đặt</span>
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

      {/* Interactive Hub Canvas Container */}
      <div className="relative w-full aspect-[1020/560] rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={1020}
          height={560}
          className="block w-full h-full"
        />

        {/* Players Leaderboard (Top Right) */}
        <aside className="absolute top-3 right-3 w-56 rounded-lg overflow-hidden border border-slate-700 bg-slate-900/95 shadow-lg">
          <div className="bg-lime-600 px-3 py-1.5 flex items-center justify-between text-xs font-bold text-white">
            <span>Người chơi (4)</span>
            <span>Nhân vật</span>
          </div>
          <div className="divide-y divide-slate-800">
            {lobbyRoster.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full inline-flex items-center justify-center font-bold text-[11px] text-white shrink-0 ${
                      p.charType === 'blue' ? 'bg-sky-600' : 'bg-red-600'
                    }`}
                  >
                    {p.playerSlot ? `P${p.playerSlot}` : p.name.charAt(0)}
                  </span>
                  <span
                    className={`font-semibold truncate ${
                      p.playerSlot === 1
                        ? 'text-amber-400'
                        : p.playerSlot === 2
                        ? 'text-emerald-400'
                        : 'text-slate-100'
                    }`}
                  >
                    {p.name}
                  </span>
                </div>
                <span
                  className={`font-semibold shrink-0 ${
                    p.charType === 'blue' ? 'text-sky-400' : 'text-red-400'
                  }`}
                >
                  {p.charType === 'blue' ? 'Xanh Biển' : 'Đỏ'}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Voting Modal */}
        {activeModal === 'voting' && (
          <div
            role="dialog"
            aria-label="Bỏ phiếu bản đồ"
            className="absolute top-[46%] left-[44%] -translate-x-1/2 -translate-y-1/2 w-[580px] max-w-[92%] bg-white text-slate-900 rounded-2xl border-4 border-slate-300 p-4 shadow-2xl z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold italic tracking-tight text-purple-700">
                  VOTING MAP
                </h2>
                <p className="text-[11px] text-slate-500">
                  Sprint (1 vòng) · Mile (2 vòng) · Medium (3 vòng) · Long (4 vòng) · Chiều chạy 50/50
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                aria-label="Đóng bảng bỏ phiếu"
                className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {voteCandidates.map((mapId) => {
                const cfg = MAPS_CONFIG[mapId];
                const isSelected = myVotedMap === mapId;
                const catLabel =
                  cfg.category === 'sprint'
                    ? 'Sprint'
                    : cfg.category === 'mile'
                    ? 'Mile'
                    : cfg.category === 'medium'
                    ? 'Medium'
                    : 'Long';
                return (
                  <button
                    key={mapId}
                    type="button"
                    onClick={() => onVoteMap(mapId)}
                    className={`relative text-left rounded-xl p-2 border-2 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                        : 'border-slate-300 bg-slate-50 hover:border-sky-400'
                    }`}
                  >
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-lime-600 border-2 border-white text-white font-mono font-bold text-xs flex items-center justify-center shadow">
                      {voteCounts[mapId]}
                    </span>
                    <MapThumbnailCanvas mapId={mapId} />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-800 truncate">{cfg.name}</span>
                      <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                        {isSelected ? 'Đã chọn' : 'Chọn'}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 truncate">
                      {catLabel} · {cfg.laps} vòng · {cfg.durationLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {activeModal === 'settings' && (
          <div
            role="dialog"
            aria-label="Cài đặt chế độ chơi"
            className="absolute top-[46%] left-[44%] -translate-x-1/2 -translate-y-1/2 w-[620px] max-w-[94%] bg-slate-900 text-slate-100 rounded-2xl border-2 border-amber-500 p-5 shadow-2xl z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-amber-400">
                  Cài đặt chế độ chơi
                </h2>
                <p className="text-[11px] text-slate-400">
                  Tùy chọn 1 người chơi (mặc định) hoặc 2 người chơi cùng bàn phím &amp; chuột
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                aria-label="Đóng bảng cài đặt"
                className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChangePlayerCount(1)}
                className={`text-left rounded-xl p-3.5 border-2 transition-colors cursor-pointer ${
                  playerCount === 1
                    ? 'border-sky-400 bg-sky-950/60'
                    : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">1 Người chơi</span>
                  {playerCount === 1 && (
                    <span className="text-[11px] font-bold text-sky-300">Đang bật</span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Lối chơi chuẩn như cũ · Tự chọn tăng tốc bằng Phím Q/E hoặc Chuột L/R cùng 3 Bot.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangePlayerCount(2)}
                className={`text-left rounded-xl p-3.5 border-2 transition-colors cursor-pointer ${
                  playerCount === 2
                    ? 'border-emerald-400 bg-emerald-950/60'
                    : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">2 Người chơi (Cùng máy)</span>
                  {playerCount === 2 && (
                    <span className="text-[11px] font-bold text-emerald-300">Đang bật</span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chơi chung 1 màn hình · P1 điều khiển bàn phím, P2 điều khiển chuột + N/M/L cùng 2 Bot.
                </p>
              </button>
            </div>

            {playerCount === 2 ? (
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-950/90 border border-amber-500/40 p-3">
                  <div className="font-bold text-amber-300 mb-1.5">Người chơi 1 (P1)</div>
                  <ul className="space-y-1 text-slate-300">
                    <li>
                      Tăng tốc: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">Q</kbd> /{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">E</kbd>
                    </li>
                    <li>
                      Ability: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">F</kbd> · Ultimate:{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">G</kbd>
                    </li>
                    <li>
                      Bứt tốc: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">R</kbd> · Đổi làn:{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">T</kbd>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-950/90 border border-emerald-500/40 p-3">
                  <div className="font-bold text-emerald-300 mb-1.5">Người chơi 2 (P2)</div>
                  <ul className="space-y-1 text-slate-300">
                    <li>
                      Tăng tốc: <span className="font-mono font-bold text-white">Chuột Trái / Chuột Phải</span>
                    </li>
                    <li>
                      Ability: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">N</kbd> · Ultimate:{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">M</kbd>
                    </li>
                    <li>
                      Bứt tốc: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">L</kbd> · Đổi làn:{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">K</kbd>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="mt-3.5 rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Điều khiển 1 người: Tăng tốc{' '}
                  <strong className="text-white">
                    {controlMode === 'mouse' ? 'Chuột Trái/Phải' : 'Q / E'}
                  </strong>{' '}
                  · Bứt tốc <strong className="text-white">R</strong> · Ability{' '}
                  <strong className="text-white">F</strong> · Ultimate{' '}
                  <strong className="text-white">G</strong> · Đổi làn{' '}
                  <strong className="text-white">T</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Character Select Modal */}
        {activeModal === 'char' && (
          <div
            role="dialog"
            aria-label="Chọn nhân vật người que"
            className="absolute top-[46%] left-[44%] -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[94%] bg-slate-900 text-slate-100 rounded-2xl border-2 border-sky-500 p-5 shadow-2xl z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-sky-400">
                  Chọn Nhân Vật Người Que
                </h2>
                <p className="text-[11px] text-slate-400">
                  {editingCharSlot === 2 && playerCount === 2
                    ? 'Ability [N], Ultimate [M] & Bứt tốc [L] tự động làm mới sau mỗi vòng (Lap)'
                    : 'Ability [F], Ultimate [G] & Bứt tốc [R] tự động làm mới sau mỗi vòng (Lap)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                aria-label="Đóng bảng chọn nhân vật"
                className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {playerCount === 2 && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setEditingCharSlot(1)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    editingCharSlot === 1
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  P1: {myCharType === 'blue' ? 'Xanh Biển' : 'Đỏ'} (Q/E · F/G/R)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCharSlot(2)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    editingCharSlot === 2
                      ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  P2: {p2CharType === 'blue' ? 'Xanh Biển' : 'Đỏ'} (Chuột · N/M/L)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePickChar('blue')}
                className={`text-left rounded-xl p-4 border-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  activeCharValue === 'blue'
                    ? 'border-sky-400 bg-sky-950/70'
                    : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-sky-400 text-sm">
                    Người Que Xanh Biển
                  </h3>
                  {activeCharValue === 'blue' && (
                    <span className="text-[11px] font-semibold text-sky-300">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Chuyên tốc độ thuần &amp; giữ Stamina ổn định
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">
                    Ability [{editingCharSlot === 2 && playerCount === 2 ? 'N' : 'F'}]:
                  </strong>{' '}
                  Hồi Stamina chủ động <strong className="text-emerald-300">1s</strong>, miễn nhiễm hao Stamina (<strong className="text-cyan-300">I-frames 2s</strong>), tăng <strong className="text-amber-300">+30% Speed (4s)</strong>.
                </p>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  <strong className="text-white">
                    Ultimate [{editingCharSlot === 2 && playerCount === 2 ? 'M' : 'G'}] (mở sau 12s):
                  </strong>{' '}
                  Hồi Stamina <strong className="text-emerald-300">2s</strong>, <strong className="text-cyan-300">I-frames 4s</strong>, tăng <strong className="text-amber-300">+50% Speed (4s)</strong>. Phối hợp Bứt tốc [{editingCharSlot === 2 && playerCount === 2 ? 'L' : 'R'}] miễn phí không tốn 25% Stamina.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePickChar('red')}
                className={`text-left rounded-xl p-4 border-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400 ${
                  activeCharValue === 'red'
                    ? 'border-red-500 bg-red-950/60'
                    : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-red-400 text-sm">
                    Người Que Đỏ
                  </h3>
                  {activeCharValue === 'red' && (
                    <span className="text-[11px] font-semibold text-red-300">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Càn lướt va chạm cùng làn &amp; khống chế đối thủ
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">
                    Ability [{editingCharSlot === 2 && playerCount === 2 ? 'N' : 'F'}]:
                  </strong>{' '}
                  Hồi Stamina <strong className="text-emerald-300">0.5s</strong>, <strong className="text-cyan-300">I-frames 1s</strong>, <strong className="text-amber-300">+15% Speed (4s)</strong> &amp; Càn lướt 4s. Đâm đối thủ <strong className="text-white">cùng làn</strong> gây <strong className="text-rose-300">Choáng 1s</strong>, đánh dấu mục tiêu &amp; cộng tối đa 2 lần (<strong className="text-cyan-300">+2s I-frames</strong>, <strong className="text-amber-300">+15% Speed 2s</strong>).
                </p>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  <strong className="text-white">
                    Ultimate [{editingCharSlot === 2 && playerCount === 2 ? 'M' : 'G'}] (mở sau 12s):
                  </strong>{' '}
                  Hồi Stamina <strong className="text-emerald-300">1s</strong>, <strong className="text-cyan-300">I-frames 2s</strong>, <strong className="text-amber-300">+30% Speed (4s)</strong>. Ám <strong className="text-rose-300">Heavy</strong> (khóa trần tốc hiện tại) &amp; <strong className="text-rose-300">Silence</strong> (khóa skill) trong <strong className="text-white">3s</strong> lên các mục tiêu đã húc; mỗi mục tiêu cộng thêm +0.5s Stamina, +2s I-frames, +20% Speed (2s).
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Hub Action Bar */}
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'voting' ? 'none' : 'voting')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 border-2 border-slate-950 text-white font-bold text-sm shadow-lg transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-purple-300"
          >
            <Map className="w-4 h-4" />
            <span>Bỏ phiếu Map</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'char' ? 'none' : 'char')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 border-2 border-slate-950 text-white font-bold text-sm shadow-lg transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            <UserCheck className="w-4 h-4" />
            <span>{playerCount === 2 ? 'Nhân vật (P1/P2)' : 'Đổi nhân vật'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'settings' ? 'none' : 'settings')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-950 text-amber-300 font-bold text-sm shadow-lg transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <Settings className="w-4 h-4" />
            <span>{playerCount === 2 ? '2P' : '1P'}</span>
          </button>

          <button
            type="button"
            onClick={onStartRace}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border-2 border-slate-950 text-white font-extrabold text-sm shadow-lg transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Bắt đầu đua</span>
          </button>
        </div>
      </div>
    </div>
  );
};
