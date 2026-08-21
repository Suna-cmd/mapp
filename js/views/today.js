// 今日タブ: 今日の対象習慣の一覧とトグル。

import { el, emptyState, haptic, icon, ICON_PATHS } from '../ui.js';
import { currentStreak, dayProgress, habitsForDay, isDone, scheduleLabel } from '../habits.js';
import { toggleLog } from '../store.js';
import { formatDate, todayKey, weekdayLabel } from '../dates.js';
import { openHabitEditor } from './editor.js';

/** 達成状況に応じた一言 */
function headline(progress) {
  if (progress.total === 0) return '今日は予定なし';
  if (progress.done === progress.total) return '今日は全部達成！';
  if (progress.done === 0) return 'まだこれからです';
  return `あと ${progress.total - progress.done} つ`;
}

function summaryCard(progress) {
  const pct = progress.rate === null ? 0 : Math.round(progress.rate * 100);
  return el('section', { class: 'card summary' }, [
    el('div', { class: 'ring', style: { '--pct': String(pct) }, role: 'img', 'aria-label': `達成率 ${pct}パーセント` }, [
      el('span', { class: 'ring__label', text: `${pct}%` }),
    ]),
    el('div', { class: 'summary__text' }, [
      el('p', { class: 'summary__headline', text: headline(progress) }),
      el('p', {
        class: 'summary__note',
        text:
          progress.total === 0
            ? '今日が対象の習慣はありません'
            : `${progress.total} 件中 ${progress.done} 件を達成`,
      }),
    ]),
  ]);
}

function habitRow(habit, logs, dateKey) {
  const done = isDone(logs, habit.id, dateKey);
  const streak = currentStreak(habit, logs, dateKey);

  // 長押しで編集。押している間にスクロールされたらキャンセルする。
  let pressTimer = null;
  let longPressed = false;
  const startPress = () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      haptic(18);
      openHabitEditor(habit);
    }, 500);
  };
  const cancelPress = () => clearTimeout(pressTimer);

  return el(
    'button',
    {
      class: `habit${done ? ' habit--done' : ''}`,
      type: 'button',
      style: { '--habit-color': habit.color },
      'aria-pressed': String(done),
      onclick: () => {
        // 長押しで編集シートを開いた直後の click は無視する
        if (longPressed) {
          longPressed = false;
          return;
        }
        haptic();
        toggleLog(habit.id, dateKey);
      },
      onpointerdown: startPress,
      onpointerup: cancelPress,
      onpointercancel: cancelPress,
      onpointerleave: cancelPress,
      oncontextmenu: (e) => e.preventDefault(), // 長押しのシステムメニューを抑制
    },
    [
      el('span', { class: 'habit__emoji', text: habit.emoji, 'aria-hidden': 'true' }),
      el('span', { class: 'habit__body' }, [
        el('span', { class: 'habit__name', text: habit.name }),
        el('span', { class: 'habit__meta' }, [
          el('span', { text: scheduleLabel(habit, weekdayLabel) }),
          streak > 0 && el('span', { class: 'habit__streak', text: `🔥 ${streak}日連続` }),
        ]),
      ]),
      el('span', { class: 'habit__check', 'aria-hidden': 'true' }, [icon(ICON_PATHS.check, { width: 17 })]),
    ],
  );
}

export function renderToday(state) {
  const key = todayKey();
  const targets = habitsForDay(state.habits, key);
  const progress = dayProgress(state.habits, state.logs, key);
  const activeCount = state.habits.filter((h) => !h.archived).length;

  const header = {
    title: '今日',
    subtitle: formatDate(key),
    action: {
      label: '習慣を追加',
      icon: ICON_PATHS.plus,
      onClick: () => openHabitEditor(),
    },
  };

  if (activeCount === 0) {
    return {
      header,
      body: [
        emptyState({
          emoji: '🌱',
          title: 'まずは習慣をひとつ',
          body: '続けたいことを登録すると、毎日のチェックと連続日数がここに並びます。',
          action: { label: '習慣を追加', onClick: () => openHabitEditor() },
        }),
      ],
    };
  }

  const body = [summaryCard(progress)];

  if (targets.length === 0) {
    body.push(
      emptyState({
        emoji: '🛌',
        title: '今日は休みの日',
        body: '今日が対象の習慣はありません。曜日の設定は各習慣の編集画面から変えられます。',
      }),
    );
  } else {
    body.push(
      el('h2', { class: 'section-title', text: 'きょうやること' }),
      el('div', { class: 'habit-list' }, targets.map((h) => habitRow(h, state.logs, key))),
      el('p', {
        class: 'about',
        text: 'カードをタップで達成、長押しで編集できます。',
      }),
    );
  }

  return { header, body };
}
