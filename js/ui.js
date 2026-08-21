// DOM 組み立てとオーバーレイ（シート・トースト）の共通処理。
// テキストはすべて textContent 経由で入れるので、習慣名に HTML が混ざっても壊れない。

/**
 * 要素を作る簡易ヘルパー。
 * el('div', { class: 'x', onclick: fn, dataset: {...} }, [子, 'テキスト'])
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    // カスタムプロパティ（--habit-color など）は style オブジェクトへの代入では
    // 反映されないので、setProperty を通す必要がある。
    else if (key === 'style') {
      for (const [prop, val] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** SVG アイコン。path の d 属性の配列から組み立てる。 */
export function icon(paths, { width = 24, strokeWidth = 2 } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', width);
  svg.setAttribute('height', width);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of [].concat(paths)) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7',
  pencil: ['M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z', 'M14.5 6.5l3 3'],
};

// ---- トースト ----

const toastNode = document.getElementById('toast');
let toastTimer = null;

/**
 * 画面下に短いメッセージを出す。
 * action を渡すと右側にボタンが付き、タイマーで自動的には消えない。
 */
export function toast(message, { action = null, duration = 2600 } = {}) {
  clearTimeout(toastTimer);
  toastNode.replaceChildren(el('span', { text: message }));
  if (action) {
    toastNode.append(
      el('button', {
        class: 'toast__action',
        type: 'button',
        text: action.label,
        onclick: () => {
          hideToast();
          action.onClick();
        },
      }),
    );
  }
  toastNode.hidden = false;
  if (!action) toastTimer = setTimeout(hideToast, duration);
}

export function hideToast() {
  clearTimeout(toastTimer);
  toastNode.hidden = true;
}

// ---- ボトムシート ----

const backdrop = document.getElementById('sheet-backdrop');
const sheet = document.getElementById('sheet');
let closeSheetFn = null;
let lastFocused = null;

/**
 * ボトムシートを開く。
 * build(close) が中身の要素（配列可）を返す。
 */
export function openSheet(title, build) {
  lastFocused = document.activeElement;
  const close = () => closeSheet();
  closeSheetFn = close;

  sheet.replaceChildren(
    el('div', { class: 'sheet__grabber' }),
    el('h2', { class: 'sheet__title', id: 'sheet-title', text: title }),
    ...[].concat(build(close)),
  );
  backdrop.hidden = false;
  // 背後のページがスクロールしないように固定する
  document.body.style.overflow = 'hidden';

  // 最初の入力欄にフォーカス。ただし iOS でキーボードが即出るのは煩いので
  // テキスト入力のときだけにする。
  const firstInput = sheet.querySelector('input[type="text"]');
  if (firstInput) firstInput.focus({ preventScroll: true });
}

export function closeSheet() {
  if (backdrop.hidden) return;
  backdrop.hidden = true;
  sheet.replaceChildren();
  document.body.style.overflow = '';
  closeSheetFn = null;
  lastFocused?.focus?.({ preventScroll: true });
  lastFocused = null;
}

// 背景タップで閉じる（シート本体のタップは無視）
backdrop.addEventListener('click', (event) => {
  if (event.target === backdrop) closeSheet();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && closeSheetFn) closeSheet();
});

/** はい／いいえの確認シート */
export function confirmSheet({ title, message, confirmLabel = '削除', danger = true, onConfirm }) {
  openSheet(title, (close) => [
    el('p', { class: 'sheet__text', text: message }),
    el('div', { class: 'sheet__actions' }, [
      el('button', { class: 'btn', type: 'button', text: 'キャンセル', onclick: close }),
      el('button', {
        class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
        type: 'button',
        text: confirmLabel,
        onclick: () => {
          close();
          onConfirm();
        },
      }),
    ]),
  ]);
}

/** 空状態の表示 */
export function emptyState({ emoji, title, body, action = null }) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty__emoji', text: emoji }),
    el('p', { class: 'empty__title', text: title }),
    el('p', { class: 'empty__body', text: body }),
    action && el('button', { class: 'btn btn--primary', type: 'button', text: action.label, onclick: action.onClick }),
  ]);
}

/** 端末が対応していれば軽く振動させる（iOS Safari は非対応なので黙って無視される） */
export function haptic(pattern = 12) {
  navigator.vibrate?.(pattern);
}
