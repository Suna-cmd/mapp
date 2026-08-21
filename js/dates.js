// ローカルタイムゾーンでの日付ユーティリティ。
// 日付キーはすべて 'YYYY-MM-DD' 形式の文字列で扱う。
// toISOString() は UTC に変換されて日付が1日ずれるため、この場では一切使わない。

/** Date -> 'YYYY-MM-DD'（ローカル時刻基準） */
export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> Date（ローカル 00:00:00） */
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今日の日付キー */
export function todayKey() {
  return toKey(new Date());
}

/** 日付キーに n 日足した日付キー（負数で過去へ） */
export function addDays(key, n) {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

/** 日付キーの曜日（0=日曜 … 6=土曜） */
export function dayOfWeek(key) {
  return fromKey(key).getDay();
}

/** a と b の日数差（a - b）。同日なら 0 */
export function diffDays(a, b) {
  const ms = fromKey(a).getTime() - fromKey(b).getTime();
  // DST のある地域では 24h ちょうどにならない日があるので四捨五入する
  return Math.round(ms / 86400000);
}

/** その月の1日の日付キー */
export function startOfMonth(key) {
  const [y, m] = key.split('-');
  return `${y}-${m}-01`;
}

/** n ヶ月ずらした月の1日（日付は 1 に丸める） */
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return toKey(date);
}

/** その月の日数 */
export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 週の開始曜日を考慮した曜日ラベルの並び */
export function weekdayLabels(weekStart = 0) {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(i + weekStart) % 7]);
}

/** 単独の曜日ラベル */
export function weekdayLabel(dow) {
  return WEEKDAY_LABELS[dow];
}

/** '2026年8月' のような表示用文字列 */
export function formatMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return `${y}年${m}月`;
}

/** '8月21日(金)' のような表示用文字列 */
export function formatDate(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${m}月${d}日(${WEEKDAY_LABELS[dayOfWeek(key)]})`;
}

/**
 * カレンダーグリッド用に、月の日付を週開始曜日に合わせて並べる。
 * 前後の月にはみ出すマスは null で埋める。
 */
export function monthGrid(monthKey, weekStart = 0) {
  const first = startOfMonth(monthKey);
  const total = daysInMonth(first);
  const lead = (dayOfWeek(first) - weekStart + 7) % 7;
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) {
    cells.push(addDays(first, d - 1));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
