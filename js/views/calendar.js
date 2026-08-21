// カレンダータブ: 習慣を1つ選んで、その月の達成状況を見る／過去日を記録する。

import { el, emptyState, haptic, icon, ICON_PATHS } from '../ui.js';
import { completionRate, isDone, isScheduledOn, startKey } from '../habits.js';
import { toggleLog } from '../store.js';
import {
  addDays,
  addMonths,
  diffDays,
  formatMonth,
  monthGrid,
  startOfMonth,
  todayKey,
  weekdayLabels,
} from '../dates.js';
import { openHabitEditor } from './editor.js';

// タブを離れても選択とスクロール位置を保つため、ビュー間で持ち回る状態
const viewState = {
  habitId: null,
  month: null, // 'YYYY-MM-01'
};

function habitPicker(habits, selected, onSelect) {
  return el(
    'div',
    { class: 'picker', role: 'group', 'aria-label': '習慣を選択' },
    habits.map((h) =>
      el('button', {
        class: 'picker__item',
        type: 'button',
        style: { '--habit-color': h.color },
        'aria-pressed': String(h.id === selected.id),
        text: `${h.emoji} ${h.name}`,
        onclick: () => onSelect(h.id),
      }),
    ),
  );
}

function monthNav(month, canGoNext, onChange) {
  return el('div', { class: 'month-nav' }, [
    el(
      'button',
      {
        class: 'month-nav__btn',
        type: 'button',
        'aria-label': '前の月',
        onclick: () => onChange(addMonths(month, -1)),
      },
      [icon(ICON_PATHS.chevronLeft, { width: 20 })],
    ),
    el('span', { class: 'month-nav__label', text: formatMonth(month), 'aria-live': 'polite' }),
    el(
      'button',
      {
        class: 'month-nav__btn',
        type: 'button',
        'aria-label': '次の月',
        disabled: !canGoNext,
        onclick: () => onChange(addMonths(month, 1)),
      },
      [icon(ICON_PATHS.chevronRight, { width: 20 })],
    ),
  ]);
}

function calendarCard(habit, logs, month, weekStart, today, rerender) {
  const created = startKey(habit);
  const cells = monthGrid(month, weekStart);

  const grid = el(
    'div',
    { class: 'calendar__grid' },
    cells.map((key) => {
      if (!key) return el('div', { class: 'day day--blank' });

      const scheduled = isScheduledOn(habit, key);
      const done = isDone(logs, habit.id, key);
      const isFuture = diffDays(key, today) > 0;
      const beforeStart = created ? diffDays(key, created) < 0 : false;
      const day = Number(key.slice(8));

      const classes = ['day'];
      if (!scheduled) classes.push('day--off');
      if (done) classes.push('day--done');
      if (key === today) classes.push('day--today');

      return el('button', {
        class: classes.join(' '),
        type: 'button',
        text: String(day),
        // 未来と記録開始前は押せない。対象外の曜日でも、後から補って記録できるようにしておく。
        disabled: isFuture || beforeStart,
        'aria-pressed': String(done),
        'aria-label': `${day}日${done ? ' 達成済み' : ''}`,
        onclick: () => {
          haptic();
          toggleLog(habit.id, key);
          rerender();
        },
      });
    }),
  );

  return el('section', { class: 'card calendar', style: { '--habit-color': habit.color } }, [
    el(
      'div',
      { class: 'calendar__weekdays', 'aria-hidden': 'true' },
      weekdayLabels(weekStart).map((label) => el('div', { class: 'calendar__weekday', text: label })),
    ),
    grid,
    el('div', { class: 'calendar__legend' }, [
      el('span', {}, [el('i', { class: 'legend-swatch legend-swatch--done' }), '達成']),
      el('span', {}, [el('i', { class: 'legend-swatch' }), '未達成']),
      el('span', {}, [el('i', { class: 'legend-swatch legend-swatch--today' }), '今日']),
    ]),
  ]);
}

export function renderCalendar(state, rerender) {
  const today = todayKey();
  const active = state.habits.filter((h) => !h.archived);

  const header = {
    title: 'カレンダー',
    subtitle: '過去の日をタップして記録できます',
    action: { label: '習慣を追加', icon: ICON_PATHS.plus, onClick: () => openHabitEditor() },
  };

  if (active.length === 0) {
    return {
      header,
      body: [
        emptyState({
          emoji: '📅',
          title: 'まだ習慣がありません',
          body: '習慣を追加すると、その達成状況が月ごとのカレンダーに表示されます。',
          action: { label: '習慣を追加', onClick: () => openHabitEditor() },
        }),
      ],
    };
  }

  // 選択中の習慣が削除されていたら先頭に戻す
  const habit = active.find((h) => h.id === viewState.habitId) ?? active[0];
  viewState.habitId = habit.id;
  const month = viewState.month ?? startOfMonth(today);
  viewState.month = month;

  const thisMonth = startOfMonth(today);
  const canGoNext = diffDays(month, thisMonth) < 0;

  // 集計は月末まで。ただし今月はまだ来ていない日を分母に入れないよう今日で打ち切る。
  const monthEnd = addDays(addMonths(month, 1), -1);
  const rate = completionRate(habit, state.logs, month, diffDays(monthEnd, today) > 0 ? today : monthEnd);

  const setHabit = (id) => {
    viewState.habitId = id;
    rerender();
  };
  const setMonth = (next) => {
    viewState.month = next;
    rerender();
  };

  return {
    header,
    body: [
      habitPicker(active, habit, setHabit),
      monthNav(month, canGoNext, setMonth),
      calendarCard(habit, state.logs, month, state.settings.weekStart, today, rerender),
      el('p', {
        class: 'about',
        text:
          rate.total === 0
            ? 'この月に対象日はありません'
            : `この月の達成: ${rate.done} / ${rate.total} 日（${Math.round(rate.rate * 100)}%）`,
      }),
    ],
  };
}
