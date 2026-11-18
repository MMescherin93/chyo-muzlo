import React, { useState } from 'react';
import Landing from './Landing';
import HostApp from './host/HostApp';
import GuestApp from './guest/GuestApp';

type Mode = 'landing' | 'host' | 'guest';

export default function App() {
  // Если в ссылке есть ?code= — сразу входим как гость (по QR хоста).
  const hasCode = !!new URLSearchParams(location.search).get('code');
  const [mode, setMode] = useState<Mode>(hasCode ? 'guest' : 'landing');

  if (mode === 'host') return <HostApp />;
  if (mode === 'guest') return <GuestApp />;
  return <Landing onCreate={() => setMode('host')} onJoin={() => setMode('guest')} />;
}
