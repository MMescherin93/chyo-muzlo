import React from 'react';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
  onExit: () => void;
}

export default function Final({ room, onExit }: Props) {
  const standings = [...room.players].sort((a, b) => b.score - a.score);
  const winner = standings[0];

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 12 }}>
      <h1 style={{ color: 'var(--neon)', textAlign: 'center', margin: 0 }}>ФИНАЛ 🏆</h1>
      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: 'var(--orange)' }}>
        {winner?.avatar} {winner?.nickname} — {winner?.score} очков!
      </div>

      {standings.map((p, i) => (
        <div
          key={p.id}
          style={{
            background: i === 0 ? 'var(--neon)' : 'var(--surface)',
            color: i === 0 ? 'var(--bg)' : 'var(--text)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 900 }}>{i + 1}.</span>
          <span style={{ flex: 1 }}>{p.avatar} {p.nickname}</span>
          <span style={{ fontWeight: 900 }}>{p.score}</span>
        </div>
      ))}

      <button style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 12 }} onClick={onExit}>
        ВЫЙТИ
      </button>

      <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
        Спасибо за игру! Данные скоро исчезнут 💨
      </div>
    </div>
  );
}
