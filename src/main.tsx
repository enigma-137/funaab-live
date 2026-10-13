import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeTraceIQ } from './lib/traceiq';
import { installAudioUnlock, gameSound } from './game/audio/gameAudio';
import { useWalletStore } from './stores/walletStore';

initializeTraceIQ();
installAudioUnlock();
// A soft coin when money lands in the wallet (not for the initial balance load).
const audioReadyAt = Date.now() + 4000;
useWalletStore.subscribe((s, prev) => {
  if (Date.now() > audioReadyAt && s.balance > prev.balance) gameSound.coin();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
