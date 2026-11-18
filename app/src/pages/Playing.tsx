import React from 'react';
import { buildIframeUrl } from '@muzlo/shared';
import type { RoomView } from '../room-view';

/**
 * Экран гостя во время раунда: видит превью трека (обложка/название),
 * но управлять плеером может только хост.
 */
export default function Playing({ room }: { room: RoomView }) {
  const track = room.currentTrack;
  const src = track
    ? buildIframeUrl({ type: 'track', trackId: track.trackId, albumId: track.albumId })
    : '';

  return (
    <div className="screen" style={{ gap: 12, justifyContent: 'center' }}>
      <h1 style={{ color: 'var(--cyan)', textAlign: 'center', margin: 0 }}>СЛУШАЕМ 🎧</h1>
      <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>
        Трек играет у хоста. Плеером управляет только он.
      </div>

      {track && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
          <iframe
            title="Превью трека"
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
        <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
          {track.title}
          {track.artist ? ` — ${track.artist}` : ''}
        </div>
      )}
    </div>
  );
}
