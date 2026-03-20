// 核心工具函数
window.log = console.log;
window.sleep = ms => new Promise(res => setTimeout(res, ms));
window.dist = (e, t) => {
    let [x1, y1, z1] = Object.values(e), [x2, y2, z2] = Object.values(t);
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
};

// 修复后的 Proxy，用于拦截属性
new Proxy(window, { 
    set: (t, p, v) => { t[p] = v; return true; }, 
    deleteProperty: (t, p) => { delete t[p]; return true; } 
});

// 属性拦截器
window.apply = (prop, setter, getter) => prop && Object.defineProperty(Object.prototype, prop, {
    get() { return getter ? getter.call(this, `_${prop}_`, this[`_${prop}_`]) : this[`_${prop}_`]; },
    set(v) { this[`_${prop}_`] = setter ? setter.call(this, v) : v; },
    configurable: true
});

// 提取主脚本路径
window.getMain = async () => {
    let s;
    while (!(s = [...document.scripts].find(x => x.src.includes("/static/js/"))?.src)) await sleep(100);
    return s.split("com")[1];
};

// 核心解密逻辑：解析混淆名称
window.setup = (str) => {
    window.parents = window.parents || {}; window._parents = window._parents || {};
    window.collection = window.collection || {}; window._collection = window._collection || {};
    window.callable = window.callable || {}; window._callable = window._callable || {};

    const intro = (type, k, v) => {
        if (!k || !v || v.includes(".") || window[`_${type}`][v]) return;
        window[`_${type}`][v] = k;
        window[type][k] = window[type][k] ? `${window[type][k]},${v}` : v;
    };

    let regs = [/(\w+)="\+this\.(\w+)\+"/g, /(\w+)="\+this\.(\w+)\w*\+/g, /(\w+)\s*=\s*"\+this\.(\w+)/g, /(\w+):\s*"\+this\.(\w+)/g];
    str.split(`).toString=function(){`).slice(1).forEach(chunk => {
        let code = chunk.split("}")[0];
        for (let r of regs) {
            for (let m of code.matchAll(r)) intro("collection", m[1], m[2]);
        }
    });
};

// 工具：通过路径或索引读写混淆后的对象
window.devanilla = s => s.startsWith("_") && s.endsWith("_") ? s.slice(1, -1) : s;

window.byPath = (obj, path) => {
    if (!obj) return null;
    let res = obj;
    for (let part of path.split(".")) {
        let keys = Object.keys(res);
        let found = keys.find(k => _collection[devanilla(k)] === part || _parents[devanilla(Object.keys(res[k] || {})[0])] === part);
        if (found) res = res[found]; else return null;
    }
    return res;
};

window.byIndex = (obj, ...idx) => {
    let res = obj;
    for (let i of idx) {
        if (typeof i === "number") res = Object.values(res)[i];
        else res = res[i];
    }
    return res;
};

window.copyItem = (a, b) => Object.keys(a).forEach((k, i) => a[k] = Object.values(b)[i]);