export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// === Landing Page ===
		if (request.method === "GET" && url.pathname === "/") {
			return new Response(getLandingHTML(), {
				headers: { "Content-Type": "text/html;charset=UTF-8" },
			});
		}

		// === Deploy API ===
		if (request.method === "POST" && url.pathname === "/api/deploy") {
			try {
				const { token, admin_password } = await request.json();
				if (!token) throw new Error("توکن نمی‌تواند خالی باشد.");

				const headers = {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				};

				// 1. Verify token & get account
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success || accData.result.length === 0) {
					throw new Error("توکن نامعتبر است یا اکانتی یافت نشد.");
				}
				const accountId = accData.result[0].id;

				// 2. Ensure workers subdomain
				let devSub = null;
				const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, { headers });
				const subData = await subRes.json();
				if (subData.success && subData.result && subData.result.subdomain) {
					devSub = subData.result.subdomain;
				} else {
					const newSub = `epp-${Math.random().toString(36).substring(2, 8)}`;
					const createSub = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
						method: "PUT",
						headers,
						body: JSON.stringify({ subdomain: newSub }),
					});
					const createSubData = await createSub.json();
					if (!createSubData.success) {
						const cfError = createSubData.errors?.[0]?.message || "نامشخص";
						throw new Error(`CF_TOS_ERROR|${cfError}`);
					}
					devSub = newSub;
				}

				// 3. Create D1 database
				const uniqueSuffix = Math.random().toString(36).substring(2, 8);
				const workerName = `edge-pp-${uniqueSuffix}`;
				const dbName = `edge-pp-db-${uniqueSuffix}`;

				const dbRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
					method: "POST",
					headers,
					body: JSON.stringify({ name: dbName }),
				});
				const dbData = await dbRes.json();
				if (!dbData.success) {
					const cfError = dbData.errors?.[0]?.message || "نامشخص";
					throw new Error(`CF_DB_ERROR|${cfError}`);
				}
				const dbUuid = dbData.result.uuid;

				// 4. Create KV namespace (for edgetunnel settings)
				let kvId = null;
				try {
					const kvRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, {
						method: "POST",
						headers,
						body: JSON.stringify({ title: `edge-pp-kv-${uniqueSuffix}` }),
					});
					const kvData = await kvRes.json();
					if (kvData.success) {
						kvId = kvData.result.id;
					}
				} catch (e) { /* KV is optional */ }

				await new Promise((resolve) => setTimeout(resolve, 1000));

				// 5. Fetch edge++ worker source
				const githubRes = await fetch("https://raw.githubusercontent.com/godde3s/edge-pp/refs/heads/main/_worker.js?t=" + Date.now());
				if (!githubRes.ok) throw new Error("خطا در دریافت سورس edge++ از گیت‌هاب.");
				const workerCode = await githubRes.text();

				// 6. Build metadata with bindings
				const metadata = {
					main_module: "_worker.js",
					compatibility_date: "2024-02-08",
					bindings: [
						{ type: "d1", name: "DB", id: dbUuid },
						{ type: "secret_text", name: "CF_API_TOKEN", text: token },
						{ type: "secret_text", name: "CF_ACCOUNT_ID", text: accountId },
					],
				};

				if (kvId) {
					metadata.bindings.push({ type: "kv_namespace", name: "KV", namespace_id: kvId });
				}

				if (admin_password) {
					metadata.bindings.push({ type: "secret_text", name: "ADMIN", text: admin_password });
				}

				// 7. Deploy worker
				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("_worker.js", new Blob([workerCode], { type: "application/javascript+module" }), "_worker.js");

				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`, {
					method: "PUT",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) {
					const cfError = deployData.errors?.[0]?.message || "نامشخص";
					throw new Error(`CF_DEPLOY_ERROR|${cfError}`);
				}

				// 8. Enable subdomain routing
				await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
					method: "POST",
					headers,
					body: JSON.stringify({ enabled: true }),
				});

				const panelUrl = `https://${workerName}.${devSub}.workers.dev/panel`;
				const adminUrl = `https://${workerName}.${devSub}.workers.dev/admin`;

				return new Response(JSON.stringify({
					success: true,
					url: panelUrl,
					admin_url: adminUrl,
					worker_name: workerName,
					db_name: dbName,
					kv_id: kvId,
				}), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// === List Panels ===
		if (request.method === "POST" && url.pathname === "/api/list-panels") {
			try {
				const { token } = await request.json();
				if (!token) throw new Error("توکن الزامی است");
				const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success) throw new Error("توکن نامعتبر");
				const accountId = accData.result[0].id;

				const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, { headers });
				const subData = await subRes.json();
				const devSub = subData.success && subData.result?.subdomain ? subData.result.subdomain : "";

				const scriptsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, { headers });
				const scriptsData = await scriptsRes.json();
				if (!scriptsData.success) throw new Error("خطا در دریافت لیست");

				const panels = scriptsData.result
					.filter(s => s.id.startsWith("edge-pp-"))
					.map(s => ({
						name: s.id,
						url: `https://${s.id}.${devSub}.workers.dev/panel`
					}));

				return new Response(JSON.stringify({ success: true, panels, devSub }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400, headers: { "Content-Type": "application/json" },
				});
			}
		}

		// === Update Panel ===
		if (request.method === "POST" && url.pathname === "/api/update-panel") {
			try {
				const { token, scriptName } = await request.json();
				if (!token || !scriptName) throw new Error("توکن و نام ورکر الزامی است");
				const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				const accountId = accData.result[0].id;

				const githubRes = await fetch("https://raw.githubusercontent.com/godde3s/edge-pp/refs/heads/main/_worker.js?t=" + Date.now());
				if (!githubRes.ok) throw new Error("خطا در دریافت سورس");
				const newCode = await githubRes.text();

				const bindingsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, { headers });
				const bindingsData = await bindingsRes.json();

				const newBindings = [];
				for (const b of bindingsData.result) {
					if (b.type === "d1") newBindings.push({ type: "d1", name: b.name, id: b.database_id || b.id });
					else if (b.type === "kv_namespace") newBindings.push({ type: "kv_namespace", name: b.name, namespace_id: b.namespace_id });
					else if (b.name === "CF_API_TOKEN" || b.name === "CF_ACCOUNT_ID" || b.name === "ADMIN") {
						// Keep secrets by re-fetching them isn't possible; we pass them through
					}
				}

				const metadata = { main_module: "_worker.js", compatibility_date: "2024-02-08", bindings: newBindings };
				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("_worker.js", new Blob([newCode], { type: "application/javascript+module" }), "_worker.js");

				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
					method: "PUT",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) throw new Error("خطا در آپدیت: " + (deployData.errors?.[0]?.message || "نامشخص"));

				return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400, headers: { "Content-Type": "application/json" },
				});
			}
		}

		return new Response("Not Found", { status: 404 });
	}
};

