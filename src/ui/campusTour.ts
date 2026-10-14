import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './campusTour.css';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';

// First-visit guided tour of the campus HUD (driver.js). It runs once per student per
// browser and can be replayed from the phone's Tour app.

const seenKey = (userId: string) => `funaab:tour:v1:${userId}`;

export function hasSeenTour(userId: string): boolean {
  try { return localStorage.getItem(seenKey(userId)) === 'done'; } catch { return false; }
}

function markTourSeen(userId: string) {
  try { localStorage.setItem(seenKey(userId), 'done'); } catch { /* private mode: tour may show again */ }
}

/** The first matching element that is actually on screen. */
function visible(...selectors: string[]): Element | undefined {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.getClientRects().length > 0) return el;
  }
  return undefined;
}

let running = false;

export function startCampusTour(userId: string, isTouch: boolean) {
  if (running) return;
  const E = ECONOMY_CONFIG;
  const G = E.GAME_DEN;

  const walk = isTouch
    ? '<b>Tap the ground</b> to walk there. <b>Drag</b> to look around. When you are near a person or place, a button appears at the bottom. Tap it to talk, buy or play.'
    : 'Walk with <b>W A S D</b> or the <b>arrow keys</b>. <b>Drag the mouse</b> to look around. Near a person or place, press <b>E</b> to talk, buy or play.';

  const candidates: Array<{ el?: Element; step: DriveStep['popover'] }> = [
    { step: { title: 'Welcome to FUNAAB Live 👋', description: `A quick look around. It takes under a minute.<br/><br/>${walk}` } },
    { el: visible('#hud-wallet'), step: { title: 'Your wallet', description: 'This is your naira. Tap it to open the bank, see your history or send money to friends.', side: 'bottom', align: 'start' } },
    { el: visible('.student-phone-button'), step: { title: 'Your phone', description: 'Everything lives here: <b>Hostel</b> (your room), <b>Jobs</b>, <b>Timetable</b>, <b>Friends</b>, <b>Messages</b> and more.', side: 'left', align: 'start' } },
    { el: visible('.student-phone-button'), step: {
      title: 'How to earn money 💰',
      description: `Open your phone and tap <b>Earn</b> for the full list with a "Take me there" button for each.<ul class="campus-tour-list">`
        + `<li><b>Jobs</b>: deliveries and errands around campus</li>`
        + `<li><b>Lectures</b>: ${formatNaira(E.ATTENDANCE_ALLOWANCE)} per class, up to ${E.ATTENDANCE_DAILY_LIMIT} a day</li>`
        + `<li><b>Daily allowance</b>: ${formatNaira(E.DAILY_RESUMPTION_ALLOWANCE)} every day</li>`
        + `<li><b>Game Den</b>: ${formatNaira(G.WINNER)} for a win, ${formatNaira(G.DRAW)} for a draw, ${formatNaira(G.LOSER)} for a loss</li>`
        + `</ul>`,
      side: 'left', align: 'start',
    } },
    { el: visible('#btn-hud-campus-map-mobile', '#btn-hud-campus-map'), step: { title: 'Campus map', description: 'Find any college, hall or shop. Pick a place and an arrow guides you there.', side: 'top', align: 'center' } },
    { el: visible('#hud-chat'), step: { title: 'Campus chat', description: 'Say hi to everyone nearby. Tap a student to add them as a friend or send a private message.', side: 'top', align: 'start' } },
    { el: visible('.campus-launcher-mini'), step: { title: 'Tell us anything', description: 'Found a bug or have an idea? Send it here. We read every message.', side: 'left', align: 'center' } },
    { step: { title: "You're ready 🎓", description: 'Go explore. You can replay this tour any time from your phone: <b>Phone → Tour</b>.' } },
  ];

  const steps: DriveStep[] = candidates
    .filter((c) => c.el || !c.step?.side)
    .map((c) => (c.el ? { element: c.el, popover: c.step } : { popover: c.step }));

  running = true;
  const tour = driver({
    steps,
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Start exploring',
    popoverClass: 'campus-tour',
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 14,
    allowClose: true,
    onDestroyed: () => { running = false; markTourSeen(userId); },
  });
  tour.drive();
}
