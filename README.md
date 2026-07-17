# edge++

**پروکسی لبه‌ای پیشرفته با مدیریت کاربران + IP و لوکیشن ثابت**

![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)

> 💡 **قابلیت IP و لوکیشن ثابت** این پروژه با الهام از پروژه **[Zeus Panel](https://github.com/IR-NETLIFY/zeus)** (ساخته شده توسط [PANEL_ZEUS](https://t.me/PANEL_ZEUS)) پیاده‌سازی شده است. از سرورهای اهدایی و لیست آی‌پی‌های تمیز آن‌ها استفاده می‌کند. با تشکر از تیم Zeus بابت این قابلیت عالی. 🙏

---

## ✨ ویژگی‌ها

### 🌐 IP و لوکیشن ثابت (با الهام از Zeus Panel)
- **پراکسی SOCKS5/HTTP اختصاصی هر کاربر** — ترافیک هر کاربر از طریق پراکسی اختصاصی هدایت می‌شود
- **چرخش خودکار IP** — آی‌پی‌های تمیز از لیست اپراتورهای ایرانی (ایرانسل، همراه اول و...) هر چند دقیقه رفرش می‌شوند
- **تعویض خودکار پراکسی خراب** — اگر پراکسی کاربر قطع شود، خودکار از لیست VIP جایگزین می‌شود
- **فیلتر اپراتور** — امکان انتخاب IP فقط از یک اپراتور خاص
- **تست پراکسی** — API برای تست سرعت و لوکیشن پراکسی قبل از اختصاص
- **لیست آی‌پی تمیز** — از مخزن Zeus استفاده شده: آی‌پی‌های تمیز بر اساس اپراتور اینترنت

### 🛡️ پروکسی
- **VLESS** / **Trojan** / **Shadowsocks** — سه پروتکل اصلی
- WebSocket / gRPC / XHTTP
- ProxyIP سفارشی + SOCKS5 chain
- سیستم اشتراک (Clash, Sing-box, Surge, Loon و V2Ray/NekoBox)
- **TLS Fragmentation** و ECH
- **Fingerprint شبیه‌ساز** — Chrome, Firefox, Safari و...

### 👥 مدیریت کاربران
- ایجاد/ویرایش/حذف کاربر با UUID اختصاصی
- محدودیت حجم (GB) با ریست خودکار
- محدودیت درخواست با ریست خودکار
- مدت اعتبار (روز) با انقضای خودکار
- محدودیت IP همزمان
- فعال/غیرفعال آنی
- **تنظیم پراکسی اختصاصی SOCKS5 برای هر کاربر**
- **چرخش خودکار IP با فیلتر اپراتور**

### 📊 داشبورد
- صفحه وضعیت اختصاصی هر کاربر
- آمار لحظه‌ای: حجم، درخواست، روزهای مانده
- لینک اشتراک + کانفیگ در یک صفحه
- **اشتراک متنی (Base64) برای V2Ray/NekoBox با پشتیبانی از Fragment و multi-IP**

### 🎨 پنل
- رابط کاربری فارسی با طراحی منحصر‌به‌فرد
- آمار کلی داشبورد
- جستجوی کاربران
- تغییر رمز عبور

### 🚀 دیپلویر
- دیپلوی یک‌کلیکی
- ساخت خودکار D1 + KV
- مدیریت چند پنل: لیست + آپدیت

---

## 📐 معماری

```
┌──────────────────────────────────────┐
│       edge++ Worker (CF Workers)     │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  Proxy Engine               │   │
│  │  VLESS / Trojan / SS         │   │
│  │  Subscription System         │   │
│  └──────────┬───────────────────┘   │
│             ↕ KV                     │
│  ┌──────────────────────────────┐   │
│  │  User Management            │   │
│  │  CRUD / Limits / Dashboard   │   │
│  └──────────────────────────────┘   │
│             ↕ D1                     │
└──────────────────────────────────────┘
```

---

## 🚀 دیپلوی سریع

### با دیپلویر خودکار

۱. `deployer.js` رو روی CF Workers مستقر کنید
۲. توکن API کلودفلر وارد کنید
۳. دکمه دیپلوی بزنید

### دستی

```bash
git clone https://github.com/Godde3s/edge-pp.git
cd edge-pp
npx wrangler login
npx wrangler d1 create edge-pp-db
npx wrangler kv:namespace create KV
# شناسه‌ها رو در wrangler.toml وارد کنید
npx wrangler deploy
```

---

## 🔑 دسترسی‌های توکن دیپلویر

| دسترسی | نوع |
|---|---|
| Account Settings | Read |
| Workers Scripts | Edit |
| Workers KV Storage | Edit |
| D1 | Edit |

ساخت توکن: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
→ Create Token → Custom Token → افزودن دسترسی‌ها → All Accounts

---

## 📍 مسیرها

| مسیر | توضیح |
|---|---|
| `/panel` | پنل مدیریت کاربران |
| `/admin` | پنل تنظیمات پروکسی |
| `/sub/:username` | اشتراک + وضعیت کاربر (HTML برای مرورگر، Base64 برای V2Ray/NekoBox) |
| `/api/edgepp/*` | API مدیریت کاربران |
| `/api/edgepp/settings` | GET/POST تنظیمات پنل |
| `/api/edgepp/test-proxy` | تست پراکسی (POST: `{proxy: "socks5://..."}`) |
| `/api/edgepp/proxy-ips` | لیست آی‌پی‌های تمیز Zeus (بر اساس اپراتور) |

---

## 🔧 متغیرها

| متغیر | توضیح | الزامی |
|---|---|---|
| `ADMIN` | رمز عبور | ✅ |
| `KV` | KV Namespace | ✅ |
| `DB` | D1 Database | ✅ |

---

## 📄 لایسنس

GPL-3.0