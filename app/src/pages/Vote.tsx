import React, { useState } from 'react';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
  onVote: (playerId: string) => void;
}

export default function Vote({ room, onVote }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const votedSet = new Set(room.votedIds);

  const confirm = () => {
    if (!selected) return;
    onVote(selected);
    setVoted(true);
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 12 }}>
      <h1 style={{ color: 'var(--orange)', textAlign: 'center', margin: 0 }}>Кто скинул трек? 👀</h1>
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
                minHeight: 100,
                padding: '10px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 30 }}>{p.avatar}</span>
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
        <div style={{ textAlign: 'center', color: 'var(--neon)' }}>
          Голос учтён ✅ Ждём остальных и хоста
        </div>
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
