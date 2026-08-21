// 設定タブ: 習慣の並び替え・編集、テーマ、バックアップ。

import { confirmSheet, el, icon, ICON_PATHS, openSheet, toast } from '../ui.js';
import { clearAll, exportJSON, importJSON, moveHabit, updateSettings } from '../store.js';
import { scheduleLabel } from '../habits.js';
import { todayKey, weekdayLabel } from '../dates.js';
import { openHabitEditor } from './editor.js';

function segmented(options, current, onSelect) {
  const buttons = options.map(([value, label]) =>
    el('button', {
      class: 'segmented__item',
      type: 'button',
      text: label,
      dataset: { value: String(value) },
      'aria-pressed': String(value === current),
      onclick: () => onSelect(value),
    }),
  );
  return el('div', { class: 'segmented' }, buttons);
}

function settingRow(label, hint, control) {
  return el('div', { class: 'row' }, [
    el('div', {}, [
      el('div', { class: 'row__label', text: label }),
      hint && el('div', { class: 'row__hint', text: hint }),
    ]),
    control,
  ]);
}

function tapRow(label, hint, { onClick, danger = false, value = null }) {
  return el(
    'button',
    { class: `row row--tappable${danger ? ' row--danger' : ''}`, type: 'button', onclick: onClick },
    [
      el('div', {}, [
        el('div', { class: 'row__label', text: label }),
        hint && el('div', { class: 'row__hint', text: hint }),
      ]),
      value ? el('div', { class: 'row__value', text: value }) : el('div', { class: 'row__value', text: '›' }),
    ],
  );
}

/** 習慣1件ぶんの行。上下ボタンで並び替え、行のタップで編集。 */
function habitRow(habit, index, total) {
  return el('div', { class: 'row', style: { '--habit-color': habit.color } }, [
    el(
      'button',
      {
        type: 'button',
        class: 'row__label',
        style: { display: 'flex', alignItems: 'center', gap: '11px', flex: '1', minWidth: '0', textAlign: 'left' },
        'aria-label': `${habit.name} を編集`,
        onclick: () => openHabitEditor(habit),
      },
      [
        el('span', { class: 'stat-card__emoji', text: habit.emoji, 'aria-hidden': 'true' }),
        el('span', { style: { minWidth: '0' } }, [
          el('span', { class: 'stat-card__name', text: habit.name }),
          el('span', { class: 'stat-card__schedule', style: { display: 'block' }, text: scheduleLabel(habit, weekdayLabel) }),
        ]),
      ],
    ),
    el('div', { style: { display: 'flex', flexShrink: '0' } }, [
      el(
        'button',
        {
          class: 'month-nav__btn',
          type: 'button',
          'aria-label': `${habit.name} を上へ`,
          disabled: index === 0,
          onclick: () => moveHabit(habit.id, -1),
        },
        [icon('M12 19V6M6 12l6-6 6 6', { width: 18 })],
      ),
      el(
        'button',
        {
          class: 'month-nav__btn',
          type: 'button',
          'aria-label': `${habit.name} を下へ`,
          disabled: index === total - 1,
          onclick: () => moveHabit(habit.id, 1),
        },
        [icon('M12 5v13M6 12l6 6 6-6', { width: 18 })],
      ),
    ]),
  ]);
}

// ---- バックアップ ----

