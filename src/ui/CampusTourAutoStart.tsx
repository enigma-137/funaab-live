import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useInputStore } from '../stores/inputStore';
import { hasSeenTour, startCampusTour } from './campusTour';

/** Starts the guided tour on a student's first visit, once the campus is on screen and nothing is open. */
export function CampusTourAutoStart({ userId }: { userId: string }) {
  const modalOpen = useGameStore((s) => s.activeModal !== null);
  const onCampus = useHostelStore((s) => s.roomId === 'world:funaab:main');

  useEffect(() => {
    if (modalOpen || !onCampus || hasSeenTour(userId)) return;
    // Poll until the HUD is up (the 3D world may still be loading) so the tour has something to point at.
    let ready = 0;
    const timer = window.setInterval(() => {
      if (!document.querySelector('#hud-wallet') || useGameStore.getState().activeModal) { ready = 0; return; }
      if (++ready < 2) return; // let it settle for a moment first
      window.clearInterval(timer);
      const input = useInputStore.getState();
      input.setMobileTutorialDismissed(true);
      startCampusTour(userId, input.isTouchDevice);
    }, 900);
    return () => window.clearInterval(timer);
  }, [userId, modalOpen, onCampus]);

  return null;
}
