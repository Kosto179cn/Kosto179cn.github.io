// 环境变量说明：
// - GITEE_TOKEN  : Gitee 私人令牌（必须）
// - GITEE_REPO   : 仓库路径，例如 "Kosto179/kosto-battle-clicker-new"（必须）
// - GEMINI_KEY   : Google Gemini API 密钥（仅 model=1 时需要）

export default {
  async fetch(request, env) {
    // 处理 CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Kosto-Auth",
        },
      });
    }

    // 仅允许 POST 请求
    if (request.method !== "POST") {
      return new Response("Please use POST", { status: 405 });
    }

    const url = new URL(request.url);
    const model = url.searchParams.get("model") || "1";

    try {
      if (model === "1") {
        // ---------- 翻译功能（需要验证协议头）----------
        const authHeader = request.headers.get("X-Kosto-Auth");
        if (authHeader !== "kosto-translate-2026") {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid auth header" }), { 
            status: 403, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }
        return await handleTranslate(request, env);
      } else if (model === "2") {
        // ---------- 上传数据到 Gitee ----------
        return await handleUpload(request, env);
      } else if (model === "3") {
        // ---------- 下载配置 ----------
        return await handleDownload(request, env);
      } else {
        return new Response("Invalid model parameter", { status: 400 });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  },
};

// ==================== 翻译处理 ====================
async function handleTranslate(request, env) {
  const { text, model } = await request.json();
  const API_KEY = env.GEMINI_KEY;
  const TARGET_MODEL = model || "gemini-1.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TARGET_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `你是一个游戏翻译助手。请将以下tankionline游戏对话翻译成中文，使用TankiOnline的专有名词进行翻译，如果碰到连贯的词语，尝试先拆分那些日常词，再进行翻译，保持日常的口语化，如果有多条消息请严格对应格式。待翻译内容：\n${text}` }]
        }]
      })
    }
  );

  const data = await response.json();
  const formatted = { candidates: data.candidates };
  return new Response(JSON.stringify(formatted), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ==================== 上传处理（Gitee） ====================
async function handleUpload(request, env) {
  const { file, record } = await request.json();
  if (!file || !record) {
    return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
  }

  const token = env.GITEE_TOKEN;
  const repo = env.GITEE_REPO;
  
  let maxRetries = 3; // 最大重试次数
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 1. 读取最新数据
      let dataArray = [];
      let sha = null;
      try {
        const readResult = await readGiteeFile(repo, file, token);
        dataArray = readResult.data;
        sha = readResult.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
        sha = undefined; // 文件不存在
      }

      // 2. 执行智能合并
      const now = getNow();
      let existingIndex = -1;

      // 查找逻辑
      if (record.InternalID) {
        existingIndex = dataArray.findIndex(item => item.InternalID === record.InternalID);
      }
      if (existingIndex === -1 && record.TankiName) {
        existingIndex = dataArray.findIndex(item => item.TankiName === record.TankiName);
      }

      if (existingIndex !== -1) {
        // --- 更新逻辑 ---
        let existing = dataArray[existingIndex];

        // 处理改名记录
        if (record.TankiName && existing.TankiName !== record.TankiName) {
          if (!existing.NicknameHistory) existing.NicknameHistory = [];
          if (!existing.TankiName.startsWith("WAITING_")) {
            const already = existing.NicknameHistory.some(h => h.name === existing.TankiName);
            if (!already) existing.NicknameHistory.push({ name: existing.TankiName, replacedAt: now });
          }
        }

        // 【关键修复】: 智能字段合并
        for (const key in record) {
          if (key === "NicknameHistory") continue; 
          
          const newVal = record[key];
          // 只有当新值不是 undefined, null, 或空字符串时才更新
          // 这样如果你只传了 Key，没有传 Password，Password 字段就不会被覆盖
          if (newVal !== undefined && newVal !== null && newVal !== "") {
            existing[key] = newVal;
          }
        }
        existing.LastUpdate = now;
        dataArray[existingIndex] = existing;
      } else {
        // --- 新建逻辑 ---
        const newEntry = { ...record };
        if (!newEntry.NicknameHistory) newEntry.NicknameHistory = [];
        newEntry.LastUpdate = now;
        dataArray.push(newEntry);
      }

      // 3. 写回 Gitee
      await writeGiteeFile(repo, file, token, dataArray, sha, `Update via Worker (${now})`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } catch (err) {
      // 如果报错是 409 (Conflict) 或 400 (通常是 sha 错误)，则重试
      if (err.status === 409 || err.message.includes("sha")) {
        attempt++;
        // 等待随机时间后重试，避免死锁
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      // 其他错误直接抛出
      throw err;
    }
  }

  throw new Error("Maximum retries reached. Parallel update conflict.");
}

// ==================== Gitee API 工具函数 ====================
async function readGiteeFile(repo, file, token) {
  const url = `https://gitee.com/api/v5/repos/${repo}/contents/${file}?access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`Gitee read failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  let content = [];
  if (json.content) {
    const decoded = Base64.decode(json.content);
    try {
      content = JSON.parse(decoded);
    } catch (_) {
      content = [];
    }
  }
  if (!Array.isArray(content)) content = [];
  return { data: content, sha: json.sha };
}

async function writeGiteeFile(repo, file, token, data, sha, message) {
  const url = `https://gitee.com/api/v5/repos/${repo}/contents/${file}?access_token=${token}`;
  const contentStr = Base64.encode(JSON.stringify(data, null, 2));
  const body = { content: contentStr, sha: sha, message: message };
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Gitee write failed: ${res.status}`);
  }
  return res.json();
}

// ==================== Base64 工具（兼容原脚本） ====================
const Base64 = {
  encode: function(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      function(match, p1) {
        return String.fromCharCode('0x' + p1);
      }));
  },
  decode: function(str) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }
};

// ==================== 辅助函数 ====================
function getNow() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// ==================== 下载处理（Gitee） ====================
async function handleDownload(request, env) {
  const { fingerprint } = await request.json();
  if (!fingerprint) {
    return new Response(JSON.stringify({ error: "Missing fingerprint" }), { status: 400 });
  }
  const token = env.GITEE_TOKEN;
  const repo = env.GITEE_REPO;
  const file = `kosto-config/${fingerprint}.json`;
  
  try {
    const url = `https://gitee.com/api/v5/repos/${repo}/contents/${file}?access_token=${token}`;
    const res = await fetch(url);
    
    if (res.status === 404) {
      return new Response(JSON.stringify({ error: "Config not found", found: false }), { 
        status: 404, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    if (!res.ok) {
      throw new Error(`Gitee read failed: ${res.status}`);
    }
    
    const json = await res.json();
    let content = null;
    if (json.content) {
      const decoded = Base64.decode(json.content);
      try {
        content = JSON.parse(decoded);
      } catch (_) {
        content = null;
      }
    }
    
    return new Response(JSON.stringify({ success: true, data: content, found: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, found: false }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }
}