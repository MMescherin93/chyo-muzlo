import React, { useState } from 'react';
import { buildIframeUrl } from '@muzlo/shared';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
  onVote: (playerId: string) => void;
}

/**
 * Экран гостя во время раунда: слушает вместе со всеми (превью трека) и
 * сразу голосует. Плеером управляет только хост.
 */
export default function Playing({ room, onVote }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  const track = room.currentTrack;
  const src = track
    ? buildIframeUrl({ type: 'track', trackId: track.trackId, albumId: track.albumId })
    : '';
  const votedSet = new Set(room.votedIds);

  const confirm = () => {
    if (!selected) return;
    onVote(selected);
    setVoted(true);
  };

  return (
    <div className="screen" style={{ gap: 10 }}>
      <h1 style={{ color: 'var(--cyan)', textAlign: 'center', margin: 0 }}>СЛУШАЕМ 🎧</h1>
      <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
        Голосуй, пока играет трек. Плеером управляет хост.
      </div>

      {track && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
          <iframe
            title="Превью трека"
            src={src}
            allow="autoplay; encrypted-media"
            style={{ width: '100%', height: 160, border: 'none', pointerEvents: 'none' }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(10,10,18,0.78)',
              color: 'var(--neon)',
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'center',
              padding: '5px 8px',
              pointerEvents: 'none',
            }}
          >
            🔒 Плеером управляет хост
          </div>
        </div>
      )}

      <div style={{ color: 'var(--muted)', textAlign: 'center' }}>
        Проголосовало: {room.votesCount}/{room.players.length}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {room.players.map((p) => {
          const hasVoted = votedSet.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              style={{
                background: selected === p.id ? 'var(--neon)' : 'var(--surface)',
                color: selected === p.id ? 'var(--bg)' : 'var(--text)',
                minHeight: 96,
                padding: '8px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 28 }}>{p.avatar}</span>
              <span style={{ fontSize: 14 }}>{p.nickname}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: hasVoted ? (selected === p.id ? 'var(--bg)' : 'var(--neon)') : 'var(--muted)',
                }}
              >
                {hasVoted ? '✅ проголосовал' : '⏳ ждём'}
              </span>
            </button>
          );
        })}
      </div>

      {voted ? (
        <div style={{ textAlign: 'center', color: 'var(--neon)' }}>Голос учтён ✅ Ждём хоста</div>
      ) : (
        <button
          style={{ background: 'var(--orange)', color: 'var(--bg)' }}
          disabled={!selected}
          onClick={confirm}
        >
          ГОЛОСОВАТЬ
        </button>
      )}
    </div>
  );
}
