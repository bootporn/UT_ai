import { addCalendarDays, moscowToday } from "./text.js";

export const KILL_AFTER_DAYS = 42;

export function assessKill({ launchedAt, realCount, now = new Date() }) {
  if (!launchedAt) {
    return {
      clockStarted: false,
      shouldStop: false,
      realCount,
      launchedAt: null,
      deadline: null,
      today: moscowToday(now),
    };
  }
  const deadline = addCalendarDays(launchedAt, KILL_AFTER_DAYS);
  const today = moscowToday(now);
  return {
    clockStarted: true,
    shouldStop: today >= deadline && realCount === 0,
    realCount,
    launchedAt,
    deadline,
    today,
  };
}

export function earlierDate(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return left < right ? left : right;
}
