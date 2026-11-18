import React, { useEffect, useState } from 'react';
import { GuestSync } from '../sync';
import type { RoomView } from '../room-view';
import Join from '../pages/Join';
import Lobby from '../pages/Lobby';
import Vote from '../pages/Vote';
import Reveal from '../pages/Reveal';
import Final from '../pages/Final';
import Playing from '../pages/Playing';

export default function GuestApp({ onExit }: { onExit: () => void }) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [sync, setSync] = useState<GuestSync | null>(null);
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get('code') ?? localStorage.getItem('muzlo_code') ?? '',
  );
  const [joined, setJoined] = useState(
    () => !!(localStorage.getItem('muzlo_code') && localStorage.getItem('muzlo_nick')),
  );
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'error'>('connecting');

  useEffect(() => {
    if (!joined || !code) return;
    let cancelled = false;
    let inst: GuestSync | null = null;
    setStatus('connecting');

    GuestSync.create(code, setRoom)
      .then((g) => {
        if (cancelled) {
          g.destroy();
          return;
        }
        inst = g;
        setSync(g);
        const nick = localStorage.getItem('muzlo_nick') || '';
        if (nick) g.join(nick);
        setStatus('waiting');
      })
      .catch((e) => {
        console.error(e);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      inst?.destroy();
    };
  }, [joined, code]);

  // Если комната не отвечает дольше 15 секунд — показываем ошибку.
  useEffect(() => {
    if (room || !joined) return;
    const t = setTimeout(() => setStatus((s) => (s === 'waiting' ? 'error' : s)), 15_000);
    return () => clearTimeout(t);
  }, [room, joined]);

  if (!joined || !code) {
    return (
      <Join
        initialCode={code}
        onJoin={(c, nick) => {
          localStorage.setItem('muzlo_code', c);
          localStorage.setItem('muzlo_nick', nick);
          setCode(c);
          setJoined(true);
        }}
      />
    );
  }

  if (status === 'error' && !room) {
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>Комната с кодом «{code}» не отвечает.</div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Проверь код и что хост запустил игру.
        </div>
        <button
          style={{ background: 'var(--pink)', color: 'var(--bg)' }}
          onClick={() => {
            localStorage.removeItem('muzlo_code');
            localStorage.removeItem('muzlo_nick');
            setRoom(null);
            setSync(null);
            setJoined(false);
          }}
        >
          Ввести код заново
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="screen" style={{ justifyContent: 'center' }}>
        Подключение к комнате {code}…
      </div>
    );
  }

  const playerId = sync?.uid ?? '';

  const exitRoom = () => {
    sync?.destroy();
    localStorage.removeItem('muzlo_code');
    localStorage.removeItem('muzlo_nick');
    onExit();
  };

  switch (room.phase) {
    case 'playing':
      return <Playing room={room} />;
    case 'voting':
      return <Vote room={room} onVote={(id) => sync?.castVote(id)} />;
    case 'reveal':
      return <Reveal room={room} />;
    case 'finished':
      return <Final room={room} onExit={exitRoom} />;
    default:
      return (
        <Lobby
          room={room}
          playerId={playerId}
          onSubmit={(t) => sync?.submitTrack(t)}
          onExit={exitRoom}
        />
      );
  }
}
