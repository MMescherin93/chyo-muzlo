import React, { useState } from 'react';
import { parseShareInput } from '@muzlo/shared';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
  playerId: string;
  onSubmit: (text: string) => void;
  onExit: () => void;
}

export default function Lobby({ room, playerId, onSubmit, onExit }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const myCount = room.tracks.filter((t) => t.submittedBy === playerId).length;

  const submit = () => {
    if (!parseShareInput(text)) {
      setError('Нужна ссылка на трек Яндекс Музыки (плейлисты не принимаются)');
      setSent(false);
      return;
    }
    onSubmit(text);
    setText('');
    setError('');
    setSent(true);
  };

  return (
    <div className="screen" style={{ gap: 16 }}>
      <h1 style={{ color: 'var(--neon)', textAlign: 'center', margin: 0 }}>ЛОББИ</h1>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <span>Игроки: {room.players.length}</span>
        <span>Треков: {room.tracks.length}</span>
      </div>

      <div>
        <h3 style={{ margin: '0 0 8px' }}>Скинь ссылку на трек из ЯМузыки</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Вставь ссылку (или «Название — Исполнитель» + ссылка)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button style={{ background: 'var(--pink)', color: 'var(--bg)' }} onClick={submit}>
            ➕
          </button>
        </div>
        {error && <div style={{ color: 'var(--pink)', fontSize: 13, marginTop: 6 }}>{error}</div>}
        {sent && !error && (
          <div style={{ color: 'var(--neon)', fontSize: 13, marginTop: 6 }}>Трек добавлен ✅</div>
        )}
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          Ты скинул(а): {myCount}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {room.players.map((p) => (
          <div
            key={p.id}
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, display: 'flex', gap: 8 }}
          >
            <span>{p.avatar}</span>
            <span style={{ flex: 1 }}>{p.nickname}{p.isHost ? ' 👑' : ''}</span>
            <span style={{ color: 'var(--muted)' }}>
              {room.tracks.filter((t) => t.submittedBy === p.id).length} треков
            </span>
          </div>
        ))}
      </div>

      <div style={{ color: 'var(--muted)', textAlign: 'center' }}>Ждём, когда хост начнёт игру…</div>

      <button style={{ background: 'var(--surface)', color: 'var(--text)', marginTop: 8 }} onClick={onExit}>
        Выйти из лобби
      </button>
    </div>
  );
}
