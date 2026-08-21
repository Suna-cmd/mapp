// 習慣ドメインのロジック。すべて副作用のない純関数で、DOM にも localStorage にも触れない。
// （test/habits.test.mjs から直接 import してテストする）

import { addDays, dayOfWeek, diffDays, toKey } from './dates.js';

// 走査の暴走を防ぐ上限（約13年ぶん）。個人利用の範囲では十分。
const MAX_SCAN_DAYS = 5000;

export const HABIT_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#4ade80', // green
  '#2dd4bf', // teal
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
];

/** 習慣の記録開始日（作成日）を日付キーで返す */
export function startKey(habit) {
  if (!habit.createdAt) return null;
  const date = new Date(habit.createdAt);
  return Number.isNaN(date.getTime()) ? null : toKey(date);
}

/** その日がこの習慣の対象日か */
export function isScheduledOn(habit, dateKey) {
  const schedule = habit.schedule ?? { type: 'daily' };
  if (schedule.type === 'days') {
    return (schedule.days ?? []).includes(dayOfWeek(dateKey));
  }
  return true; // 'daily'
}

/** その日が記録済みか */
export function isDone(logs, habitId, dateKey) {
  return Boolean(logs?.[habitId]?.[dateKey]);
}

/**
 * 現在の連続日数。
 * - 対象外の曜日は連鎖を切らずに読み飛ばす
 * - 今日がまだ未達成でも、その日はまだ終わっていないので連鎖は切らない（前日から数える）
 * - 習慣の作成日より前は数えない
 */
export function currentStreak(habit, logs, todayKey) {
  const done = (key) => isDone(logs, habit.id, key);
  const created = startKey(habit);

  let cursor = todayKey;
  if (isScheduledOn(habit, cursor) && !done(cursor)) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    if (created && diffDays(cursor, created) < 0) break;
    if (isScheduledOn(habit, cursor)) {
      if (!done(cursor)) break;
      streak++;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 過去最長の連続日数（作成日から今日まで走査する） */
export function longestStreak(habit, logs, todayKey) {
  const created = startKey(habit);
  const from = created ?? earliestLogKey(logs, habit.id) ?? todayKey;
  const span = Math.min(diffDays(todayKey, from), MAX_SCAN_DAYS);
  if (span < 0) return 0;

  let best = 0;
  let run = 0;
  for (let i = 0; i <= span; i++) {
    const key = addDays(from, i);
    if (!isScheduledOn(habit, key)) continue;
    if (isDone(logs, habit.id, key)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** 記録のうち最も古い日付キー（無ければ null） */
export function earliestLogKey(logs, habitId) {
  const keys = Object.keys(logs?.[habitId] ?? {});
  if (keys.length === 0) return null;
  return keys.sort()[0];
}

/**
 * 期間内の達成率。分母は「対象日のうち、作成日以降かつ from〜to に入る日数」。
 * 対象日が 0 日なら { done: 0, total: 0, rate: null } を返す。
 */
export function completionRate(habit, logs, fromKey_, toKey_) {
  const created = startKey(habit);
  let from = fromKey_;
  if (created && diffDays(created, from) > 0) from = created;

  const span = diffDays(toKey_, from);
  if (span < 0) return { done: 0, total: 0, rate: null };

  let total = 0;
  let done = 0;
  for (let i = 0; i <= Math.min(span, MAX_SCAN_DAYS); i++) {
    const key = addDays(from, i);
    if (!isScheduledOn(habit, key)) continue;
    total++;
    if (isDone(logs, habit.id, key)) done++;
  }
  return { done, total, rate: total === 0 ? null : done / total };
}

/** 今日が対象の習慣だけを返す（アーカイブ済みは除外） */
export function habitsForDay(habits, dateKey) {
  return habits.filter((h) => {
    if (h.archived) return false;
    const created = startKey(h);
    if (created && diffDays(dateKey, created) < 0) return false;
    return isScheduledOn(h, dateKey);
  });
}

/** その日の達成状況 { done, total, rate } */
export function dayProgress(habits, logs, dateKey) {
  const target = habitsForDay(habits, dateKey);
  const done = target.filter((h) => isDone(logs, h.id, dateKey)).length;
  return {
    done,
    total: target.length,
    rate: target.length === 0 ? null : done / target.length,
  };
}

/** スケジュールの表示用文字列 */
export function scheduleLabel(habit, weekdayLabelFn) {
  const schedule = habit.schedule ?? { type: 'daily' };
  if (schedule.type !== 'days') return '毎日';
  const days = [...(schedule.days ?? [])].sort((a, b) => a - b);
  if (days.length === 0) return '対象日なし';
  if (days.length === 7) return '毎日';
  return days.map(weekdayLabelFn).join('・');
}
