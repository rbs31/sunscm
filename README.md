# 阳光供应链 Sun Supply Chain — 网站部署包

直接把这个文件夹里的文件拖进 GitHub 仓库即可上线。下面是清单和步骤。

---

## 📁 文件清单

| 文件 | 作用 | 放哪 |
|---|---|---|
| `index.html` | 官网首页（中英双语，"预约"按钮已指向 apply.html） | 仓库根目录 |
| `apply.html` | 预约页 + 智能合规初筛表单 | 仓库根目录 |
| `CNAME` | 自定义域名，内容为 `sunscm.com` | 仓库根目录 |
| `.nojekyll` | 关闭 GitHub 的 Jekyll 处理（可选但建议） | 仓库根目录 |
| `README.md` | 本说明 | 仓库根目录 |
| `cloudflare-worker/worker.js` | 线上"真 AI 初筛"的服务端（**不属于网站**，单独部署到 Cloudflare） | 子文件夹 |
| `cloudflare-worker/wrangler.toml` | Worker 的 CLI 配置 | 子文件夹 |

> `cloudflare-worker/` 文件夹不会影响网站，它只是放在仓库里方便管理；真正部署到 Cloudflare（见第 4 步）。

---

## ① 5 分钟上线（GitHub Pages）

1. github.com → 右上角 ➕ → **New repository** → 取名（如 `sunscm-site`）→ 选 **Public** → Create。
2. 进仓库 → **Add file → Upload files** → 把根目录的文件（`index.html`、`apply.html`、`CNAME`、`.nojekyll`、`README.md`）拖进去 → **Commit changes**。
   - 想连 Worker 一起进版本库，把整个 `cloudflare-worker` 文件夹也拖进去。
   - 若 `.nojekyll` 拖不上去（隐藏文件），用 **Add file → Create new file**，文件名填 `.nojekyll`，留空保存即可。
3. **Settings → Pages** → Source 选 **Deploy from a branch** → Branch `main` / 目录 `/(root)` → Save。
4. 等 1–2 分钟，出现 `https://<用户名>.github.io/<仓库名>` 临时地址，能打开即成功。

## ② 绑定 sunscm.com（DNS）

1. **Settings → Pages → Custom domain** 填 `sunscm.com` → Save。（务必先在这里加，再去配 DNS。）
2. 去域名服务商的 DNS 设置：
   - **4 条 A 记录**（主机填 `@` 或留空）：`185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153`
   - **1 条 CNAME 记录**：主机 `www` → 指向 `<用户名>.github.io`
3. DNS 生效后（几分钟到 24 小时），回到 Pages 勾选 **Enforce HTTPS**。
   - 用 Cloudflare 托管域名时，A 记录那朵云点成**灰色**（DNS only / 关代理），否则证书签发会卡。

## ③ 让预约表单发邮件到你邮箱（Web3Forms，约 2 分钟）

1. 打开 https://web3forms.com → 输入 `asherchu3@gmail.com` → 邮箱里会收到一个 **Access Key**。
2. 打开 `apply.html`，把
   `const WEB3FORMS_ACCESS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";`
   里的占位符换成你的 key → 重新上传。
3. 之后每个访客提交，资料 + 初筛摘要会自动发到你邮箱。（没配之前会降级为打开访客邮件客户端发给你，仍可用。）

## ④（可选）线上跑真 AI 初筛（Cloudflare Worker）

不配的话，线上初筛用内置规则引擎，已经够用；想要真正的 Claude 智能初筛再做这步。

1. dash.cloudflare.com → **Workers & Pages → Create → Create Worker** → 命名 `sunscm-screen` → Deploy。
2. **Edit code**，粘贴 `cloudflare-worker/worker.js` 全部内容 → Deploy。
3. 该 Worker 的 **Settings → Variables and Secrets** → 加一个 **Secret**：名 `ANTHROPIC_API_KEY`，值为你的 Anthropic 密钥（platform.claude.com → API Keys，需开通计费）。
4. 复制 Worker 地址（形如 `https://sunscm-screen.你的子域.workers.dev`）。
5. 打开 `apply.html`，把 `const SCREEN_WORKER_URL = "";` 填成该地址 → 重新上传。
   - 建议给这个 Worker 加一条 Cloudflare **Rate limiting** 规则，或在表单加 **Turnstile**，防刷爆 API。
   - 想省成本：把 `worker.js` 里的 `MODEL` 改成 `claude-haiku-4-5-20251001`。

---

## 🔑 两个要填的占位符（都在 `apply.html` 顶部）

| 占位符 | 换成 | 不填的后果 |
|---|---|---|
| `YOUR_WEB3FORMS_ACCESS_KEY` | Web3Forms 的 Access Key | 表单改用邮件客户端发送（半自动） |
| `SCREEN_WORKER_URL`（留空） | 你的 Worker 地址 | 线上初筛用规则引擎（仍可用） |

---

## ⏱ 建议顺序

①上线 → ②绑域名 → ③配 Web3Forms（让线索能进邮箱）→ ④有空再上 Worker。
①②③ 完成后，网站就已经"真能用"了。

> 提示：网站文案与初筛均为一般性参考，不构成法律或税务意见；具体方案请咨询持牌专业人士。
