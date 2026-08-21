import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  dayOfWeek,
  diffDays,
  fromKey,
  monthGrid,
  toKey,
  daysInMonth,
  addMonths,
} from '../js/dates.js';

import {
  completionRate,
  currentStreak,
  dayProgress,
  habitsForDay,
  isScheduledOn,
  longestStreak,
  scheduleLabel,
} from '../js/habits.js';

// --- 日付ユーティリティ ---

test('toKey はローカル時刻の日付を返す（UTC に引きずられない）', () => {
  // ローカル 23:30。UTC に変換すると地域によっては翌日になる時刻。
  assert.equal(toKey(new Date(2026, 7, 21, 23, 30)), '2026-08-21');
  // ローカル 00:30。UTC に変換すると地域によっては前日になる時刻。
  assert.equal(toKey(new Date(2026, 7, 21, 0, 30)), '2026-08-21');
});

test('fromKey と toKey は往復しても変わらない', () => {
  for (const key of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-12-31']) {
    assert.equal(toKey(fromKey(key)), key);
  }
});

test('addDays は月・年をまたいでも正しい', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // うるう年
  assert.equal(addDays('2025-02-28', 1), '2025-03-01'); // 平年
});

test('diffDays は日数差を返す', () => {
  assert.equal(diffDays('2026-08-21', '2026-08-21'), 0);
  assert.equal(diffDays('2026-09-01', '2026-08-31'), 1);
  assert.equal(diffDays('2026-08-31', '2026-09-01'), -1);
  assert.equal(diffDays('2026-08-21', '2026-07-21'), 31);
});

test('dayOfWeek は 0=日曜 で返す', () => {
  assert.equal(dayOfWeek('2026-08-21'), 5); // 金曜
  assert.equal(dayOfWeek('2026-08-23'), 0); // 日曜
});

