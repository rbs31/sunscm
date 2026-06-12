/**
 * Sun Supply Chain — 合规初筛 Worker
 * 作用：让浏览器表单(apply.html)通过这个 Worker 调用 Claude，
 *      Anthropic API 密钥只存在服务端（Cloudflare Secret），永不出现在前端。
 *
 * 部署后需设置密钥（二选一）：
 *   - Dashboard: Workers → 你的 Worker → Settings → Variables and Secrets
 *                新增 ANTHROPIC_API_KEY（类型 Secret）
 *   - CLI:       wrangler secret put ANTHROPIC_API_KEY
 *
 * API 密钥从 https://platform.claude.com → API Keys 获取（需开通计费）。
 */

// 只允许你自己的站点调用，防止别人盗用你的密钥
const ALLOWED_ORIGINS = [
  "https://sunscm.com",
  "https://www.sunscm.com",
  // 本地或预览测试时可临时加入，例如：
  // "http://localhost:8788",
  // "http://127.0.0.1:5500",
];

// 模型：默认 Sonnet 4.6（质量好）。想省钱可改成 "claude-haiku-4-5-20251001"
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// 系统提示放在服务端，使该端点只能做合规初筛、不能被当成通用 Claude 代理盗用
const SYSTEM_PROMPT =
  "你是美国海关进口主体（IOR）合规初筛顾问，背景是 2026 年 6 月《强化海关执法》行政令，服务对象是把货物进口到美国的中国跨境电商卖家。" +
  "根据客户填写的信息，给出简洁、专业、不制造恐慌的合规初筛。" +
  "只返回一个 JSON 对象，不要 markdown、不要代码块、不要任何多余文字。" +
  'JSON 结构：{"riskLevel":"低|中|高","visitorSummary":"给客户看的中文摘要，2-3句","flags":["具体风险点，中文，3-5条"],"recommendedServices":["建议的合规服务名，中文，2-4个"],"internalNote":"给顾问看的中文要点，含建议切入角度"}';

// 只接受这些字段，并限制长度（不接受任意 prompt，防滥用）
const FIELDS = ["name","company","wechat","email","sellerType","category","importMethod","volume","usEntity","concern"];

function corsHeaders(origin){
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin){
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env){
    const origin = request.headers.get("Origin") || "";

    // CORS 预检
    if(request.method === "OPTIONS"){
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if(request.method !== "POST"){
      return json({ error: "method_not_allowed" }, 405, origin);
    }
    if(!env.ANTHROPIC_API_KEY){
      return json({ error: "server_not_configured" }, 500, origin);
    }

    // 解析并清洗输入（白名单 + 截断）
    let intake = {};
    try{
      const data = await request.json();
      const src = (data && data.intake) || {};
      for(const k of FIELDS){
        intake[k] = String(src[k] == null ? "" : src[k]).slice(0, 600);
      }
    }catch(e){
      return json({ error: "bad_request" }, 400, origin);
    }
    if(!intake.sellerType && !intake.importMethod && !intake.category){
      return json({ error: "empty_intake" }, 400, origin);
    }

    // 调用 Anthropic
    let aResp;
    try{
      aResp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: "客户信息：\n" + JSON.stringify(intake, null, 2) }],
        }),
      });
    }catch(e){
      return json({ error: "upstream_unreachable" }, 502, origin);
    }
    if(!aResp.ok){
      return json({ error: "upstream_" + aResp.status }, 502, origin);
    }

    // 解析 Claude 返回的 JSON
    try{
      const data = await aResp.json();
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if(!parsed.riskLevel || !Array.isArray(parsed.flags)) throw new Error("shape");
      return json(parsed, 200, origin);
    }catch(e){
      return json({ error: "parse_failed" }, 502, origin);
    }
  },
};
