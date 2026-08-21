// 習慣の追加・編集シート。今日タブと設定タブの両方から呼ばれる。

import { el, openSheet, toast, confirmSheet } from '../ui.js';
import { HABIT_COLORS } from '../habits.js';
import { addHabit, deleteHabit, updateHabit } from '../store.js';
import { weekdayLabel } from '../dates.js';

const EMOJI_CHOICES = [
  '✅', '📖', '🏃', '💪', '🧘', '💧', '🥗', '😴',
  '🦷', '🧹', '💊', '✍️', '🎸', '🌱', '🧠', '☀️',
];

/**
 * シートを開く。habit を渡すと編集、渡さなければ新規追加。
 */
export function openHabitEditor(habit = null) {
  const isEdit = Boolean(habit);
  const draft = {
    name: habit?.name ?? '',
    emoji: habit?.emoji ?? EMOJI_CHOICES[0],
    color: habit?.color ?? HABIT_COLORS[0],
    scheduleType: habit?.schedule?.type ?? 'daily',
    days: [...(habit?.schedule?.days ?? [1, 2, 3, 4, 5])],
  };

  openSheet(isEdit ? '習慣を編集' : '習慣を追加', (close) => {
    const nameInput = el('input', {
      class: 'input',
      type: 'text',
      value: draft.name,
      maxlength: '40',
      placeholder: '例: 30分読書する',
      enterkeyhint: 'done',
      oninput: (e) => {
        draft.name = e.target.value;
        saveBtn.disabled = draft.name.trim() === '';
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      },
    });

    // --- アイコン ---
    const emojiChips = EMOJI_CHOICES.map((emoji) =>
      el('button', {
        class: 'chip',
        type: 'button',
        text: emoji,
        'aria-pressed': String(emoji === draft.emoji),
        'aria-label': `アイコン ${emoji}`,
        onclick: (e) => {
          draft.emoji = emoji;
          for (const chip of emojiChips) chip.setAttribute('aria-pressed', 'false');
          e.currentTarget.setAttribute('aria-pressed', 'true');
        },
      }),
    );

    // --- 色 ---
    const swatches = HABIT_COLORS.map((color) =>
      el('button', {
        class: 'swatch',
        type: 'button',
        style: { '--swatch': color },
        'aria-pressed': String(color === draft.color),
        'aria-label': `色 ${color}`,
        onclick: (e) => {
          draft.color = color;
          for (const s of swatches) s.setAttribute('aria-pressed', 'false');
          e.currentTarget.setAttribute('aria-pressed', 'true');
        },
      }),
    );

    // --- 曜日 ---
    const dayChips = Array.from({ length: 7 }, (_, dow) =>
      el('button', {
        class: 'chip chip--day',
        type: 'button',
        text: weekdayLabel(dow),
        'aria-pressed': String(draft.days.includes(dow)),
        'aria-label': `${weekdayLabel(dow)}曜日`,
        onclick: (e) => {
          const on = !draft.days.includes(dow);
          if (on) draft.days.push(dow);
          else draft.days = draft.days.filter((d) => d !== dow);
          e.currentTarget.setAttribute('aria-pressed', String(on));
          syncSaveState();
        },
      }),
    );

    const daysField = el('div', { class: 'field', hidden: draft.scheduleType !== 'days' }, [
      el('span', { class: 'field__label', text: '対象の曜日' }),
      el('div', { class: 'chips' }, dayChips),
    ]);

    // --- 頻度の切り替え ---
    const typeButtons = [
      ['daily', '毎日'],
      ['days', '曜日を選ぶ'],
    ].map(([type, label]) =>
      el('button', {
        class: 'segmented__item',
        type: 'button',
        text: label,
        dataset: { type },
        'aria-pressed': String(type === draft.scheduleType),
        onclick: () => {
          draft.scheduleType = type;
          for (const btn of typeButtons) {
            btn.setAttribute('aria-pressed', String(btn.dataset.type === type));
          }
          daysField.hidden = type !== 'days';
          syncSaveState();
        },
      }),
    );

    const saveBtn = el('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: '保存',
      onclick: () => {
        const payload = {
          name: draft.name,
          emoji: draft.emoji,
          color: draft.color,
          schedule:
            draft.scheduleType === 'days'
              ? { type: 'days', days: draft.days }
              : { type: 'daily' },
        };
        if (isEdit) {
          updateHabit(habit.id, payload);
          toast('習慣を更新しました');
        } else {
          addHabit(payload);
          toast('習慣を追加しました');
        }
        close();
      },
    });

    /** 名前が空、または曜日指定で1日も選ばれていないときは保存させない */
    function syncSaveState() {
      const noDays = draft.scheduleType === 'days' && draft.days.length === 0;
      saveBtn.disabled = draft.name.trim() === '' || noDays;
    }
    syncSaveState();

    return [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', text: '習慣の名前' }, [nameInput]),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'アイコン' }),
        el('div', { class: 'chips' }, emojiChips),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field__label', text: '色' }),
        el('div', { class: 'swatches' }, swatches),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field__label', text: '頻度' }),
        el('div', { class: 'segmented' }, typeButtons),
      ]),
      daysField,
      el('div', { class: 'sheet__actions' }, [
        el('button', { class: 'btn', type: 'button', text: 'キャンセル', onclick: close }),
        saveBtn,
      ]),
      isEdit &&
        el('div', { style: { marginTop: '10px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--block',
            type: 'button',
            text: 'この習慣を削除',
            onclick: () => {
              close();
              confirmSheet({
                title: '習慣を削除しますか？',
                message: `「${habit.name}」と、この習慣のすべての記録が削除されます。この操作は取り消せません。`,
                onConfirm: () => {
                  deleteHabit(habit.id);
                  toast('習慣を削除しました');
                },
              });
            },
          }),
        ]),
    ];
  });
}
