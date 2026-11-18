import React from 'react';
import { buildIframeUrl } from '@muzlo/shared';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
}

export default function Reveal({ room }: Props) {
  const track = room.currentTrack;
  const src = track
    ? buildIframeUrl({ type: 'track', trackId: track.trackId, albumId: track.albumId })
    : '';

  const standings = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <div className="screen" style={{ gap: 12 }}>
      <h1 style={{ color: 'var(--pink)', textAlign: 'center', margin: 0 }}>РАЗГАДКА 🎉</h1>

      {track && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
          <iframe
            title="Трек"
            src={src}
            allow="autoplay; encrypted-media"
            style={{ width: '100%', height: 180, border: 'none', pointerEvents: 'none' }}
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
              padding: '6px 8px',
              pointerEvents: 'none',
            }}
          >
            🔒 Плеером управляет хост
          </div>
        </div>
      )}

      {track?.title && (
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}>
          {track.title}
          {track.artist ? ` — ${track.artist}` : ''}
        </div>
      )}

      {room.reveal && (
        <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, color: 'var(--neon)', fontWeight: 700 }}>
          {room.reveal.comment}
        </div>
      )}

      <div style={{ color: 'var(--muted)' }}>Счёт</div>
      {standings.map((p, i) => (
        <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, display: 'flex', gap: 8 }}>
          <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>{i + 1}.</span>
          <span style={{ flex: 1 }}>{p.avatar} {p.nickname}</span>
          <span style={{ color: 'var(--neon)', fontWeight: 900 }}>{p.score}</span>
        </div>
      ))}
    </div>
  );
}
