// Invite to earn: share your link, get paid when a friend signs up with it, and again when they
// reach the unlock level. Mirrored by migrations 056 and 057 (the database is the authority; scripts/test-invites-db.ts checks drift).

export const INVITES = {
  /** Paid to the inviter as soon as the student they invited signs up. */
  JOIN_REWARD: 10000,
  /** Paid to the inviter when that student reaches UNLOCK_LEVEL. */
  LEVEL_REWARD: 5000,
  UNLOCK_LEVEL: 2,
  /** Most paid invites per student. */
  MAX_PAID: 20,
  /** A new account can use an invite link for this many days after joining. */
  REDEEM_DAYS: 7,
  /** ?invite=CODE */
  PARAM: 'invite',
} as const;

const CODE = /^[A-Z2-9]{6}$/;
export const normalizeInviteCode = (raw: string | null | undefined) => {
  const c = String(raw ?? '').trim().toUpperCase();
  return CODE.test(c) ? c : null;
};

export const inviteLink = (code: string, origin = typeof window !== 'undefined' ? window.location.origin : '') =>
  `${origin}/?${INVITES.PARAM}=${code}`;
