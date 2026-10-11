export const LIBRARY_ROOM = "world:funaab:library";
export const LIBRARY_HOURS =
  "Monday–Friday, 8am–5pm (Lagos time). Closed Saturdays and Sundays.";
// Lagos is UTC+1 all year. UTC accessors make this independent of device timezone.
export function isLibraryOpen(now = Date.now()): boolean {
  const local = new Date(now + 60 * 60 * 1000);
  return (
    local.getUTCDay() >= 1 &&
    local.getUTCDay() <= 5 &&
    local.getUTCHours() >= 8 &&
    local.getUTCHours() < 17
  );
}
