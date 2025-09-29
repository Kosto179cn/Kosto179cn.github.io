// ==UserScript==
// @name         Kosto云端用户版本
// @namespace    http://tampermonkey.net/
// @version      30
// @author       CN@Kosto1797867628
// @match        https://*.3dtank.com/play/*
// @match        https://*.tankionline.com/play/*
// @include      https://*.test-*.tankionline.com/*
// @icon         https://kosto179cn.github.io/icon/KostoIcon.jpg
// @run-at       document-start
// @grant        GM_xmlhttpRequest 
// @connect      gitee.com
// @connect      github.io
// @connect      api.github.com
// ==/UserScript==

GM_xmlhttpRequest({method:"GET",url:"https://gitee.com/Kosto179/kosto/raw/master/js/Kosto.js",nocache:!0,onload:ev=>{eval(ev.responseText)}});