test('daysInMonth / addMonths', () => {
  assert.equal(daysInMonth('2026-02-10'), 28);
  assert.equal(daysInMonth('2024-02-10'), 29);
  assert.equal(daysInMonth('2026-08-01'), 31);
  assert.equal(addMonths('2026-12-15', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-01');
});

test('monthGrid は7の倍数で、先頭を週開始曜日に合わせる', () => {
  const sunFirst = monthGrid('2026-08-01', 0);
  assert.equal(sunFirst.length % 7, 0);
  // 2026-08-01 は土曜なので、日曜始まりでは 6 マス空く
  assert.equal(sunFirst.slice(0, 6).every((c) => c === null), true);
  assert.equal(sunFirst[6], '2026-08-01');
  assert.equal(sunFirst.filter(Boolean).length, 31);

  const monFirst = monthGrid('2026-08-01', 1);
  assert.equal(monFirst.length % 7, 0);
  assert.equal(monFirst[5], '2026-08-01'); // 月曜始まりでは 5 マス空く
});

// --- テスト用ヘルパー ---

/**
 * 日付キーからローカル 00:00 の ISO 文字列を作る。
 * createdAt に 'Z' 付きリテラルを直接書くと、UTC より西のタイムゾーンでは
 * ローカル日付が前日にずれてテストが落ちるため、必ずこれを通す。
 */
const createdOn = (dateKey) => fromKey(dateKey).toISOString();

const daily = (overrides = {}) => ({
  id: 'h1',
  name: '読書',
  schedule: { type: 'daily' },
  createdAt: createdOn('2026-01-01'),
  ...overrides,
});

/** 日付キーの配列から logs を組み立てる */
const logsOf = (habitId, keys) => ({ [habitId]: Object.fromEntries(keys.map((k) => [k, true])) });

// --- isScheduledOn ---

test('daily は毎日が対象', () => {
  const h = daily();
  assert.equal(isScheduledOn(h, '2026-08-21'), true);
  assert.equal(isScheduledOn(h, '2026-08-23'), true);
});

test('days は指定曜日だけが対象', () => {
  const h = daily({ schedule: { type: 'days', days: [1, 3, 5] } }); // 月水金
  assert.equal(isScheduledOn(h, '2026-08-21'), true); // 金
  assert.equal(isScheduledOn(h, '2026-08-22'), false); // 土
  assert.equal(isScheduledOn(h, '2026-08-24'), true); // 月
});

// --- currentStreak ---

test('連続達成している日数を数える', () => {
  const h = daily();
  const logs = logsOf('h1', ['2026-08-19', '2026-08-20', '2026-08-21']);
  assert.equal(currentStreak(h, logs, '2026-08-21'), 3);
});

test('今日が未達成でも、まだ日が終わっていないので連鎖は切れない', () => {
  const h = daily();
  const logs = logsOf('h1', ['2026-08-19', '2026-08-20']);
  assert.equal(currentStreak(h, logs, '2026-08-21'), 2);
});

test('昨日も今日も未達成なら 0', () => {
  const h = daily();
  const logs = logsOf('h1', ['2026-08-18', '2026-08-19']);
  assert.equal(currentStreak(h, logs, '2026-08-21'), 0);
});

test('曜日指定では、対象外の曜日を挟んでも連鎖は切れない', () => {
  const h = daily({ schedule: { type: 'days', days: [1, 3, 5] } }); // 月水金
  // 2026-08-17(月) / 19(水) / 21(金)。間の火木は対象外なので飛ばす。
  const logs = logsOf('h1', ['2026-08-17', '2026-08-19', '2026-08-21']);
  assert.equal(currentStreak(h, logs, '2026-08-21'), 3);
});

test('曜日指定で対象日を落とすと連鎖が切れる', () => {
  const h = daily({ schedule: { type: 'days', days: [1, 3, 5] } });
  const logs = logsOf('h1', ['2026-08-17', '2026-08-21']); // 19(水)を落とした
  assert.equal(currentStreak(h, logs, '2026-08-21'), 1);
});

test('作成日より前は数えない', () => {
  const h = daily({ createdAt: createdOn('2026-08-20') });
  // 作成日より前にも記録があるが、数えるのは 20・21 の 2 日だけ
  const logs = logsOf('h1', ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']);
  assert.equal(currentStreak(h, logs, '2026-08-21'), 2);
});

test('記録が空なら 0', () => {
  assert.equal(currentStreak(daily(), {}, '2026-08-21'), 0);
});

test('連鎖は月をまたいでも続く', () => {
  const h = daily();
  const logs = logsOf('h1', ['2026-07-30', '2026-07-31', '2026-08-01']);
  assert.equal(currentStreak(h, logs, '2026-08-01'), 3);
});

// --- longestStreak ---

test('最長連続日数を返す', () => {
  const h = daily({ createdAt: createdOn('2026-08-01') });
  const logs = logsOf('h1', [
    '2026-08-01', '2026-08-02', // 2連続
    '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', // 4連続
    '2026-08-10',
  ]);
  assert.equal(longestStreak(h, logs, '2026-08-21'), 4);
});

test('最長連続日数は記録が無ければ 0', () => {
  const h = daily({ createdAt: createdOn('2026-08-01') });
  assert.equal(longestStreak(h, {}, '2026-08-21'), 0);
});

// --- completionRate ---

test('達成率の分母は対象日数', () => {
  const h = daily({ createdAt: createdOn('2026-08-01') });
  const logs = logsOf('h1', ['2026-08-01', '2026-08-03']);
  const r = completionRate(h, logs, '2026-08-01', '2026-08-04'); // 4日間中2日
  assert.equal(r.total, 4);
  assert.equal(r.done, 2);
  assert.equal(r.rate, 0.5);
});

test('曜日指定では対象日だけが分母に入る', () => {
  const h = daily({ schedule: { type: 'days', days: [1] }, createdAt: createdOn('2026-08-01') }); // 月曜のみ
  const logs = logsOf('h1', ['2026-08-03']); // 8/3 は月曜
  const r = completionRate(h, logs, '2026-08-01', '2026-08-14'); // 月曜は 3・10 の2回
  assert.equal(r.total, 2);
  assert.equal(r.done, 1);
  assert.equal(r.rate, 0.5);
});

test('作成日より前は分母に含めない', () => {
  const h = daily({ createdAt: createdOn('2026-08-10') });
  const r = completionRate(h, {}, '2026-08-01', '2026-08-14'); // 10〜14 の 5 日だけ
  assert.equal(r.total, 5);
});

test('対象日が 0 日なら rate は null', () => {
  const h = daily({ createdAt: createdOn('2026-09-01') });
  const r = completionRate(h, {}, '2026-08-01', '2026-08-14');
  assert.equal(r.total, 0);
  assert.equal(r.rate, null);
});

// --- 一覧と進捗 ---

test('habitsForDay はアーカイブ済み・作成前・対象外曜日を除く', () => {
  const habits = [
    daily({ id: 'a', name: '毎日' }),
    daily({ id: 'b', name: '土日のみ', schedule: { type: 'days', days: [0, 6] } }),
    daily({ id: 'c', name: 'アーカイブ', archived: true }),
    daily({ id: 'd', name: '未来に作成', createdAt: createdOn('2026-09-01') }),
  ];
  const ids = habitsForDay(habits, '2026-08-21').map((h) => h.id); // 金曜
  assert.deepEqual(ids, ['a']);
});

test('dayProgress は対象習慣に対する達成数を返す', () => {
  const habits = [daily({ id: 'a' }), daily({ id: 'b' })];
  const logs = { a: { '2026-08-21': true } };
  const p = dayProgress(habits, logs, '2026-08-21');
  assert.equal(p.done, 1);
  assert.equal(p.total, 2);
  assert.equal(p.rate, 0.5);
});

test('dayProgress は対象習慣が無ければ rate = null', () => {
  const p = dayProgress([], {}, '2026-08-21');
  assert.equal(p.total, 0);
  assert.equal(p.rate, null);
});

// --- 表示 ---

test('scheduleLabel', () => {
  const label = (d) => ['日', '月', '火', '水', '木', '金', '土'][d];
  assert.equal(scheduleLabel(daily(), label), '毎日');
  assert.equal(scheduleLabel(daily({ schedule: { type: 'days', days: [1, 3] } }), label), '月・水');
  assert.equal(
    scheduleLabel(daily({ schedule: { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] } }), label),
    '毎日',
  );
});
