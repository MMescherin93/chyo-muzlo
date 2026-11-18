import React, { useState } from 'react';

interface Props {
  initialCode: string;
  onJoin: (code: string, nickname: string) => void;
}

export default function Join({ initialCode, onJoin }: Props) {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');

  const canJoin = nickname.trim().length > 0 && code.trim().length === 4;

  const join = () => {
    if (!canJoin) return;
    onJoin(code.trim(), nickname.trim());
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 16 }}>
      <h1 style={{ color: 'var(--neon)', textAlign: 'center', fontSize: 42, margin: 0 }}>ЧЬЁ МУЗЛО?!</h1>

      <input
        placeholder="Код комнаты (4 цифры)"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
      />

      <input
        placeholder="Твой ник"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
      />

      <button
        style={{ background: 'var(--neon)', color: 'var(--bg)' }}
        disabled={!canJoin}
        onClick={join}
      >
        ВОЙТИ
      </button>
    </div>
  );
}
