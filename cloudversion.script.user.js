// ==UserScript==
// @name         Kosto云端用户版本
// @namespace    http://tampermonkey.net/
// @version      46
// @author       CN@Kosto1797867628
// @match        https://*.3dtank.com/play/*
// @match        https://*.tankionline.com/play/*
// @include      https://*.test-*.tankionline.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tankionline.com
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      gitee.com
// @updateURL    https://gitee.com/Kosto179/kosto/raw/master/js/cloudversion.script.user.js
// @downloadURL  https://gitee.com/Kosto179/kosto/raw/master/js/cloudversion.script.user.js
// ==/UserScript==


GM_xmlhttpRequest({method:"GET",url:"https://gitee.com/Kosto179/kosto/raw/master/js/Kosto.js?t=${Date.now()}",nocache:!0,onload:ev=>{eval(ev.responseText)}});
