export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Please use POST", { status: 405 });
    }

    try {
      const { text, model } = await request.json();
      const API_KEY = env.GEMINI_KEY
      const TARGET_MODEL = model || "gemini-1.5-flash";

      // 2. 调用 Google Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TARGET_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `你是一个游戏翻译助手。请将以下tankionline游戏对话翻译成中文，使用TankiOnline的专有名词进行翻译，如果碰到连贯的词语，尝试先拆分那些日常词，再进行翻译，保持日常的口语化，如果有多条消息请严格对应格式。待翻译内容：\n${text}` }]
          }]
        })
      });

      const data = await response.json();
      
      // 3. 包装成原脚本需要的格式
      // 原脚本解析的是 data: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
      const formattedResponse = {
        candidates: data.candidates
      };

      return new Response(JSON.stringify(formattedResponse), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },
};