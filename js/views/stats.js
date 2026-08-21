// 統計タブ: 習慣ごとの連続日数・達成率と、直近14日のミニ棒グラフ。

import { el, emptyState, ICON_PATHS } from '../ui.js';
import {
  completionRate,
  currentStreak,
  isDone,
  isScheduledOn,
  longestStreak,
  scheduleLabel,
} from '../habits.js';
import { addDays, todayKey, weekdayLabel } from '../dates.js';
import { openHabitEditor } from './editor.js';

const SPARK_DAYS = 14;

function stat(value, unit, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__value' }, [String(value), el('span', { class: 'stat__unit', text: unit })]),
    el('div', { class: 'stat__label', text: label }),
  ]);
}

/** 直近14日の達成状況。対象外の曜日は点線で表す。 */
function spark(habit, logs, today) {
  const bars = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    const scheduled = isScheduledOn(habit, key);
    const done = isDone(logs, habit.id, key);
    const classes = ['spark__bar'];
    if (!scheduled) classes.push('spark__bar--off');
    else if (done) classes.push('spark__bar--done');
    bars.push(
      el('div', {
        class: classes.join(' '),
        style: { height: !scheduled ? '100%' : done ? '100%' : '26%' },
        title: `${key}${done ? ' 達成' : ''}`,
      }),
    );
  }
  return el('div', {}, [
    el('div', { class: 'spark', role: 'img', 'aria-label': `直近${SPARK_DAYS}日の達成状況` }, bars),
    el('div', { class: 'spark__axis' }, [
      el('span', { text: `${SPARK_DAYS}日前` }),
      el('span', { text: '今日' }),
    ]),
  ]);
}

function statCard(habit, logs, today) {
  const rate30 = completionRate(habit, logs, addDays(today, -29), today);
  const pct = rate30.rate === null ? '—' : Math.round(rate30.rate * 100);

  return el('section', { class: 'card stat-card', style: { '--habit-color': habit.color } }, [
    el('div', { class: 'stat-card__head' }, [
      el('span', { class: 'stat-card__emoji', text: habit.emoji, 'aria-hidden': 'true' }),
      el('div', { style: { minWidth: '0' } }, [
        el('div', { class: 'stat-card__name', text: habit.name }),
        el('div', { class: 'stat-card__schedule', text: scheduleLabel(habit, weekdayLabel) }),
      ]),
    ]),
    el('div', { class: 'stat-grid' }, [
      stat(currentStreak(habit, logs, today), '日', '現在の連続'),
      stat(longestStreak(habit, logs, today), '日', '最長の連続'),
      stat(pct, pct === '—' ? '' : '%', '直近30日'),
    ]),
    spark(habit, logs, today),
  ]);
}

export function renderStats(state) {
  const today = todayKey();
  const active = state.habits.filter((h) => !h.archived);

  const header = {
    title: '統計',
    subtitle: '連続日数と達成率',
    action: { label: '習慣を追加', icon: ICON_PATHS.plus, onClick: () => openHabitEditor() },
  };

  if (active.length === 0) {
    return {
      header,
      body: [
        emptyState({
          emoji: '📊',
          title: 'まだデータがありません',
          body: '習慣を追加してチェックを始めると、連続日数や達成率がここに集計されます。',
          action: { label: '習慣を追加', onClick: () => openHabitEditor() },
        }),
      ],
    };
  }

  const totalDone = Object.values(state.logs).reduce((sum, entries) => sum + Object.keys(entries).length, 0);

  return {
    header,
    body: [
      ...active.map((h) => statCard(h, state.logs, today)),
      el('p', { class: 'about', text: `これまでの記録: 合計 ${totalDone} 件` }),
    ],
  };
}
