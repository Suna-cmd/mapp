// アプリの起動、タブの切り替え、再描画。

import { el, icon, toast } from './ui.js';
import { getState, load, subscribe } from './store.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { todayKey } from './dates.js';

const viewNode = document.getElementById('view');
const titleNode = document.getElementById('view-title');
const subtitleNode = document.getElementById('view-subtitle');
const headerSlot = document.getElementById('header-slot');
const headerNode = document.querySelector('.app-header');
const tabbar = document.getElementById('tabbar');

const RENDERERS = {
  today: renderToday,
  calendar: renderCalendar,
  stats: renderStats,
  settings: renderSettings,
};

let currentTab = 'today';
/** タブごとのスクロール位置。戻ったときに元の場所を保つ。 */
const scrollPositions = {};

function render() {
  const state = getState();
  const { header, body } = RENDERERS[currentTab](state, render);

  titleNode.textContent = header.title;
  subtitleNode.textContent = header.subtitle ?? '';

  headerSlot.replaceChildren(
    header.action
      ? el(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            'aria-label': header.action.label,
            onclick: header.action.onClick,
          },
          [icon(header.action.icon, { width: 22, strokeWidth: 2.2 })],
        )
      : '',
  );

  viewNode.replaceChildren(...body);
  viewNode.classList.remove('view-enter');
  // クラスを付け直してアニメーションを再生させる
  void viewNode.offsetWidth;
  viewNode.classList.add('view-enter');
}

function switchTab(tab) {
  if (tab === currentTab) {
    // 同じタブをもう一度押したら先頭に戻す
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  scrollPositions[currentTab] = window.scrollY;
  currentTab = tab;

  for (const btn of tabbar.querySelectorAll('.tabbar__item')) {
    if (btn.dataset.tab === tab) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }

  render();
  window.scrollTo({ top: scrollPositions[tab] ?? 0 });
}

tabbar.addEventListener('click', (event) => {
  const btn = event.target.closest('.tabbar__item');
  if (btn) switchTab(btn.dataset.tab);
});

// ---- テーマ ----

function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

// ---- 日付またぎ ----

let lastSeenDay = todayKey();

/**
 * アプリを開きっぱなしで日付が変わると「今日」がずれるので、
 * 復帰時と1分ごとにチェックして描き直す。
 */
function checkDayRollover() {
  const now = todayKey();
  if (now !== lastSeenDay) {
    lastSeenDay = now;
    render();
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkDayRollover();
});
setInterval(checkDayRollover, 60_000);

// ---- ヘッダーの境界線 ----

window.addEventListener(
  'scroll',
  () => {
    headerNode.classList.toggle('app-header--scrolled', window.scrollY > 4);
  },
  { passive: true },
);

// ---- Service Worker ----

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// で開いた場合は登録できないので試みない
  if (location.protocol === 'file:') return;

  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((registration) => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // 既存の SW がいる状態で installed になったら、新しい版が待機中
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            toast('新しいバージョンがあります', {
              action: {
                label: '更新',
                onClick: () => installing.postMessage({ type: 'SKIP_WAITING' }),
              },
            });
          }
        });
      });
    })
    .catch((err) => console.warn('Service Worker を登録できませんでした', err));

  // 新しい SW が制御を取ったら一度だけリロードする
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// ---- 起動 ----

const initial = load();
applyTheme(initial.settings.theme);

subscribe((state) => {
  applyTheme(state.settings.theme);
  render();
});

render();
registerServiceWorker();
