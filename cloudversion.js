// @name         Kosto云端用户版本
// @namespace    http://tampermonkey.net/
// @description  BattleClicker&SupplyClicker 默认M键呼出菜单
// @version      2025.7.29
// @author       CN@Kosto1797867628
// @icon         https://kosto179cn.github.io/Kosto.github.io/KostoIcon.jpg
// @match        *://*.3dtank.com/play*
// @match        *://*.tankionline.com/play*
// @match        *://*.test-eu.tankionline.com/browser-public/index.html*
// @run-at       document-start
// @grant        none
// ==UserScript==


// 当前脚本版本信息
(function() {
    'use strict';

    // --- START: Version Check ---
    const currentVersion = "2025.7.29";
    const currentVersionCode = 50;
    const versionUrl = 'https://kosto179cn.github.io/Kosto.github.io/versioncheck.json';

    let iconsInjected = false;

    function injectMaterialIcons() {
        if (iconsInjected || document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
        document.head.appendChild(link);
        iconsInjected = true;
    }

    function showToast(message) {
        const existingToast = document.querySelector('.replacer-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'replacer-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    function showUpdateDialog(message, downloadUrl) {
        if (document.getElementById('update-dialog-overlay')) return;

        const dialogHtml = `
            <div class="update-dialog-overlay" id="update-dialog-overlay">
                <div class="update-dialog-panel">
                    <div class="update-dialog-header">脚本更新可用</div>
                    <div class="update-dialog-body">${message}</div>
                    <div class="update-dialog-actions">
                        <button id="update-dialog-close" class="replacer-btn close-btn"><span class="material-symbols-outlined">close</span>稍后提醒</button>
                        <button id="update-dialog-confirm" class="replacer-btn save-reload-btn"><span class="material-symbols-outlined">download</span>前往下载</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);

        const overlay = document.getElementById('update-dialog-overlay');
        const confirmBtn = document.getElementById('update-dialog-confirm');
        const closeBtn = document.getElementById('update-dialog-close');

        const closeDialog = () => {
            if (overlay) overlay.remove();
        };

        confirmBtn.onclick = () => {
            window.open(downloadUrl, '_blank');
            closeDialog();
        };

        closeBtn.onclick = closeDialog;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeDialog();
        };
    }

    fetch(versionUrl, { cache: 'reload' })
        .then(response => {
        if (!response.ok) throw new Error('网络错误');
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return response.json();
        }
        throw new Error('收到的不是JSON格式的响应');
    })
        .then(data => {
        const latestVersion = data.version;
        const latestVersionCode = data.version_code;
        const updateInfo = data.update_info;
        const downloadUrl = data.download_url;

        if (latestVersionCode > currentVersionCode) {
            const message = `
                    <p>资源替换脚本有新版本可用！</p>
                    <p><b>当前版本：</b>${currentVersion}</p>
                    <p><b>最新版本：</b>${latestVersion}</p>
                    <p><b>更新内容：</b></p>
                    <div class="update-info-box">${updateInfo.replace(/\n/g, '<br>')}</div>
                `;
            const interval = setInterval(() => {
                if (document.body) {
                    clearInterval(interval);
                    injectMaterialIcons();
                    injectPanelCSS();
                    showUpdateDialog(message, downloadUrl);
                }
            }, 200);
        }
    })
        .catch(error => {
        console.error('更新检查失败:', error);
    });
    // --- END: Version Check ---

    // --- start: Kosto ---




})();
