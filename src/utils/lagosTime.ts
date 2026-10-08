/**
 * FUNAAB Campus Time Helper (Africa/Lagos - West Africa Time, UTC+1)
 * Standardizes all academic timetable and campus clocks across client and server.
 */

export interface LagosTimeInfo {
  date: Date;
  hour: number;        // 0-23
  minute: number;      // 0-59
  second: number;      // 0-59
  dayOfWeek: number;   // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isWeekend: boolean;  // Saturday or Sunday
  isAcademicHours: boolean; // Monday-Friday, 09:00 to 17:00 WAT
  timeString: string;  // e.g. "01:45 PM WAT"
  timestampMs: number;
}

export function getLagosTime(inputDate: Date | number = Date.now()): LagosTimeInfo {
  const dateObj = typeof inputDate === 'number' ? new Date(inputDate) : inputDate;
  const timestampMs = dateObj.getTime();

  // Africa/Lagos is UTC+1 (no daylight saving time)
  // Calculate UTC time + 1 hour offset in milliseconds
  const utcMs = timestampMs + dateObj.getTimezoneOffset() * 60000;
  const lagosMs = utcMs + 3600000; // +1 hour
  const lagosDate = new Date(lagosMs);

  const hour = lagosDate.getUTCHours();
  const minute = lagosDate.getUTCMinutes();
  const second = lagosDate.getUTCSeconds();
  const dayOfWeek = lagosDate.getUTCDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isAcademicHours = !isWeekend && hour >= 9 && hour < 17;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const timeString = `${pad(displayHour)}:${pad(minute)} ${ampm} WAT`;

  return {
    date: lagosDate,
    hour,
    minute,
    second,
    dayOfWeek,
    isWeekend,
    isAcademicHours,
    timeString,
    timestampMs,
  };
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(mins)}:${pad(secs)}`;
}
