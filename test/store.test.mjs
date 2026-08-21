import { test } from 'node:test';
import assert from 'node:assert/strict';

// store.js はブラウザの localStorage を前提にしているので、最小限のスタブを用意する。
// import より前に置く必要があるため、動的 import を使う。
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

const store = await import('../js/store.js');

function reset() {
  memory.clear();
  store.load();
}

test('保存データが無ければ既定の状態になる', () => {
  reset();
  const state = store.getState();
  assert.deepEqual(state.habits, []);
  assert.deepEqual(state.logs, {});
  assert.equal(state.settings.theme, 'system');
  assert.equal(state.settings.weekStart, 0);
});

test('習慣を追加すると localStorage に保存され、読み直しても残る', () => {
  reset();
  store.addHabit({ name: '  読書  ', emoji: '📖', color: '#60a5fa', schedule: { type: 'daily' } });
  assert.equal(store.getState().habits.length, 1);
  // 名前の前後の空白は落とす
  assert.equal(store.getState().habits[0].name, '読書');

  store.load(); // 保存済みデータから読み直す
  assert.equal(store.getState().habits.length, 1);
  assert.equal(store.getState().habits[0].name, '読書');
});

test('記録のトグルは往復する', () => {
  reset();
  const h = store.addHabit({ name: '読書', schedule: { type: 'daily' } });
  store.toggleLog(h.id, '2026-08-21');
  assert.equal(store.getState().logs[h.id]['2026-08-21'], true);
  store.toggleLog(h.id, '2026-08-21');
  assert.equal(store.getState().logs[h.id]['2026-08-21'], undefined);
});

test('習慣を削除するとその記録も消える', () => {
  reset();
  const h = store.addHabit({ name: '読書', schedule: { type: 'daily' } });
  store.toggleLog(h.id, '2026-08-21');
  store.deleteHabit(h.id);
  assert.equal(store.getState().habits.length, 0);
  assert.equal(store.getState().logs[h.id], undefined);
});

test('moveHabit は並びを入れ替え、端では何もしない', () => {
  reset();
  const a = store.addHabit({ name: 'A', schedule: { type: 'daily' } });
  const b = store.addHabit({ name: 'B', schedule: { type: 'daily' } });
  store.moveHabit(b.id, -1);
  assert.deepEqual(store.getState().habits.map((h) => h.name), ['B', 'A']);
  store.moveHabit(b.id, -1); // すでに先頭
  assert.deepEqual(store.getState().habits.map((h) => h.name), ['B', 'A']);
  assert.deepEqual(
    store.getState().habits.map((h) => h.id),
    [b.id, a.id],
  );
});

test('書き出したバックアップを読み込むと元の状態に戻る', () => {
  reset();
  const h = store.addHabit({ name: '読書', emoji: '📖', color: '#60a5fa', schedule: { type: 'days', days: [1, 3] } });
  store.toggleLog(h.id, '2026-08-19');
  store.toggleLog(h.id, '2026-08-17');
  store.updateSettings({ theme: 'dark', weekStart: 1 });

  const backup = store.exportJSON();

  store.clearAll();
  assert.equal(store.getState().habits.length, 0);

  const restored = store.importJSON(backup);
  assert.equal(restored.habits.length, 1);
  assert.equal(restored.habits[0].name, '読書');
  assert.deepEqual(restored.habits[0].schedule, { type: 'days', days: [1, 3] });
  assert.deepEqual(Object.keys(restored.logs[h.id]).sort(), ['2026-08-17', '2026-08-19']);
  assert.equal(restored.settings.theme, 'dark');
  assert.equal(restored.settings.weekStart, 1);
});

test('習慣トラッカーのバックアップでない JSON は弾く', () => {
  reset();
  assert.throws(() => store.importJSON('{"foo":1}'), /バックアップではない/);
  assert.throws(() => store.importJSON('こわれた'), SyntaxError);
});

test('壊れた保存データでも落ちずに読み込める', () => {
  memory.clear();
  memory.set(
    'habit-tracker/v1',
    JSON.stringify({
      habits: [
        { id: 'ok', name: '正常', emoji: '📖', color: '#60a5fa', schedule: { type: 'daily' } },
        { id: 42, name: 'IDが数値' }, // 捨てられる
        { name: 'IDなし' }, // 捨てられる
        null,
      ],
      logs: {
        ok: { '2026-08-21': true, 'not-a-date': true, '2026-08-20': false },
        ghost: { '2026-08-21': true }, // 存在しない習慣の記録
      },
      settings: { theme: 'neon', weekStart: 9 }, // 不正値は既定に落とす
    }),
  );
  const state = store.load();

  assert.equal(state.habits.length, 1);
  assert.equal(state.habits[0].name, '正常');
  // createdAt が無くても補完される
  assert.equal(typeof state.habits[0].createdAt, 'string');
  assert.deepEqual(Object.keys(state.logs.ok), ['2026-08-21']);
  assert.equal(state.logs.ghost, undefined);
  assert.equal(state.settings.theme, 'system');
  assert.equal(state.settings.weekStart, 0);
});

test('曜日が空の schedule は毎日に落とす', () => {
  reset();
  const h = store.addHabit({ name: 'X', schedule: { type: 'days', days: [] } });
  assert.deepEqual(h.schedule, { type: 'daily' });
});

test('不正な曜日は取り除いて重複も潰す', () => {
  reset();
  const h = store.addHabit({ name: 'X', schedule: { type: 'days', days: [1, 1, 9, -2, 3, 'x'] } });
  assert.deepEqual(h.schedule, { type: 'days', days: [1, 3] });
});

test('subscribe は変更のたびに呼ばれ、解除できる', () => {
  reset();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.addHabit({ name: 'A', schedule: { type: 'daily' } });
  assert.equal(calls, 1);
  off();
  store.addHabit({ name: 'B', schedule: { type: 'daily' } });
  assert.equal(calls, 1);
});
