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
          "Access-Control-Allow-Headers": "Content-Type",
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
        // ---------- 翻译功能 ----------
        return await handleTranslate(request, env);
      } else if (model === "2") {
        // ---------- 上传数据到 Gitee ----------
        return await handleUpload(request, env);
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
    return new Response(JSON.stringify({ error: "Missing 'file' or 'record' in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const token = env.GITEE_TOKEN;
  const repo = env.GITEE_REPO;
  if (!token || !repo) {
    return new Response(JSON.stringify({ error: "GITEE_TOKEN or GITEE_REPO not set in environment" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  // 1. 读取 Gitee 文件
  let dataArray = [];
  let sha = null;
  try {
    const readResult = await readGiteeFile(repo, file, token);
    dataArray = readResult.data;
    sha = readResult.sha;
  } catch (e) {
    // 文件不存在时，视为空数组
    if (e.status !== 404) {
      throw e;
    }
    dataArray = [];
    sha = undefined;
  }

  // 2. 合并记录（逻辑参照原脚本的 handleFinalizeUpload 和 retryableUpdate）
  const now = getNow();
  const newRecord = { ...record };

  // 查找现有记录（优先 InternalID，其次 TankiName）
  let existing = null;
  let existingIndex = -1;
  if (newRecord.InternalID) {
    existingIndex = dataArray.findIndex(item => item.InternalID === newRecord.InternalID);
    if (existingIndex !== -1) existing = dataArray[existingIndex];
  }
  if (!existing && newRecord.TankiName) {
    existingIndex = dataArray.findIndex(item => item.TankiName === newRecord.TankiName);
    if (existingIndex !== -1) existing = dataArray[existingIndex];
  }

  if (existing) {
    // ---------- 更新已有记录 ----------
    // 记录改名历史
    if (newRecord.TankiName && existing.TankiName !== newRecord.TankiName) {
      if (!existing.NicknameHistory) existing.NicknameHistory = [];
      // 如果旧名字不是 WAITING_ 开头，且未在历史中记录过
      if (!existing.TankiName.startsWith("WAITING_")) {
        const already = existing.NicknameHistory.some(h => h.name === existing.TankiName);
        if (!already) {
          existing.NicknameHistory.push({
            name: existing.TankiName,
            replacedAt: now
          });
        }
      }
    }

    // 更新所有提供的字段（但不要覆盖 NicknameHistory 除非明确传入）
    for (const key in newRecord) {
      if (key === "NicknameHistory") {
        // 如果请求中明确提供了新的历史数组，则替换（通常不这么做，但支持）
        if (newRecord.NicknameHistory) {
          existing.NicknameHistory = newRecord.NicknameHistory;
        }
      } else {
        existing[key] = newRecord[key];
      }
    }
    existing.LastUpdate = now;
  } else {
    // ---------- 新建记录 ----------
    if (!newRecord.NicknameHistory) newRecord.NicknameHistory = [];
    newRecord.LastUpdate = now;
    dataArray.push(newRecord);
  }

  // 3. 写回 Gitee
  await writeGiteeFile(repo, file, token, dataArray, sha, `Update via Worker (${now})`);

  return new Response(JSON.stringify({ success: true, message: "Record merged successfully" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
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