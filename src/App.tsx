import { useCallback, useState } from 'react';
import { HubView } from './components/HubView';
import { RaceView } from './components/RaceView';
import { MAPS_CONFIG } from './game/maps';
import { sound } from './game/sound';
import type { CharType, ControlMode, MapId, PlayerCount } from './types/game';

const ALL_MAP_ORDER: MapId[] = ['oanquan', 'ngoisao', 'dongho', 'kinhthanhhue'];

function pickVoteRound(): {
  candidates: MapId[];
  myVote: MapId;
  botVotes: Record<string, MapId>;
} {
  const candidates = ALL_MAP_ORDER.filter((id) => Boolean(MAPS_CONFIG[id]));
  return {
    candidates,
    myVote: candidates[0],
    botVotes: {
      b1: candidates[Math.floor(Math.random() * candidates.length)],
      b2: candidates[Math.floor(Math.random() * candidates.length)],
      b3: candidates[Math.floor(Math.random() * candidates.length)],
    },
  };
}

export default function App() {
  const [screen, setScreen] = useState<'HUB' | 'RACE'>('HUB');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(1);
  const [myCharType, setMyCharType] = useState<CharType>('blue');
  const [p2CharType, setP2CharType] = useState<CharType>('red');
  const [controlMode, setControlMode] = useState<ControlMode>('keyboard');
  const [voteRound, setVoteRound] = useState(() => pickVoteRound());
  const [activeMapId, setActiveMapId] = useState<MapId>('oanquan');
  const [muted, setMuted] = useState(false);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sound.muted = next;
      return next;
    });
  }, []);

  const handleStartRace = useCallback(() => {
    const counts: Record<string, number> = {};
    voteRound.candidates.forEach((m) => {
      counts[m] = 0;
    });
    if (counts[voteRound.myVote] !== undefined) counts[voteRound.myVote]++;
    Object.values(voteRound.botVotes).forEach((m) => {
      if (counts[m] !== undefined) counts[m]++;
    });

    let winningMap = voteRound.candidates[0];
    let maxVotes = -1;
    for (const [mapId, count] of Object.entries(counts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winningMap = mapId as MapId;
      }
    }

    setActiveMapId(winningMap);
    setScreen('RACE');
  }, [voteRound]);

  const handleReturnToHub = useCallback(() => {
    setVoteRound(pickVoteRound());
    setScreen('HUB');
  }, []);

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-4 py-4">
      {screen === 'HUB' ? (
        <HubView
          playerCount={playerCount}
          onChangePlayerCount={setPlayerCount}
          myCharType={myCharType}
          onSelectChar={setMyCharType}
          p2CharType={p2CharType}
          onSelectP2Char={setP2CharType}
          controlMode={controlMode}
          onChangeControlMode={setControlMode}
          voteCandidates={voteRound.candidates}
          myVotedMap={voteRound.myVote}
          botVotes={voteRound.botVotes}
          onVoteMap={(mapId) =>
            setVoteRound((prev) => ({
              ...prev,
              myVote: mapId,
            }))
          }
          onStartRace={handleStartRace}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      ) : (
        <RaceView
          mapId={activeMapId}
          playerCount={playerCount}
          myCharType={myCharType}
          p2CharType={p2CharType}
          controlMode={controlMode}
          onChangeControlMode={setControlMode}
          onReturnToHub={handleReturnToHub}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}
    </main>
  );
}
