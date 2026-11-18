import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildIframeUrl, parseShareInput } from '@muzlo/shared';
import { HostController } from '../sync';
import { useWakeLock } from '../useWakeLock';
import type { RoomView } from '../room-view';

const DURATIONS = [15, 30, 60];

export default function HostApp({ onExit }: { onExit: () => void }) {
  useWakeLock(true);

  const [view, setView] = useState<RoomView | null>(null);
  const [host, setHost] = useState<HostController | null>(null);
  const [nickname, setNickname] = useState('');
  const [duration, setDuration] = useState(15);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      host?.destroy();
    };
  }, [host]);

  const create = async () => {
    if (!nickname.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const c = await HostController.create(nickname.trim(), duration, setView);
      setHost(c);
    } catch (e) {
      console.error(e);
      setError('Не удалось подключиться к брокеру. Проверь интернет и попробуй ещё раз.');
      setCreating(false);
    }
  };

  const leave = () => {
    host?.destroy();
    onExit();
  };

  if (!host || !view) {
    if (creating) {
      return (
        <div className="screen" style={{ justifyContent: 'center', textAlign: 'center' }}>
          Создаём комнату…
        </div>
      );
    }
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 16 }}>
        <h1 style={{ color: 'var(--neon)', textAlign: 'center', margin: 0 }}>СОЗДАТЬ ИГРУ</h1>
        <input
          placeholder="Твой ник (хост)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              style={{
                flex: 1,
                background: duration === d ? 'var(--neon)' : 'var(--surface)',
                color: duration === d ? 'var(--bg)' : 'var(--text)',
              }}
            >
              {d} мин
            </button>
          ))}
        </div>
        {error && <div style={{ color: 'var(--pink)', textAlign: 'center' }}>{error}</div>}
        <button
          style={{ background: 'var(--pink)', color: 'var(--bg)' }}
          disabled={!nickname.trim() || creating}
          onClick={create}
        >
          {creating ? 'Создаём…' : 'СОЗДАТЬ КОМНАТУ'}
        </button>
        <button
          style={{ background: 'transparent', color: 'var(--muted)', fontSize: 14 }}
          onClick={onExit}
        >
          ← Назад
        </button>
      </div>
    );
  }

  return <HostRoom view={view} controller={host} onExit={leave} />;
}

// ---------------------------------------------------------------------------

