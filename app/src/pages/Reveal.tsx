import React from 'react';
import { buildEmbedHtml } from '@muzlo/shared';
import type { RoomView } from '../room-view';

interface Props {
  room: RoomView;
}

export default function Reveal({ room }: Props) {
  const track = room.currentTrack;
  const embed = track
    ? buildEmbedHtml({ type: 'track', trackId: track.trackId, albumId: track.albumId })
    : '';

  const standings = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <div className="screen" style={{ gap: 12 }}>
      <h1 style={{ color: 'var(--pink)', textAlign: 'center', margin: 0 }}>РАЗГАДКА 🎉</h1>

      {track && (
        <div
          style={{ borderRadius: 12, overflow: 'hidden', height: 180 }}
          dangerouslySetInnerHTML={{ __html: embed }}
        />
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
