import React from 'react';
import HostApp from './host/HostApp';
import GuestApp from './guest/GuestApp';

/**
 * Корень приложения — это лобби-экран хоста (как в Jackbox).
 * Гости попадают в игровой режим только по ссылке-приглашению `?code=...`.
 */
export default function App() {
  const hasCode = !!new URLSearchParams(location.search).get('code');

  if (hasCode) {
    return <GuestApp onExit={() => window.location.reload()} />;
  }
  return <HostApp />;
}