function HostRoom({
  view,
  controller,
  onExit,
}: {
  view: RoomView;
  controller: HostController;
  onExit: () => void;
}) {
  const players = view.players;

  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [trackText, setTrackText] = useState('');
  const [trackError, setTrackError] = useState('');
  const [trackSent, setTrackSent] = useState(false);
  const [joinOrigin, setJoinOrigin] = useState(location.origin);
  const [copied, setCopied] = useState(false);

  // Локальный сервер подскажет адрес для гостей (LAN-IP), даже если хост
  // открыл приложение через localhost.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!cancelled && info && info.origin) setJoinOrigin(info.origin);
      })
      .catch(() => {
        /* статический хостинг без сервера — остаёмся на location.origin */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isPublicOrigin = !/localhost|127\.0\.0\.1/.test(joinOrigin);
  const joinUrl = `${joinOrigin}/?code=${view.code}`;

  const castVote = () => {
    if (!selected) return;
    controller.castVote(selected);
    setVoted(true);
  };

  const copyJoinLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        // LAN-адрес по HTTP — не secure context, используем старый способ.
        const ta = document.createElement('textarea');
        ta.value = joinUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* не удалось скопировать — ссылка и так видна на экране */
    }
  };

  const addTrack = () => {
    if (!parseShareInput(trackText)) {
      setTrackError('Нужна ссылка на трек Яндекс Музыки');
      setTrackSent(false);
      return;
    }
    controller.submitTrack(trackText);
    setTrackText('');
    setTrackError('');
    setTrackSent(true);
  };

  const standings = [...players].sort((a, b) => b.score - a.score);
  const myCount = view.tracks.filter((t) => t.submittedBy === view.hostId).length;

  const EndButton = ({ label = 'Завершить игру' }: { label?: string }) => (
    <button
      style={{ background: 'var(--danger, #ff3355)', color: '#fff', fontSize: 14 }}
      onClick={() => controller.endGame()}
    >
      {label}
    </button>
  );

  // --- Лобби ---
  if (view.phase === 'lobby') {
    const canStart = players.length >= 2 && view.tracks.length > 0;
    return (
      <div className="screen" style={{ gap: 12 }}>
        <h1 style={{ color: 'var(--neon)', textAlign: 'center', margin: 0 }}>ЛОББИ</h1>
        {isPublicOrigin ? (
          <div style={{ background: '#fff', padding: 12, borderRadius: 12, alignSelf: 'center' }}>
            <QRCodeSVG value={joinUrl} size={200} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Гости открывают то же приложение и вводят код вручную
          </div>
        )}
        <div
          style={{
            textAlign: 'center',
            fontSize: 48,
            fontWeight: 900,
            color: 'var(--neon)',
            letterSpacing: 10,
            margin: '8px 0',
          }}
        >
          {view.code}
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, wordBreak: 'break-all' }}>
          {isPublicOrigin ? `QR ведёт на ${joinUrl}` : 'Код комнаты — для подключения гостей'}
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ссылка для гостей:</div>
          <div style={{ color: 'var(--neon)', fontSize: 13, wordBreak: 'break-all' }}>{joinUrl}</div>
          <button
            style={{ background: 'var(--cyan)', color: 'var(--bg)', fontSize: 15 }}
            onClick={copyJoinLink}
          >
            {copied ? 'Скопировано ✅' : '📋 Скопировать ссылку'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
          <span>Игроки: {players.length}</span>
          <span>Треков: {view.tracks.length}</span>
        </div>

        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Можешь добавить свой трек</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Ссылка на трек Яндекс Музыки"
              value={trackText}
              onChange={(e) => setTrackText(e.target.value)}
            />
            <button style={{ background: 'var(--pink)', color: 'var(--bg)' }} onClick={addTrack}>
              ➕
            </button>
          </div>
          {trackError && (
            <div style={{ color: 'var(--pink)', fontSize: 13, marginTop: 6 }}>{trackError}</div>
          )}
          {trackSent && !trackError && (
            <div style={{ color: 'var(--neon)', fontSize: 13, marginTop: 6 }}>
              Трек добавлен ✅
            </div>
          )}
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
            Ты скинул(а): {myCount}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {players.map((p) => (
            <div
              key={p.id}
              style={{ background: 'var(--surface)', borderRadius: 12, padding: 10, display: 'flex', gap: 8 }}
            >
              <span>{p.avatar}</span>
              <span style={{ flex: 1 }}>
                {p.nickname}
                {p.isHost ? ' 👑' : ''}
              </span>
              <span style={{ color: 'var(--muted)' }}>
                {view.tracks.filter((t) => t.submittedBy === p.id).length} треков
              </span>
            </div>
          ))}
        </div>

        <button
          style={{ background: 'var(--neon)', color: 'var(--bg)', opacity: canStart ? 1 : 0.4 }}
          disabled={!canStart}
          onClick={() => controller.start()}
        >
          ПОГНАЛИ! 🚀
        </button>
        {!canStart && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Нужно 2+ игрока и хотя бы 1 трек
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)' }} onClick={onExit}>
            Выйти
          </button>
          <button
            style={{ flex: 1, background: 'var(--danger, #ff3355)', color: '#fff' }}
            onClick={() => controller.endGame()}
          >
            Завершить
          </button>
        </div>
      </div>
    );
  }

  // --- Проигрывание ---
  if (view.phase === 'playing') {
    const track = view.currentTrack;
    const src = track
      ? buildIframeUrl({ type: 'track', trackId: track.trackId, albumId: track.albumId })
      : '';
    return (
      <div className="screen" style={{ gap: 12 }}>
        <h1 style={{ color: 'var(--cyan)', textAlign: 'center', margin: 0 }}>КТО ЭТО СКИНУЛ? 🤔</h1>
        <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
          Раунд {view.roundIndex + 1} · включи трек · слышит вся комната
        </div>

        {track ? (
          <iframe
            title="Яндекс Музыка"
            src={src}
            allow="autoplay; encrypted-media"
            style={{ width: '100%', height: 200, border: 'none', borderRadius: 12 }}
          />
        ) : null}

        <a
          href={track?.url}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--neon)', textAlign: 'center' }}
        >
          ▶ Открыть трек в Яндекс Музыке (в новой вкладке)
        </a>

        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
          {track?.title ? `Сейчас: ${track.title}` : 'Слушаем…'}
        </div>

        <button
          style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 8 }}
          onClick={() => controller.forceVoting()}
        >
          Хватит слушать → к голосованию
        </button>

        <div style={{ marginTop: 'auto' }}>
          <EndButton />
        </div>
      </div>
    );
  }

  // --- Голосование ---
  if (view.phase === 'voting') {
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 12 }}>
        <h1 style={{ color: 'var(--orange)', textAlign: 'center', margin: 0 }}>Кто скинул трек? 👀</h1>
        <div style={{ color: 'var(--muted)', textAlign: 'center' }}>
          Проголосовало: {view.votesCount}/{players.length}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              style={{
                background: selected === p.id ? 'var(--neon)' : 'var(--surface)',
                color: selected === p.id ? 'var(--bg)' : 'var(--text)',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 32 }}>{p.avatar}</span>
              <span style={{ fontSize: 14 }}>{p.nickname}</span>
            </button>
          ))}
        </div>
        {voted ? (
          <div style={{ textAlign: 'center', color: 'var(--neon)' }}>Голос учтён ✅</div>
        ) : (
          <button
            style={{ background: 'var(--orange)', color: 'var(--bg)' }}
            disabled={!selected}
            onClick={castVote}
          >
            ГОЛОСОВАТЬ
          </button>
        )}
        <EndButton />
      </div>
    );
  }

  // --- Разгадка / финал ---
  const track = view.currentTrack;
  return (
    <div className="screen" style={{ gap: 12 }}>
      <h1
        style={{
          color: view.phase === 'finished' ? 'var(--neon)' : 'var(--pink)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {view.phase === 'finished' ? 'ФИНАЛ 🏆' : 'РАЗГАДКА 🎉'}
      </h1>

      {view.phase === 'reveal' && track && (
        <>
          {track.title && (
            <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}>
              {track.title}
              {track.artist ? ` — ${track.artist}` : ''}
            </div>
          )}
          {view.reveal && (
            <div
              style={{
                background: 'var(--surface)',
                padding: 14,
                borderRadius: 12,
                color: 'var(--neon)',
                fontWeight: 700,
              }}
            >
              {view.reveal.comment}
            </div>
          )}
        </>
      )}

      {view.phase === 'finished' && standings[0] && (
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: 'var(--orange)' }}>
          {standings[0].avatar} {standings[0].nickname} — {standings[0].score} очков!
        </div>
      )}

      <div style={{ color: 'var(--muted)' }}>Счёт</div>
      {standings.map((p, i) => (
        <div
          key={p.id}
          style={{
            background: i === 0 ? 'var(--neon)' : 'var(--surface)',
            color: i === 0 ? 'var(--bg)' : 'var(--text)',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 900 }}>{i + 1}.</span>
          <span style={{ flex: 1 }}>
            {p.avatar} {p.nickname}
          </span>
          <span style={{ fontWeight: 900 }}>{p.score}</span>
        </div>
      ))}

      {view.phase === 'finished' ? (
        <button style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 12 }} onClick={onExit}>
          ВЫЙТИ
        </button>
      ) : (
        <EndButton />
      )}

      {view.phase === 'finished' && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
          Спасибо за игру! Данные скоро исчезнут 💨
        </div>
      )}
    </div>
  );
}