function getLandingHTML() {
	return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>edge++ — پنل‌ساز خودکار</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0a0e1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;color:#e2e8f0}
.hero{margin-top:80px;text-align:center;margin-bottom:48px}
.logo{font-size:72px;margin-bottom:12px;filter:drop-shadow(0 0 30px rgba(129,140,248,.4))}
h1{font-size:40px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}
.subtitle{color:#94a3b8;font-size:16px;max-width:600px;line-height:1.8}
.features{display:flex;gap:32px;margin-bottom:48px;flex-wrap:wrap;justify-content:center;max-width:800px}
.feature{background:rgba(15,23,42,.8);border:1px solid rgba(99,102,241,.15);border-radius:16px;padding:24px 28px;width:220px;text-align:center;transition:.3s}
.feature:hover{border-color:#818cf8;transform:translateY(-4px)}
.feature-icon{font-size:28px;margin-bottom:8px}
.feature-title{font-size:14px;font-weight:600;margin-bottom:4px}
.feature-desc{font-size:12px;color:#94a3b8;line-height:1.6}
.card{background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(99,102,241,.3);border-radius:24px;padding:40px;width:90%;max-width:520px;box-shadow:0 25px 60px rgba(0,0,0,.5)}
.card h2{font-size:22px;margin-bottom:24px;text-align:center}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px;font-weight:600}
.form-group input{width:100%;padding:14px 18px;border-radius:12px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:15px;outline:none;transition:.3s;direction:ltr;text-align:left}
.form-group input:focus{border-color:#818cf8;box-shadow:0 0 20px rgba(99,102,241,.15)}
.btn{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:.3s;margin-top:8px}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(99,102,241,.4)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.token-hint{font-size:12px;color:#64748b;margin-top:8px;text-align:center;line-height:1.6}
.token-hint a{color:#818cf8;text-decoration:none}
.result{margin-top:20px;padding:16px;border-radius:12px;display:none}
.result-success{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34d399}
.result-error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171}
.result a{color:#818cf8;text-decoration:none;font-weight:700}
.result a:hover{text-decoration:underline}
#panelsSection{margin-top:32px;width:90%;max-width:520px}
.panel-item{background:rgba(15,23,42,.8);border:1px solid rgba(99,102,241,.15);border-radius:12px;padding:14px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.panel-item a{color:#818cf8;text-decoration:none;font-size:14px}
.panel-item button{padding:6px 14px;border-radius:8px;border:1px solid rgba(99,102,241,.3);background:transparent;color:#c084fc;cursor:pointer;font-size:12px;transition:.2s}
.panel-item button:hover{background:rgba(99,102,241,.1)}
.footer{margin-top:auto;padding:24px;color:#475569;font-size:12px;text-align:center}
</style>
</head>
<body>

<div class="hero">
  <div class="logo">⚡</div>
  <h1>edge++</h1>
  <p class="subtitle">edgetunnel پیشرفته با مدیریت کاربران — بر پایه Cloudflare Workers<br>هسته پروکسی edgetunnel + پنل مدیریت اختصاصی فارسی</p>
</div>

<div class="features">
  <div class="feature">
    <div class="feature-icon">🛡️</div>
    <div class="feature-title">VLESS / Trojan / SS</div>
    <div class="feature-desc">پشتیبانی از سه پروتکل اصلی با هسته edgetunnel</div>
  </div>
  <div class="feature">
    <div class="feature-icon">👥</div>
    <div class="feature-title">مدیریت کاربران</div>
    <div class="feature-desc">محدودیت حجم، درخواست، انقضا و IP همزمان</div>
  </div>
  <div class="feature">
    <div class="feature-icon">📊</div>
    <div class="feature-title">داشبورد زنده</div>
    <div class="feature-desc">آمار لحظه‌ای مصرف و وضعیت کاربران</div>
  </div>
</div>

<div class="card">
  <h2>🚀 دیپلوی خودکار</h2>
  <div class="form-group">
    <label>توکن API کلودفلر *</label>
    <input type="text" id="tokenInput" placeholder="API Token">
  </div>
  <div class="form-group">
    <label>رمز عبور ادمین edgetunnel (اختیاری)</label>
    <input type="password" id="adminPwd" placeholder="اگر خالی بذاری، بعداً تنظیم میشه">
  </div>
  <button class="btn" id="deployBtn" onclick="deploy()">⚡ دیپلوی edge++</button>
  <p class="token-hint">
    دسترسی‌های لازم توکن: <b>Account Settings (Read)</b> + <b>Workers Scripts (Edit)</b> + <b>D1 (Edit)</b> + <b>Workers KV Storage (Edit)</b><br>
    <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">ساخت توکن از داشبورد کلودفلر</a>
  </p>
  <div class="result" id="result"></div>
</div>

<div id="panelsSection">
  <div class="card" style="margin-bottom:16px">
    <h2>📋 پنل‌های فعال</h2>
    <button class="btn" style="background:#1e293b;border:1px solid #334155;margin-top:0" onclick="listPanels()">بارگذاری لیست</button>
    <div id="panelsList" style="margin-top:16px"></div>
  </div>
</div>

<div class="footer">edge++ — Powered by edgetunnel | Developed with ⚡</div>

<script>
async function deploy(){
  const btn=document.getElementById('deployBtn');
  const result=document.getElementById('result');
  const token=document.getElementById('tokenInput').value.trim();
  const adminPwd=document.getElementById('adminPwd').value.trim();
  if(!token){alert('توکن API الزامی است');return;}
  btn.disabled=true;btn.textContent='در حال دیپلوی...';
  result.style.display='none';
  try{
    const r=await fetch('/api/deploy',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,admin_password:adminPwd||undefined})
    });
    const d=await r.json();
    if(d.success){
      result.className='result result-success';
      result.innerHTML=\`
        <strong>✅ دیپلوی موفق!</strong><br><br>
        📊 <a href="\${d.url}" target="_blank">پنل مدیریت کاربران</a><br>
        ⚙️ <a href="\${d.admin_url}" target="_blank">پنل edgetunnel</a><br>
        📝 ورکر: \${d.worker_name}<br>
        🗄️ دیتابیس: \${d.db_name}
      \`;
    }else{
      result.className='result result-error';
      let msg=d.error||'خطای ناشناخته';
      if(msg.includes('CF_TOS_ERROR'))msg='خطای TOS کلودفلر: لطفاً Terms of Service را بپذیرید.';
      if(msg.includes('CF_DB_ERROR'))msg='خطا در ساخت دیتابیس D1.';
      if(msg.includes('CF_DEPLOY_ERROR'))msg='خطا در دیپلوی ورکر.';
      result.innerHTML='<strong>❌ خطا:</strong> '+msg;
    }
  }catch(e){
    result.className='result result-error';
    result.innerHTML='<strong>❌ خطا:</strong> '+e.message;
  }
  result.style.display='block';
  btn.disabled=false;btn.textContent='⚡ دیپلوی edge++';
}

async function listPanels(){
  const token=document.getElementById('tokenInput').value.trim();
  if(!token){alert('ابتدا توکن را وارد کنید');return;}
  const list=document.getElementById('panelsList');
  list.innerHTML='در حال بارگذاری...';
  try{
    const r=await fetch('/api/list-panels',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})
    });
    const d=await r.json();
    if(!d.success){list.innerHTML='خطا: '+d.error;return;}
    if(d.panels.length===0){list.innerHTML='پنل فعالی یافت نشد.';return;}
    list.innerHTML=d.panels.map(p=>\`
      <div class="panel-item">
        <span>\${p.name}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <a href="\${p.url}" target="_blank">پنل</a>
          <button onclick="updatePanel('\${p.name}')">🔄 آپدیت</button>
        </div>
      </div>
    \`).join('');
  }catch(e){list.innerHTML='خطا: '+e.message;}
}

async function updatePanel(name){
  const token=document.getElementById('tokenInput').value.trim();
  if(!token)return;
  if(!confirm('ورکر '+name+' آپدیت شود؟'))return;
  try{
    const r=await fetch('/api/update-panel',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,scriptName:name})
    });
    const d=await r.json();
    alert(d.success?'آپدیت موفق بود!':'خطا: '+d.error);
    if(d.success)listPanels();
  }catch(e){alert('خطا: '+e.message);}
}
</script>
</body>
</html>`;
}