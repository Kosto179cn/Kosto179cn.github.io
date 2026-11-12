/* Kosto Aurora — 全站主题控制
 * 用法：<script src="assets/theme.js"></script>（建议放在 <head> 内，避免闪白/闪黑）
 *       <button class="k-btn k-theme-toggle" data-theme-toggle></button>
 * 主题模式：auto（跟随系统） / light / dark，写入 <html data-theme="light|dark">
 * 偏好存 localStorage：kosto_theme
 */
(function () {
    'use strict';

    var KEY = 'kosto_theme';
    var MODES = ['auto', 'light', 'dark'];
    var LABELS = { auto: '跟随系统', light: '日间', dark: '夜间' };
    var ICONS = { auto: '🖥', light: '☀', dark: '🌙' };
    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function readMode() {
        try {
            var v = localStorage.getItem(KEY);
            return MODES.indexOf(v) !== -1 ? v : 'auto';
        } catch (e) { return 'auto'; }
    }

    function resolve(mode) {
        if (mode === 'auto') return media && media.matches ? 'dark' : 'light';
        return mode;
    }

    function paint() {
        var mode = readMode();
        var resolved = resolve(mode);
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.setAttribute('data-theme-mode', mode);
        updateButtons(mode, resolved);
        try {
            document.dispatchEvent(new CustomEvent('kosto-theme-change', {
                detail: { mode: mode, resolved: resolved }
            }));
        } catch (e) { /* 老浏览器忽略 */ }
    }

    function updateButtons(mode, resolved) {
        var nodes = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var showText = el.getAttribute('data-theme-label') !== 'off';
            var icon = (ICONS[mode] || ICONS.auto);
            if (showText) el.innerHTML = icon + ' <span>' + LABELS[mode] + '</span>';
            else el.textContent = icon;
            el.title = '主题：' + LABELS[mode] + '（点击切换：跟随系统 → 日间 → 夜间）';
            el.setAttribute('aria-label', el.title);
            el.setAttribute('data-theme-current', mode);
            el.setAttribute('data-theme-resolved', resolved);
        }
    }

    function setMode(mode) {
        if (MODES.indexOf(mode) === -1) mode = 'auto';
        try { localStorage.setItem(KEY, mode); } catch (e) { /* 隐私模式忽略 */ }
        paint();
    }

    function cycle() {
        var mode = readMode();
        setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    }

    function onClick(e) {
        var btn = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
        if (btn) { e.preventDefault(); cycle(); }
    }

    // 首屏立即上色（此时 body 可能还没解析完）
    paint();

    document.addEventListener('click', onClick);
    document.addEventListener('DOMContentLoaded', paint);

    if (media) {
        var onSystemChange = function () { if (readMode() === 'auto') paint(); };
        if (media.addEventListener) media.addEventListener('change', onSystemChange);
        else if (media.addListener) media.addListener(onSystemChange);
    }

    // 多标签页同步
    window.addEventListener('storage', function (e) { if (e.key === KEY) paint(); });

    window.KostoTheme = {
        get: readMode,
        resolved: function () { return resolve(readMode()); },
        set: setMode,
        cycle: cycle,
        apply: paint,
        key: KEY
    };
})();
