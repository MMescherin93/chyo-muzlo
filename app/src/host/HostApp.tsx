import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildIframeUrl } from '@muzlo/shared';
import { HostController } from '../sync';
import { useWakeLock } from '../useWakeLock';
import type { RoomView } from '../room-view';

const DURATIONS = [15, 30, 60];

interface ServerInfo {
  origin: string;
  publicOrigin?: string;
}

/**
 * Экран-лобби (как в Jackbox): сам не играет и не загружает треки.
 * Показывает код/QR/ссылку, ведёт раунды и играет музыку.
 */
export default function HostApp() {
  useWakeLock(true);

  const [view, setView] = useState<RoomView | null>(null);
  const [host, setHost] = useState<HostController | null>(null);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/info')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d && d.origin) setInfo(d);
        })
        .catch(() => {
          /* без сервера — остаёмся на location.origin */
        });
    };
    load();
    // Туннель Cloudflare поднимается асинхронно — подхватываем publicOrigin.
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    HostController.create(15, setView)
      .then((c) => {
        if (cancelled) c.destroy();
        else setHost(c);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError('Не удалось создать комнату. Проверь, что сервер запущен (npm run host).');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      host?.destroy();
    };
  }, [host]);

  if (!host || !view) {
    return (
      <div className="screen" style={{ justifyContent: 'center', textAlign: 'center' }}>
        {error || 'Открываем лобби…'}
      </div>
    );
  }

  const inviteOrigin = info?.publicOrigin || info?.origin || location.origin;
  return <HostLobby view={view} controller={host} inviteOrigin={inviteOrigin} />;
}

// ---------------------------------------------------------------------------

function HostLobby({
  view,
  controller,
  inviteOrigin,
}: {
  view: RoomView;
  controller: HostController;
  inviteOrigin: string;
}) {
  const players = view.players;
  const standings = [...players].sort((a, b) => b.score - a.score);
  const joinUrl = `${inviteOrigin}/?code=${view.code}`;
  const isPublicOrigin = !/localhost|127\.0\.0\.1/.test(inviteOrigin);

  const [copied, setCopied] = useState(false);

  const copyJoinLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
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
      /* ссылка и так видна */
    }
  };

  const EndButton = () => (
    <button
      style={{ background: 'var(--danger, #ff3355)', color: '#fff', fontSize: 14 }}
      onClick={() => controller.endGame()}
    >
      Завершить игру
    </button>
  );

  // --- Лобби ---
  if (view.phase === 'lobby') {
    const canStart = players.length >= 2 && view.tracks.length > 0;
    return (
      <div className="screen" style={{ gap: 12 }}>
        <h1 style={{ color: 'var(--neon)', textAlign: 'center', margin: 0 }}>ЧЬЁ МУЗЛО?!</h1>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Лобби-экран. Игроки подключаются по ссылке или QR со своих телефонов.
        </div>

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
            margin: '4px 0',
          }}
        >
          {view.code}
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
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ссылка-приглашение:</div>
          <div style={{ color: 'var(--neon)', fontSize: 13, wordBreak: 'break-all' }}>{joinUrl}</div>
          <button
            style={{ background: 'var(--cyan)', color: 'var(--bg)', fontSize: 15 }}
            onClick={copyJoinLink}
          >
            {copied ? 'Скопировано ✅' : '📋 Скопировать ссылку'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
          <span>Игроки: {players.length}</span>
          <span>Треков: {view.tracks.length}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>
              Ждём игроков…
            </div>
          )}
          {players.map((p) => (
            <div
              key={p.id}
              style={{ background: 'var(--surface)', borderRadius: 12, padding: 10, display: 'flex', gap: 8 }}
            >
              <span>{p.avatar}</span>
              <span style={{ flex: 1 }}>{p.nickname}</span>
              <span style={{ color: 'var(--muted)' }}>
                {view.tracks.filter((t) => t.submittedBy === p.id).length} треков
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => controller.setDuration(d)}
              style={{
                flex: 1,
                background: view.durationMinutes === d ? 'var(--neon)' : 'var(--surface)',
                color: view.durationMinutes === d ? 'var(--bg)' : 'var(--text)',
              }}
            >
              {d} мин
            </button>
          ))}
        </div>

        <button
          style={{ background: 'var(--neon)', color: 'var(--bg)', opacity: canStart ? 1 : 0.4 }}
          disabled={!canStart}
          onClick={() => controller.start()}
        >
          НАЧАТЬ ИГРУ 🚀
        </button>
        {!canStart && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Нужно 2+ игрока и хотя бы 1 трек
          </div>
        )}

        <button
          style={{ background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}
          onClick={() => window.location.reload()}
        >
          Новая комната
        </button>
      </div>
    );
  }

  // --- Прослушивание (голосуют только игроки) ---
  if (view.phase === 'playing' || view.phase === 'voting') {
    const track = view.currentTrack;
    const src = track
      ? buildIframeUrl({ type: 'track', trackId: track.trackId, albumId: track.albumId })
      : '';
    const votedSet = new Set(view.votedIds);

    return (
      <div className="screen" style={{ gap: 12 }}>
        <h1 style={{ color: 'var(--cyan)', textAlign: 'center', margin: 0 }}>КТО ЭТО СКИНУЛ? 🤔</h1>
        <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
          Раунд {view.roundIndex + 1} · игроки голосуют, пока играет трек
        </div>

        {track ? (
          <iframe
            title="Яндекс Музыка"
            src={src}
            allow="autoplay; encrypted-media"
            style={{ width: '100%', height: 190, border: 'none', borderRadius: 12 }}
          />
        ) : null}

        <a
          href={track?.url}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--neon)', textAlign: 'center', fontSize: 13 }}
        >
          ▶ Открыть трек в Яндекс Музыке (в новой вкладке)
        </a>

        <div style={{ color: 'var(--muted)', textAlign: 'center' }}>
          Проголосовало: {view.votesCount}/{players.length}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {players.map((p) => {
            const hasVoted = votedSet.has(p.id);
            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  minHeight: 92,
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
                    color: hasVoted ? 'var(--neon)' : 'var(--muted)',
                  }}
                >
                  {hasVoted ? '✅ проголосовал' : '⏳ ждём'}
                </span>
              </div>
            );
          })}
        </div>

        <button
          style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 4 }}
          onClick={() => controller.revealNow()}
        >
          Показать результат
        </button>

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

      {view.phase === 'reveal' && track?.title && (
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}>
          {track.title}
          {track.artist ? ` — ${track.artist}` : ''}
        </div>
      )}

      {view.phase === 'reveal' && view.reveal && (
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
        <button
          style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 12 }}
          onClick={() => window.location.reload()}
        >
          НОВАЯ ИГРА
        </button>
      ) : (
        <>
          <button
            style={{ background: 'var(--neon)', color: 'var(--bg)', marginTop: 12 }}
            onClick={() => controller.nextRound()}
          >
            Следующий трек →
          </button>
          <EndButton />
        </>
      )}
    </div>
  );
}
