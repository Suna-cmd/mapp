// アプリの状態と localStorage への永続化。
// 状態は単一のオブジェクトで持ち、変更のたびに保存 + 購読者へ通知する。

import { HABIT_COLORS } from './habits.js';

const STORAGE_KEY = 'habit-tracker/v1';
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    habits: [],
    logs: {},
    settings: { theme: 'system', weekStart: 0 },
  };
}

/** 保存データを検証して正規化する。壊れた値は既定値に落として読み込みを続行する。 */
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const habits = Array.isArray(raw.habits)
    ? raw.habits.filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string').map((h) => ({
        id: h.id,
        name: h.name,
        emoji: typeof h.emoji === 'string' && h.emoji ? h.emoji : '✅',
        color: HABIT_COLORS.includes(h.color) ? h.color : HABIT_COLORS[0],
        schedule: normalizeSchedule(h.schedule),
        createdAt: typeof h.createdAt === 'string' ? h.createdAt : new Date().toISOString(),
        archived: Boolean(h.archived),
      }))
    : [];

  const habitIds = new Set(habits.map((h) => h.id));
  const logs = {};
  if (raw.logs && typeof raw.logs === 'object') {
    for (const [habitId, entries] of Object.entries(raw.logs)) {
      if (!habitIds.has(habitId) || !entries || typeof entries !== 'object') continue;
      const kept = {};
      for (const [dateKey, value] of Object.entries(entries)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && value) kept[dateKey] = true;
      }
      logs[habitId] = kept;
    }
  }

  const settings = { ...base.settings };
  if (raw.settings && typeof raw.settings === 'object') {
    if (['system', 'light', 'dark'].includes(raw.settings.theme)) settings.theme = raw.settings.theme;
    if (raw.settings.weekStart === 0 || raw.settings.weekStart === 1) settings.weekStart = raw.settings.weekStart;
  }

  return { version: SCHEMA_VERSION, habits, logs, settings };
}

function normalizeSchedule(schedule) {
  if (schedule && schedule.type === 'days') {
    const days = Array.isArray(schedule.days)
      ? [...new Set(schedule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : [];
    return days.length > 0 ? { type: 'days', days } : { type: 'daily' };
  }
  return { type: 'daily' };
}

function newId() {
  return (crypto.randomUUID?.() ?? `h${Date.now()}${Math.random().toString(16).slice(2)}`);
}

let state = defaultState();
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // 容量超過やプライベートブラウジングでも操作自体は続行させる
    console.warn('保存に失敗しました', err);
  }
  for (const fn of listeners) fn(state);
}

export function load() {
  let raw = null;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) raw = JSON.parse(text);
  } catch (err) {
    console.warn('保存データを読めませんでした', err);
  }
  state = normalize(raw);
  return state;
}

// ---- 習慣の操作 ----

export function addHabit({ name, emoji, color, schedule }) {
  const habit = {
    id: newId(),
    name: name.trim(),
    emoji: emoji || '✅',
    color: color || HABIT_COLORS[0],
    schedule: normalizeSchedule(schedule),
    createdAt: new Date().toISOString(),
    archived: false,
  };
  state = { ...state, habits: [...state.habits, habit] };
  commit();
  return habit;
}

export function updateHabit(id, patch) {
  state = {
    ...state,
    habits: state.habits.map((h) =>
      h.id === id
        ? {
            ...h,
            ...patch,
            name: (patch.name ?? h.name).trim(),
            schedule: patch.schedule ? normalizeSchedule(patch.schedule) : h.schedule,
          }
        : h,
    ),
  };
  commit();
}

export function deleteHabit(id) {
  const logs = { ...state.logs };
  delete logs[id];
  state = { ...state, habits: state.habits.filter((h) => h.id !== id), logs };
  commit();
}

/** 並び替え（ドラッグではなく上下移動ボタン用） */
export function moveHabit(id, offset) {
  const habits = [...state.habits];
  const index = habits.findIndex((h) => h.id === id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= habits.length) return;
  [habits[index], habits[next]] = [habits[next], habits[index]];
  state = { ...state, habits };
  commit();
}

// ---- 記録の操作 ----

export function toggleLog(habitId, dateKey) {
  const entries = { ...(state.logs[habitId] ?? {}) };
  if (entries[dateKey]) delete entries[dateKey];
  else entries[dateKey] = true;
  state = { ...state, logs: { ...state.logs, [habitId]: entries } };
  commit();
}

// ---- 設定 ----

export function updateSettings(patch) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  commit();
}

// ---- バックアップ ----

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

/** JSON 文字列を読み込んで状態を丸ごと置き換える。失敗時は例外を投げる。 */
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
    throw new Error('この JSON は習慣トラッカーのバックアップではないようです');
  }
  state = normalize(parsed);
  commit();
  return state;
}

export function clearAll() {
  state = defaultState();
  commit();
}
