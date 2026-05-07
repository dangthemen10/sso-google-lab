# SSO Google Lab — Tài liệu kỹ thuật

Demo **Single Sign-On (SSO) bằng Google OAuth2** với kiến trúc:  
**Next.js 14 (FE)** ↔ **Spring Boot 3 (BE)** qua Reverse Proxy, triển khai bằng **Docker Compose**.

---

## Mục lục

1. [Tổng quan kiến trúc](#1--tổng-quan-kiến-trúc)
2. [Cấu trúc dự án](#2--cấu-trúc-dự-án)
3. [Luồng xác thực chi tiết](#3--luồng-xác-thực-chi-tiết)
4. [Cấu hình Google Cloud Console](#4--cấu-hình-google-cloud-console)
5. [Backend — Spring Boot](#5--backend--spring-boot)
6. [Frontend — Nextjs](#6--frontend--nextjs)
7. [Docker & Docker Compose](#7--docker--docker-compose)
8. [Chạy dự án](#8--chạy-dự-án)
9. [Giải thích kỹ thuật quan trọng](#9--giải-thích-kỹ-thuật-quan-trọng)
10. [Các lỗi thường gặp & cách khắc phục](#10--các-lỗi-thường-gặp--cách-khắc-phục)

---

## 1 — Tổng quan kiến trúc

```
┌────────────────────────────────────────────────────────────────┐
│                         BROWSER                                │
│                    (localhost:3000)                            │
└──────────┬──────────────────────────────┬──────────────────────┘
           │ HTTP Request                 │ Nhận HTML/Cookie
           ▼                             ▲
┌──────────────────────────────────────────────────────────────┐
│              Next.js Frontend  :3000  (PUBLIC)               │
│                                                              │
│  • Trang Login (page.tsx)                                    │
│  • Trang Dashboard (dashboard/page.tsx) — Server Component   │
│  • Nút Logout (LogoutButton.tsx)        — Client Component   │
│                                                              │
│  next.config.mjs rewrites:                                   │
│    /api/be/*  →  http://backend:8080/*  (Reverse Proxy)      │
└──────────┬───────────────────────────────────────────────────┘
           │ Server-to-server proxy / trực tiếp
           ▼
┌──────────────────────────────────────────────────────────────┐
│           Spring Boot Backend  :8080  (INTERNAL)             │
│                                                              │
│  • SecurityConfig   — OAuth2 + Session config                │
│  • UserController   — GET /user/me                           │
│  • application.yml  — Google OAuth2 credentials             │
│                                                              │
│  ⚠ Browser KHÔNG bao giờ gọi trực tiếp đến port này         │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS (server-to-server)
           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Google OAuth2 Server                        │
│         accounts.google.com / oauth2.googleapis.com          │
└──────────────────────────────────────────────────────────────┘
```

**Nguyên tắc cốt lõi:**
- BE hoàn toàn ẩn — browser chỉ biết domain `:3000`
- Cookie `JSESSIONID` được lưu cho domain `:3000` (FE), không phải `:8080`
- FE đóng vai trò **Reverse Proxy** cho mọi request OAuth2

---

## 2 — Cấu trúc dự án

```
sso-google-lab/
│
├── .env.example                      ← Template credentials (commit được)
├── .env                              ← Credentials thật (KHÔNG commit)
├── .gitignore
├── docker-compose.yml                ← Orchestrate FE + BE
├── README.md                         ← Tài liệu này
│
├── backend/                          ← Spring Boot (Gradle, Java 21)
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── build.gradle
│   ├── settings.gradle
│   └── src/main/
│       ├── java/com/example/sso/
│       │   ├── SsoApplication.java
│       │   ├── config/
│       │   │   └── SecurityConfig.java
│       │   └── controller/
│       │       ├── UserController.java
│       │       └── HomeController.java
│       └── resources/
│           └── application.yml
│
└── frontend/                         ← Next.js 14 App Router (TypeScript)
    ├── Dockerfile
    ├── .dockerignore
    ├── next.config.mjs               ← Reverse proxy rewrites
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── app/
        ├── layout.tsx
        ├── globals.css
        ├── page.tsx                  ← Trang Login
        └── dashboard/
            ├── page.tsx              ← Trang Dashboard (Server Component)
            └── LogoutButton.tsx      ← Nút Logout (Client Component)
```

---

## 3 — Luồng xác thực chi tiết

### Sơ đồ Sequence

```
👤 Browser          Next.js :3000        Spring Boot :8080       Google OAuth2
     │                    │                     │                      │
     │ GET /              │                     │                      │
     │──────────────────>│                     │                      │
     │ Trang Login        │                     │                      │
     │<──────────────────│                     │                      │
     │                    │                     │                      │
     │ ① Click Login      │                     │                      │
     │ GET /api/be/oauth2/authorization/google  │                      │
     │──────────────────>│                     │                      │
     │                    │ Proxy forward       │                      │
     │                    │ GET /oauth2/authorization/google           │
     │                    │────────────────────>│                      │
     │                    │  302 → Google       │                      │
     │                    │<────────────────────│                      │
     │ 302 → Google       │                     │                      │
     │<──────────────────│                     │                      │
     │                    │                     │                      │
     │ ② GET consent screen                    │                      │
     │────────────────────────────────────────────────────────────────>
     │ Hiển thị màn hình chọn tài khoản        │                      │
     │<────────────────────────────────────────────────────────────────
     │ Đồng ý / Chọn tài khoản                 │                      │
     │────────────────────────────────────────────────────────────────>
     │                    │                     │                      │
     │ ③ Google Callback  │                     │                      │
     │ GET /api/be/login/oauth2/code/google     │                      │
     │ ?code=AUTH_CODE&state=...                │                      │
     │──────────────────>│                     │                      │
     │                    │ Proxy forward       │                      │
     │                    │ GET /login/oauth2/code/google?code=...     │
     │                    │────────────────────>│                      │
     │                    │                     │ Validate state       │
     │                    │                     │ POST /token (code)   │
     │                    │                     │─────────────────────>│
     │                    │                     │ access_token+id_token│
     │                    │                     │<─────────────────────│
     │                    │                     │ GET /userinfo        │
     │                    │                     │─────────────────────>│
     │                    │                     │ {name,email,picture} │
     │                    │                     │<─────────────────────│
     │                    │                     │                      │
     │ ④ Tạo Session       │                     │                      │
     │                    │  302 → /dashboard   │                      │
     │                    │  Set-Cookie: JSESSIONID=abc; HttpOnly      │
     │                    │<────────────────────│                      │
     │ 302 + Set-Cookie   │                     │                      │
     │<──────────────────│                     │                      │
     │ Lưu JSESSIONID cho localhost:3000        │                      │
     │                    │                     │                      │
     │ ⑤ GET /dashboard   │                     │                      │
     │ Cookie: JSESSIONID=abc                  │                      │
     │──────────────────>│                     │                      │
     │                    │ Server-to-server    │                      │
     │                    │ GET /user/me        │                      │
     │                    │ Cookie: JSESSIONID  │                      │
     │                    │────────────────────>│                      │
     │                    │ {name,email,picture}│                      │
     │                    │<────────────────────│                      │
     │ HTML Dashboard     │                     │                      │
     │<──────────────────│                     │                      │
     │                    │                     │                      │
     │ ⑥ Logout           │                     │                      │
     │ POST /api/be/logout│                     │                      │
     │──────────────────>│                     │                      │
     │                    │ POST /logout        │                      │
     │                    │────────────────────>│                      │
     │                    │ Invalidate session  │                      │
     │                    │ JSESSIONID=;Max-Age=0                      │
     │                    │<────────────────────│                      │
     │ router.push("/")   │                     │                      │
     │<──────────────────│                     │                      │
```

### Tóm tắt 6 bước

| Bước | Actor | Hành động |
|:---:|---|---|
| ① | Browser → FE → BE | Click Login, proxy kích hoạt flow OAuth2 |
| ② | BE → Google | Spring Security tạo `state`/`nonce`, redirect sang Google Consent Screen |
| ③ | Google → FE → BE | Callback với `auth code`, BE đổi lấy token, fetch user info |
| ④ | BE → Browser | Tạo HTTP Session (`JSESSIONID`), redirect về `/dashboard` kèm `Set-Cookie` |
| ⑤ | Browser → FE → BE | Dashboard Server Component đọc cookie, fetch `/user/me` server-to-server |
| ⑥ | Browser → FE → BE | Logout: invalidate session, xóa cookie, về trang Login |

---

## 4 — Cấu hình Google Cloud Console

### Tạo OAuth 2.0 Client ID

1. Vào [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Điền chính xác:

| Trường | Giá trị |
|---|---|
| **Authorized JavaScript origins** | `http://localhost:3000` |
| **Authorized redirect URIs** | `http://localhost:3000/api/be/login/oauth2/code/google` |

> **Lý do dùng port 3000 (FE) thay vì 8080 (BE):**  
> Google redirect về URL này sau khi user đồng ý. Vì BE ẩn sau proxy, URL phải là  
> domain public của FE. Next.js sẽ tự động forward request xuống BE qua rewrite rule.

5. Copy **Client ID** và **Client Secret** lưu vào file `.env` ở root dự án.

---

## 5 — Backend — Spring Boot

### 5.1 Dependencies (`build.gradle`)

```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-oauth2-client'
}
```

Thư viện `spring-boot-starter-oauth2-client` xử lý **toàn bộ** luồng OAuth2:
- Tạo authorization URL (redirect sang Google)
- Nhận callback, validate `state` (chống CSRF)
- Đổi `authorization code` lấy `access_token`
- Fetch user info từ Google UserInfo endpoint
- Tạo `Authentication` principal và lưu vào Security Context

### 5.2 Cấu hình (`application.yml`)

```yaml
server:
  port: 8080
  # Đọc X-Forwarded-* headers từ Next.js proxy để build đúng URL public (:3000)
  forward-headers-strategy: framework

spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            # Hardcode URL public của FE — phải khớp với Google Console
            redirect-uri: "http://localhost:3000/api/be/login/oauth2/code/google"
            scope: [openid, email, profile]
        provider:
          google:
            user-name-attribute: sub
```

**Hai cấu hình then chốt:**

| Cấu hình | Tác dụng |
|---|---|
| `forward-headers-strategy: framework` | Spring đọc `X-Forwarded-Host/Proto` từ proxy để build URL chính xác |
| `redirect-uri` hardcode | Đảm bảo Spring luôn dùng URL public `:3000`, không tự tính ra `:8080` |

### 5.3 Security Config (`SecurityConfig.java`)

```java
http
    .csrf(AbstractHttpConfigurer::disable)   // BE không nhận request trực tiếp từ browser
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/login/**", "/oauth2/**", "/error").permitAll()
        .anyRequest().authenticated()
    )
    .oauth2Login(oauth2 -> oauth2
        .defaultSuccessUrl("http://localhost:3000/dashboard", true)  // Sau login → FE
        .failureUrl("http://localhost:3000?error=true")
    )
    .logout(logout -> logout
        .logoutRequestMatcher(new AntPathRequestMatcher("/logout"))
        .logoutSuccessUrl("http://localhost:3000")
        .invalidateHttpSession(true)
        .deleteCookies("JSESSIONID")
    )
    .exceptionHandling(ex -> ex
        // /user/** trả 401 thay vì redirect sang Google
        .defaultAuthenticationEntryPointFor(
            new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
            new AntPathRequestMatcher("/user/**")
        )
    );
```

### 5.4 User API (`UserController.java`)

| | |
|---|---|
| Endpoint | `GET /user/me` |
| Auth | Cần `JSESSIONID` hợp lệ trong Cookie header |
| Response | `{ name: string, email: string, picture: string }` |
| Principal | `@AuthenticationPrincipal OAuth2User` — tương thích cả `OidcUser` |

---

## 6 — Frontend — Next.js

### 6.1 Reverse Proxy (`next.config.mjs`)

```js
const BE_INTERNAL_URL = process.env.BE_INTERNAL_URL || 'http://localhost:8080';

const nextConfig = {
  output: 'standalone',   // Cần thiết cho Docker image tối giản
  async rewrites() {
    return [{
      source: '/api/be/:path*',
      destination: `${BE_INTERNAL_URL}/:path*`,
    }];
  },
};
```

> **Quan trọng:** `rewrites()` được evaluate lúc **build time** (`npm run build`).  
> `BE_INTERNAL_URL` phải được truyền qua Docker `ARG` lúc build, không phải `environment`.

### 6.2 Trang Login (`app/page.tsx`)

- Server Component (không cần `'use client'`)
- Nút "Continue with Google" → `href="/api/be/oauth2/authorization/google"`
- Hiển thị error banner nếu query param `?error=true`

### 6.3 Trang Dashboard (`app/dashboard/page.tsx`)

```
Server Component — chạy trên Node.js, KHÔNG phải browser
```

| Bước | Chi tiết |
|---|---|
| 1 | Đọc `JSESSIONID` từ `cookies()` của incoming request |
| 2 | Fetch trực tiếp `${BE_INTERNAL_URL}/user/me` (server-to-server) |
| 3 | Nếu 401 / không có cookie → `redirect('/')` |
| 4 | Render Avatar (`next/image`), Tên, Email, badge xác thực |

### 6.4 Nút Logout (`app/dashboard/LogoutButton.tsx`)

```
Client Component ('use client') — cần onClick, useState
```

| Bước | Chi tiết |
|---|---|
| 1 | `fetch POST /api/be/logout` với `credentials: 'include'` |
| 2 | Next.js proxy forward → Spring Boot `/logout` |
| 3 | Spring invalidate session, set `JSESSIONID=; Max-Age=0` |
| 4 | `router.push('/') + router.refresh()` về trang Login |

---

## 7 — Docker & Docker Compose

### 7.1 Backend Dockerfile (multi-stage)

| Stage | Base Image | Tác dụng |
|---|---|---|
| `builder` | `gradle:8.8-jdk21-alpine` | Build fat JAR (`bootJar -x test`) |
| `runner` | `eclipse-temurin:21-jre-alpine` | Chỉ chạy JAR, không có JDK (~200MB nhỏ hơn) |

Tối ưu cache: Copy `build.gradle` + `settings.gradle` trước → layer cache dependencies riêng.

### 7.2 Frontend Dockerfile (multi-stage)

| Stage | Base Image | Tác dụng |
|---|---|---|
| `deps` | `node:20-alpine` | `npm install`, tạo cache layer cho `node_modules` |
| `builder` | `node:20-alpine` | `npm run build` → `.next/standalone` |
| `runner` | `node:20-alpine` | Chỉ chứa standalone server (~50MB) |

**Trick quan trọng — `BE_INTERNAL_URL` phải là ARG:**
```dockerfile
ARG BE_INTERNAL_URL=http://localhost:8080
ENV BE_INTERNAL_URL=$BE_INTERNAL_URL
RUN mkdir -p /app/public   # đảm bảo tồn tại dù project không có thư mục public/
RUN npm run build
```

### 7.3 Docker Compose

```yaml
services:
  backend:
    build: ./backend
    ports: ["8080:8080"]       # Chỉ map để debug; bỏ trong production
    environment:
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}

  frontend:
    build:
      context: ./frontend
      args:
        BE_INTERNAL_URL: http://backend:8080   # ← build-time: cho next.config.mjs
    environment:
      BE_INTERNAL_URL: http://backend:8080     # ← runtime: cho Server Components
      HOSTNAME: "0.0.0.0"
    depends_on:
      backend: { condition: service_healthy }
```

**Tại sao `BE_INTERNAL_URL` xuất hiện 2 lần?**

| Vị trí | Scope | Dùng cho |
|---|---|---|
| `build.args` | Build time (`npm run build`) | `next.config.mjs` rewrite destination |
| `environment` | Runtime (khi có HTTP request) | `dashboard/page.tsx` server-side fetch |

---

## 8 — Chạy dự án

### Chạy bằng Docker (khuyến nghị)

```bash
# Bước 1: Tạo file .env ở root
cp .env.example .env

# Bước 2: Điền credentials
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your-client-secret

# Bước 3: Build và khởi động
docker compose up --build

# Bước 4: Mở browser
open http://localhost:3000

# Dừng và xóa container
docker compose down
```

### Chạy local (development)

```bash
# Terminal 1 — Backend
cd backend
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy ./gradlew bootRun

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Mở: http://localhost:3000
```

---

## 9 — Giải thích kỹ thuật quan trọng

### 9.1 Tại sao JSESSIONID hoạt động qua proxy?

HTTP cookie **không gắn với port**, chỉ gắn với **host** (`localhost`).  
Browser nhận `Set-Cookie: JSESSIONID=abc; Path=/; HttpOnly` từ response của `:3000`.  
Từ đó, browser tự động đính kèm cookie này vào **mọi request** tới `localhost:3000`.  
Next.js proxy forward cookie đó xuống `localhost:8080` → Spring nhận ra session ✓

### 9.2 Tại sao cần `forward-headers-strategy: framework`?

Khi Next.js proxy forward request, nó thêm headers:
```
X-Forwarded-Host: localhost:3000
X-Forwarded-Proto: http
```

Không có setting này → Spring tự tính `redirect_uri` dựa trên địa chỉ thực tế:  
`http://localhost:8080/login/oauth2/code/google` → **không khớp** Google Console → lỗi `redirect_uri_mismatch`.

Với `forward-headers-strategy: framework` → Spring đọc `X-Forwarded-Host` →  
tính ra `http://localhost:3000/...` → **khớp** Google Console ✓

### 9.3 Tại sao tắt CSRF?

CSRF protection yêu cầu browser gửi kèm một token ẩn trong mỗi request state-changing.  
Trong kiến trúc này:
- Browser **không bao giờ** gọi trực tiếp BE (không thể giả mạo request đến BE)
- Mọi mutation request đi qua Next.js proxy server

→ Không có vector tấn công CSRF nào áp dụng được.

> **Production note:** Nếu sau này thêm API public, hãy bật lại CSRF với stateless token.

### 9.4 Server Component vs Client Component

| | `dashboard/page.tsx` | `LogoutButton.tsx` |
|---|---|---|
| Loại | **Server Component** | **Client Component** (`'use client'`) |
| Chạy ở | Node.js server | Browser |
| Đọc được `HttpOnly` cookie | ✓ via `cookies()` | ✗ |
| Dùng `useState`, `onClick` | ✗ | ✓ |
| Fetch BE | Trực tiếp (server-to-server) | Qua proxy `/api/be/*` |

### 9.5 Build time vs Runtime — `BE_INTERNAL_URL`

```
next.config.mjs  rewrites()  →  chạy khi: npm run build  →  cần Docker ARG
dashboard/page.tsx  fetch()  →  chạy khi: có HTTP request →  cần runtime ENV
```

| Môi trường | `BE_INTERNAL_URL` |
|---|---|
| Local dev | `http://localhost:8080` (fallback) |
| Docker | `http://backend:8080` (Docker service name) |

---

## 10 — Các lỗi thường gặp & cách khắc phục

| Lỗi | Nguyên nhân | Giải pháp |
|---|---|---|
| `ECONNREFUSED localhost:8080` trong FE | `BE_INTERNAL_URL` không được truyền lúc build → rewrite vẫn dùng `localhost` | Kiểm tra `build.args` trong docker-compose |
| `redirect_uri_mismatch` từ Google | URI đăng ký trên Console không khớp `redirect-uri` trong `application.yml` | Đảm bảo cả hai đều là `http://localhost:3000/api/be/login/oauth2/code/google` |
| `npm ci` thất bại khi build Docker | Chưa có `package-lock.json` | Chạy `npm install` trong `frontend/` để tạo lock file; hoặc dùng `npm install` trong Dockerfile |
| `/app/public: not found` trong Docker build | Thư mục `public/` chưa tồn tại | Thêm `RUN mkdir -p /app/public` trước `npm run build` trong Dockerfile |
| Dashboard trắng / redirect về Login ngay | JSESSIONID không được gửi kèm | Kiểm tra `credentials: 'include'` trong fetch của LogoutButton |
| `invalid_client` từ Google | Sai Client ID hoặc Secret | Kiểm tra giá trị trong `.env` |
| BE không start kịp trước FE | Race condition | `depends_on: backend: condition: service_healthy` đã xử lý; tăng `start_period` nếu cần |
