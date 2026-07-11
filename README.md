# ⚡ edge++

**edgetunnel پیشرفته با مدیریت کاربران فارسی**

> هسته پروکسی [edgetunnel](https://github.com/cmliu/edgetunnel) (VLESS / Trojan / Shadowsocks) + پنل مدیریت کاربران الهام‌گرفته از [Zeus Panel](https://github.com/IR-NETLIFY/zeus) — همه در یک Cloudflare Worker.

![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Users](https://img.shields.io/badge/Management-D1_Database-blue?style=flat-square)

---

## ✨ ویژگی‌ها

### 🛡️ هسته پروکسی (edgetunnel)
- **VLESS** + **Trojan** + **Shadowsocks** — سه پروتکل اصلی
- WebSocket / gRPC / XHTTP
- ProxyIP سفارشی + SOCKS5 chain
- سیستم اشتراک داخلی (Clash, Sing-box, Surge, Loon و...)
- TLS Fragmentation و ECH
- Optimized IP selection (优选IP)

### 👥 مدیریت کاربران (edge++)
- ایجاد/ویرایش/حذف کاربر با UUID اختصاصی
- **محدودیت حجم** (GB) — با ریست خودکار
- **محدودیت درخواست** — با ریست خودکار
- **مدت اعتبار** (روز) — انقضای خودکار
- **محدودیت IP همزمان**
- فعال/غیرفعال کردن آنی
- ریست مصرف با یک کلیک

### 📊 داشبورد کاربر
- صفحه وضعیت اختصاصی هر کاربر (`/status/username`)
- نمایش لحظه‌ای: حجم مصرفی، درخواست‌ها، روزهای مانده
- لینک اشتراک + کانفیگ‌ها در یک صفحه
- کپی فوری کانفیگ‌ها

### 🎨 پنل مدیریت
- رابط کاربری **فارسی** با طراحی منحصر‌به‌فرد
- آمار کلی: کل کاربران، فعال‌ها، مصرف، درخواست‌ها
- جستجوی کاربران
- لینک مستقیم اشتراک هر کاربر
- تغییر رمز عبور پنل

### 🚀 دیپلویر خودکار
- دیپلوی یک‌کلیکی روی Cloudflare Workers
- ساخت خودکار D1 Database + KV Namespace
- مدیریت چند پنل: لیست + آپدیت
- صفحه وب زیبا برای دیپلوی

---

## 📐 معماری

```
┌──────────────────────────────────────────────┐
│           edge++ Worker (Cloudflare)          │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  هسته edgetunnel                        │  │
│  │  VLESS / Trojan / SS Proxy Engine      │  │
│  │  Subscription System (Clash/SB/...)     │  │
│  │  Admin Panel (/admin)                   │  │
│  └────────────────────────────────────────┘  │
│                      ↕ KV                     │
│  ┌────────────────────────────────────────┐  │
│  │  لایه مدیریت کاربران edge++             │  │
│  │  User CRUD API (/api/edgepp/*)          │  │
│  │  Panel (/panel)                         │  │
│  │  Per-User Sub (/sub/:user)              │  │
│  │  Status Page (/status/:user)            │  │
│  └────────────────────────────────────────┘  │
│                      ↕ D1                     │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Deployer Worker (دیپلویر خودکار)             │
│  - ساخت D1 + KV + Worker                     │
│  - لیست + آپدیت پنل‌ها                        │
└──────────────────────────────────────────────┘
```

---

## 🚀 دیپلوی سریع

### روش ۱: دیپلویر خودکار (توصیه‌شده)

۱. دیپلویر رو روی Cloudflare Workers مستقر کنید:
   - در داشبورد CF Workers → Create Worker
   - کد فایل `deployer.js` رو کپی کنید
   - نام ورکر: `edge-pp-deployer` (یا هر نام دلخواه)
   - Deploy کنید

۲. صفحه ورکر رو باز کنید و:
   - **توکن API کلودفلر** رو وارد کنید
   - رمز ادمین edgetunnel رو (اختیاری) وارد کنید
   - دکمه **«دیپلوی edge++»** رو بزنید

۳. بعد از چند ثانیه لینک‌های پنل مدیریت نمایش داده میشه:
   - `/panel` → پنل مدیریت کاربران
   - `/admin` → پنل تنظیمات edgetunnel

---

### روش ۲: دستی با Wrangler CLI

```bash
# 1. کلون کنید
git clone https://github.com/godde3s/edge-pp.git
cd edge-pp

# 2. لاگین به کلودفلر
npx wrangler login

# 3. ساخت دیتابیس D1
npx wrangler d1 create edge-pp-db
# شناسه دیتابیس رو در wrangler.toml وارد کنید

# 4. ساخت KV (اختیاری برای edgetunnel)
npx wrangler kv:namespace create KV
# شناسه KV رو در wrangler.toml وارد کنید

# 5. دیپلوی
npx wrangler deploy
```

---

## 🔑 دسترسی‌های لازم توکن دیپلویر

برای ساخت توکن API کلودفلر ([لینک مستقیم](https://dash.cloudflare.com/profile/api-tokens)):

| دسترسی (Permission) | نوع (Type) |
|---|---|
| Account Settings | Read |
| Workers Scripts | Edit |
| Workers KV Storage | Edit |
| D1 | Edit |

**مراحل ساخت توکن:**
1. به [API Tokens](https://dash.cloudflare.com/profile/api-tokens) بروید
2. **Create Token** → **Custom token** را بزنید
3. در بخش **Permissions** موارد بالا را اضافه کنید
4. در بخش **Account Resources** → **Include** → **All accounts**
5. **Continue to summary** → **Create Token**
6. توکن را کپی کنید

---

## 📍 مسیرها (Routes)

| مسیر | توضیح |
|---|---|
| `/panel` | پنل مدیریت کاربران edge++ |
| `/panel/login` | ورود به پنل |
| `/admin` | پنل تنظیمات edgetunnel |
| `/login` | ورود به پنل edgetunnel |
| `/sub` | اشتراک عمومی edgetunnel |
| `/sub/:username` | اشتراک اختصاصی کاربر |
| `/status/:username` | صفحه وضعیت کاربر |
| `/api/edgepp/*` | API مدیریت کاربران |
| `/version` | نسخه edgetunnel |
| *(سایر مسیرها)* | هدایت به هسته پروکسی |

---

## 🔧 متغیرهای محیطی

| متغیر | توضیح | الزامی؟ |
|---|---|---|
| `ADMIN` | رمز عبور پنل edgetunnel | ✅ |
| `KV` | KV Namespace (تنظیمات edgetunnel) | ✅ |
| `DB` | D1 Database (مدیریت کاربران) | ✅ |

### متغیرهای اختیاری edgetunnel

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `UUID` | خودکار از ADMIN | UUID پروکسی |
| `HOST` | دامنه ورکر | دامنه‌های مجاز |
| `PROXYIP` | خودکار | ProxyIP |
| `GO2SOCKS5` | - | SOCKS5 chain |
| `BEST_SUB` | false | حالت اشتراک‌ساز |
| `DEBUG` | false | لاگ دیباگ |
| `KEY` | خودکار | کلید رمزنگاری |

> توضیحات کامل متغیرها در [ریپازیتوری edgetunnel](https://github.com/cmliu/edgetunnel) موجود است.

---

## 🛠️ Build از سورس

```bash
# نصب وابستگی‌ها
npm install

# ساخت _worker.js نهایی
node scripts/build.js

# خروجی: _worker.js (ترکیب edgetunnel + مدیریت کاربران)
```

---

## 📄 لایسنس

- **هسته پروکسی:** [edgetunnel](https://github.com/cmliu/edgetunnel) — GPL-3.0
- **الهام مدیریت کاربران:** [Zeus Panel](https://github.com/IR-NETLIFY/zeus)
- **پنل و لایه مدیریت:** edge++

---

## 🙏 تشکر

- [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel) — هسته پروکسی قدرتمند
- [IR-NETLIFY/zeus](https://github.com/IR-NETLIFY/zeus) — ایده مدیریت کاربران
- [Cloudflare](https://cloudflare.com) — پلتفرم Workers + D1