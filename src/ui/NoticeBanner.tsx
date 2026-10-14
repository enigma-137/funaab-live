import React, { useEffect } from 'react';
import { useNoticeStore } from '../stores/noticeStore';
import { announcementActive } from '../config/broadcast';
import { SugBanner } from './SugSheet';

/** The owner's announcement (sent from Telegram) and the "new version" prompt. */
export function NoticeBanner() {
  const { announcement, dismissedId, updateReady, load, dismiss, checkVersion } = useNoticeStore();
  useEffect(() => {
    void load(); void checkVersion();
    const t = setInterval(() => { void load(); void checkVersion(); }, 180000);
    const visible = () => { if (document.visibilityState === 'visible') { void load(); void checkVersion(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', visible); };
  }, [load, checkVersion]);
  const showNotice = announcementActive(announcement) && announcement!.id !== dismissedId;
  return (
    <div className="notice-stack">
      {updateReady && (
        <div className="notice-banner is-update" role="status">
          <span>✨ <b>A new version of FUNAAB Life is ready.</b> Refresh to get the latest features.</span>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
      {showNotice && (
        <div className="notice-banner" role="status">
          <span>📣 {announcement!.text}</span>
          <button aria-label="Dismiss announcement" onClick={dismiss}>✕</button>
        </div>
      )}
      <SugBanner />
    </div>
  );
}