function downloadBackup() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `habits-${todayKey()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  // revoke が早すぎると保存に失敗する端末があるので、少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('バックアップを書き出しました');
}

function pickBackupFile() {
  const input = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
    onchange: async (event) => {
      const file = event.target.files?.[0];
      input.remove();
      if (!file) return;
      try {
        const text = await file.text();
        // 取り込みは現在のデータを丸ごと置き換えるので、必ず確認を挟む
        confirmSheet({
          title: 'バックアップを取り込みますか？',
          message: `「${file.name}」の内容で、今のデータをすべて置き換えます。先に書き出しておくことをおすすめします。`,
          confirmLabel: '取り込む',
          danger: false,
          onConfirm: () => {
            try {
              const next = importJSON(text);
              toast(`${next.habits.length} 件の習慣を読み込みました`);
            } catch (err) {
              toast(`読み込めませんでした: ${err.message}`);
            }
          },
        });
      } catch {
        toast('ファイルを読めませんでした');
      }
    },
  });
  document.body.append(input);
  input.click();
}

function showAbout() {
  openSheet('このアプリについて', (close) => [
    el('p', { class: 'sheet__text' }, [
      'データはこの端末のブラウザ内（localStorage）だけに保存されます。サーバーには何も送信されません。',
      el('br'),
      el('br'),
      'そのため、ブラウザの履歴やサイトデータを消すと記録も消えます。ときどき「バックアップを書き出す」で JSON を保存しておくと安心です。',
      el('br'),
      el('br'),
      'ホーム画面に追加しておくと、アドレスバーのないアプリとして起動でき、オフラインでも使えます。',
    ]),
    el('div', { class: 'sheet__actions' }, [
      el('button', { class: 'btn btn--primary', type: 'button', text: '閉じる', onclick: close }),
    ]),
  ]);
}

export function renderSettings(state) {
  const active = state.habits.filter((h) => !h.archived);
  const archived = state.habits.filter((h) => h.archived);

  const header = {
    title: '設定',
    subtitle: '習慣の管理とバックアップ',
    action: { label: '習慣を追加', icon: ICON_PATHS.plus, onClick: () => openHabitEditor() },
  };

  const body = [];

  body.push(el('h2', { class: 'section-title', text: '習慣' }));
  body.push(
    el(
      'section',
      { class: 'card rows' },
      active.length > 0
        ? active.map((h, i) => habitRow(h, i, active.length))
        : [
            el('div', { class: 'row' }, [
              el('div', { class: 'row__hint', text: 'まだ習慣がありません。右上の + から追加できます。' }),
            ]),
          ],
    ),
  );

  if (archived.length > 0) {
    body.push(el('h2', { class: 'section-title', text: 'アーカイブ済み' }));
    body.push(
      el(
        'section',
        { class: 'card rows' },
        archived.map((h) =>
          tapRow(`${h.emoji} ${h.name}`, 'タップして編集・削除', { onClick: () => openHabitEditor(h) }),
        ),
      ),
    );
  }

  body.push(el('h2', { class: 'section-title', text: '表示' }));
  body.push(
    el('section', { class: 'card rows' }, [
      settingRow(
        'テーマ',
        null,
        segmented(
          [
            ['system', '端末'],
            ['light', 'ライト'],
            ['dark', 'ダーク'],
          ],
          state.settings.theme,
          (theme) => updateSettings({ theme }),
        ),
      ),
      settingRow(
        '週の開始',
        'カレンダーの並び',
        segmented(
          [
            [0, '日'],
            [1, '月'],
          ],
          state.settings.weekStart,
          (weekStart) => updateSettings({ weekStart }),
        ),
      ),
    ]),
  );

  body.push(el('h2', { class: 'section-title', text: 'データ' }));
  body.push(
    el('section', { class: 'card rows' }, [
      tapRow('バックアップを書き出す', 'JSON ファイルとして保存', { onClick: downloadBackup }),
      tapRow('バックアップを読み込む', '今のデータを置き換えます', { onClick: pickBackupFile }),
      tapRow('すべてのデータを削除', '習慣と記録をすべて消します', {
        danger: true,
        onClick: () =>
          confirmSheet({
            title: 'すべて削除しますか？',
            message: 'すべての習慣と記録が消えます。この操作は取り消せません。',
            confirmLabel: 'すべて削除',
            onConfirm: () => {
              clearAll();
              toast('すべてのデータを削除しました');
            },
          }),
      }),
    ]),
  );

  body.push(el('h2', { class: 'section-title', text: 'このアプリ' }));
  body.push(
    el('section', { class: 'card rows' }, [
      tapRow('データの保存先について', null, { onClick: showAbout }),
    ]),
  );

  body.push(el('p', { class: 'about', text: '習慣トラッカー — データは端末内にのみ保存されます' }));

  return { header, body };
}
