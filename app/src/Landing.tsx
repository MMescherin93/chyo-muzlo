import React from 'react';

interface Props {
  onCreate: () => void;
  onJoin: () => void;
}

export default function Landing({ onCreate, onJoin }: Props) {
  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 16 }}>
      <h1 style={{ color: 'var(--neon)', textAlign: 'center', fontSize: 46, margin: 0 }}>
        ЧЬЁ МУЗЛО?!
      </h1>
      <div style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>
        Парти-игра про музыкальные вкусы друзей
      </div>

      <button style={{ background: 'var(--pink)', color: 'var(--bg)' }} onClick={onCreate}>
        🎛️ СОЗДАТЬ ИГРУ (хост)
      </button>
      <button style={{ background: 'var(--neon)', color: 'var(--bg)' }} onClick={onJoin}>
        🎧 ВОЙТИ ПО КОДУ (гость)
      </button>
    </div>
  );
}
