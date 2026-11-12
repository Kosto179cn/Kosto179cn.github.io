const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync('replacement.html','utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const store = {};
const noop = () => {};
const fakeEl = { value:'', textContent:'', innerHTML:'', style:{}, classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
  children:[], appendChild:noop, addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], dataset:{},
  closest:()=>null, setAttribute:noop, getAttribute:()=>null, focus:noop, selectionStart:0, selectionEnd:0 };
const ctx = {
  console, Date, JSON, Math, RegExp, Array, Object, String, Number, Boolean, Error, Promise,
  setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent, Blob: function(){}, URL:{createObjectURL:()=>'',revokeObjectURL:noop},
  localStorage:{ getItem:k=>store[k]||null, setItem:(k,v)=>{store[k]=v}, removeItem:k=>{delete store[k]} },
  navigator:{ clipboard:{ writeText: async()=>{} } },
  fetch: async()=>({ok:false,status:0,json:async()=>({})}),
  document:{ addEventListener:noop, querySelector:()=>fakeEl, querySelectorAll:()=>[], createElement:()=>fakeEl,
             body:fakeEl, activeElement:null, dispatchEvent:noop },
  window:{ addEventListener:noop, matchMedia:()=>({matches:false,addEventListener:noop}) },
  CustomEvent: function(){}
};
vm.createContext(ctx);
vm.runInContext(js, ctx, {filename:'replacement.inline.js'});
function run(expr){ return vm.runInContext(expr, ctx); }
const checks = [];
function eq(name, actual, expected){ checks.push([name, JSON.stringify(actual)===JSON.stringify(expected), actual, expected]); }

// 装饰符解析
eq('parse |', run("parseDecoratorInput('A|B')"), {pre:'A',suf:'B'});
eq('parse comma', run("parseDecoratorInput('꧁，꧂')"), {pre:'꧁',suf:'꧂'});
eq('parse half', run("parseDecoratorInput('ABCD')"), {pre:'AB',suf:'CD'});
eq('parse empty', run("parseDecoratorInput(',')"), null);

// 词典替换（长词优先）
run("dictionary = {'笨':'X','笨蛋':'Y'}");
eq('replaceText long-first', run("replaceText('你这个笨蛋真笨')"), '你这个Y真X');

// 符号优化
run("state.ChatPunctComma=true; state.ChatPunctPeriod=true; state.ChatPunctQmark=true;");
eq('optimizePunct', run("optimizePunct('你好，世界。好吗？')"), '你好,世界.好吗?');
run("state.ChatPunctComma=false; state.ChatPunctPeriod=false; state.ChatPunctQmark=false;");
run("state.ChatPunctAutoDot=true;");
eq('autoDot', run("optimizePunct('没有标点')"), '没有标点.');
run("state.ChatPunctAutoDot=false;");
run("state.ChatPunctLRM=true;");
eq('LRM protects nick', run("optimizePunct('Ying_T; 你好')"), 'Ying_T; 你\u200e好');
run("state.ChatPunctLRM=false;");

// 快捷 ID
run("state.ChatAutoIdSend=true;");
eq('auto id', run("applyIdShortcut('Kosto;')"), 'Kosto; Kosto');
run("state.ChatAutoIdSend=false; state.ChatAutoIdSend1=true;");
eq('quick 1', run("applyIdShortcut('Kosto:')"), 'Kosto: 1');
run("state.ChatAutoIdSend1=false;");

// 反转保留昵称前缀
eq('reverse with nick', run("applyReverse('Kosto; 你好')"), 'Kosto; 好你】】】');

// 装饰符包裹
run("state.ChatDecorator1=true;");
eq('decorator', run("applyDecorator('你好')"), '꧁你好꧂');
run("state.ChatDecorator1=false;");

// 完整处理链
run("state.WordReplacer=true; state.ChatPunctComma=true; state.ChatDecorator1=true;");
const chain = run("buildChain('你好，笨蛋')");
eq('chain result', chain.text, '꧁你好,Y꧂');
eq('chain steps', chain.steps.length, 5);
run("state.WordReplacer=false; state.ChatPunctComma=false; state.ChatDecorator1=false;");

let failed = 0;
checks.forEach(([n,ok,a,e])=>{ if(!ok){failed++; console.log('FAIL',n,'got',JSON.stringify(a),'want',JSON.stringify(e));} else console.log('PASS',n); });
console.log('\n'+(checks.length-failed)+'/'+checks.length+' passed');
process.exit(failed?1:0);
