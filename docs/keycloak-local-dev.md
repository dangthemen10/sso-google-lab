# Mock IdP với Keycloak cho local dev

## 1. Tổng quan kiến trúc

```
Browser (localhost:3000)
    │  click "Continue with Keycloak (dev)"
    ▼
Next.js  ──(proxy /api/be/*) ──►  Spring Boot (internal)
                                       │
                                       │  redirect 302
                                       ▼
                              Keycloak (localhost:8180)
                              [User nhập username/password]
                                       │
                              authorization_code callback
                                       │
                              Spring Boot đổi code → token
                              (gọi nội bộ: keycloak:8080)
                                       │
                                       ▼
                              Session lưu vào Redis
                                       │
                                       ▼
                              Redirect → /dashboard
```

**Điểm quan trọng:** Browser chỉ biết `localhost:8180` (Keycloak login page). Spring Boot gọi Keycloak qua internal Docker hostname `keycloak:8080` — không đi qua internet.

---

## 2. Các file đã thay đổi

### `docker-compose.yml` — thêm service `keycloak`

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:24.0
  command: start-dev
  ports:
    - "8180:8080"           # Admin UI: http://localhost:8180
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
    # Fix split-hostname issuer mismatch (browser dùng localhost:8180,
    # Spring Boot dùng keycloak:8080). Đặt KC_HOSTNAME_URL cố định để
    # token luôn có iss = localhost:8180 bất kể được gọi qua hostname nào.
    KC_HOSTNAME_URL: http://localhost:8180
    KC_HOSTNAME_ADMIN_URL: http://localhost:8180
    KC_HOSTNAME_STRICT: "false"
    KC_HOSTNAME_STRICT_BACKCHANNEL: "false"
    JAVA_OPTS_APPEND: "-Xms128m -Xmx384m"   # giới hạn RAM
  volumes:
    - keycloak_data:/opt/keycloak/data       # persist data
  healthcheck:
    # Dùng bash /dev/tcp vì image không có curl/wget
    test: ["CMD-SHELL", "bash -c '...' | grep -q realm || exit 1"]
    start_period: 60s    # Keycloak khởi động chậm (~30-60s)
```

`backend` phụ thuộc vào `keycloak` healthy:

```yaml
backend:
  environment:
    KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}
    KEYCLOAK_INTERNAL_HOST: keycloak:8080   # server-to-server
  depends_on:
    keycloak:
      condition: service_healthy
```

---

### `backend/src/main/resources/application.yml` — thêm registration + provider

```yaml
registration:
  keycloak:
    client-id: sso-lab-client
    client-secret: ${KEYCLOAK_CLIENT_SECRET:sso-lab-secret}
    redirect-uri: 'http://localhost:3000/api/be/login/oauth2/code/keycloak'
    scope: [openid, email, profile]

provider:
  keycloak:
    # authorization-uri → browser gọi (localhost:8180)
    authorization-uri: http://localhost:8180/realms/sso-lab/protocol/openid-connect/auth
    # Các endpoint còn lại → Spring Boot gọi nội bộ (keycloak:8080)
    token-uri:     http://${KEYCLOAK_INTERNAL_HOST}/realms/sso-lab/protocol/openid-connect/token
    jwk-set-uri:   http://${KEYCLOAK_INTERNAL_HOST}/realms/sso-lab/protocol/openid-connect/certs
    user-info-uri: http://${KEYCLOAK_INTERNAL_HOST}/realms/sso-lab/protocol/openid-connect/userinfo
    user-name-attribute: sub
```

**Tại sao có 2 hostname khác nhau?**

| Endpoint | Hostname | Lý do |
|----------|----------|-------|
| `authorization-uri` | `localhost:8180` | Browser cần truy cập được (public) |
| `token-uri`, `jwk-set-uri`, `user-info-uri` | `keycloak:8080` | Spring Boot gọi qua Docker internal network |

---

### `frontend/app/page.tsx` — thêm nút Keycloak

Thêm nút **"Continue with Keycloak (dev)"** trỏ đến `/api/be/oauth2/authorization/keycloak`, phân biệt với Google/Microsoft bằng divider "or (local dev)".

---

### `.env.example` — thêm biến mới

```env
# Keycloak local mock IdP — set this to the secret copied from Keycloak Admin UI
# (Realm sso-lab → Clients → sso-lab-client → Credentials tab)
KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret-here
```

---

## 3. Setup Keycloak Admin UI (1 lần duy nhất)

> Data được persist trong Docker volume `keycloak_data` → chỉ cần làm 1 lần duy nhất, kể cả khi restart container.

### Bước 1 — Khởi động Keycloak

```bash
docker compose up -d keycloak
```

Chờ khoảng 60 giây rồi mở <http://localhost:8180> → click **Administration Console**.

- Username: `admin`
- Password: `admin`

---

### Bước 2 — Tạo Realm

1. Hover vào dropdown **"Keycloak"** (góc trên trái) → **Create realm**
2. Realm name: `sso-lab`
3. Click **Create**

---

### Bước 3 — Tạo Client

1. Menu trái → **Clients** → **Create client**

2. **Step 1 — General Settings:**
   - Client type: `OpenID Connect`
   - Client ID: `sso-lab-client`
   - Click **Next**

3. **Step 2 — Capability config:**
   - Client authentication: **ON** (confidential client)
   - Authorization: OFF
   - Authentication flow: chỉ tick **Standard flow**
   - Click **Next**

4. **Step 3 — Login settings:**

   | Field | Giá trị |
   |-------|---------|
   | Root URL | `http://localhost:3000` |
   | Home URL | *(để trống)* |
   | Valid redirect URIs | `http://localhost:3000/api/be/login/oauth2/code/keycloak` |
   | Valid post logout redirect URIs | `http://localhost:3000` |
   | Web origins | `http://localhost:3000` |

   → Click **Save**

5. Sau khi save → vào tab **Credentials** → copy **Client secret** → điền vào `.env`:
   ```env
   KEYCLOAK_CLIENT_SECRET=<secret vừa copy>
   ```

---

### Bước 4 — Tạo User test

1. Menu trái → **Users** → **Create new user**
2. Điền thông tin:
   - Username: `testuser`
   - Email: `testuser@example.com`
   - First name: `Test`, Last name: `User`
   - Email verified: **ON**
   - Required user actions: **để trống**
3. Click **Create**
4. Vào tab **Credentials** → **Set password**:
   - Password: `password123`
   - Temporary: **OFF** ← quan trọng, nếu ON sẽ bị bắt đổi mật khẩu
   - Click **Save password**

---

## 4. Khởi động toàn bộ stack

```bash
docker compose up -d --build
```

Mở <http://localhost:3000> → click **Continue with Keycloak (dev)** → đăng nhập:

- Username: `testuser`
- Password: `password123`

Sau khi đăng nhập thành công sẽ redirect về `/dashboard` hiển thị thông tin user.

---

## 5. Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| `keycloak-1 is unhealthy` | Keycloak chưa sẵn sàng | Chờ thêm; check `docker logs sso-google-lab-keycloak-1` |
| Backend start fail ngay sau Keycloak | `depends_on` pass quá sớm | Tăng `start_period` của Keycloak lên `90s` |
| Container tự stop không báo lỗi | OOM — thiếu RAM | Tăng RAM Rancher Desktop lên ≥ 6GB (Preferences → Virtual Machine → Hardware) |
| Mất realm/client sau restart | Volume bị xóa | Kiểm tra `docker volume ls` có `sso-google-lab_keycloak_data` |
| `invalid_redirect_uri` | URL không khớp chính xác | Kiểm tra Valid redirect URIs trong Keycloak Admin khớp với giá trị trong `application.yml` |
| `invalid_token` tại userinfo endpoint | Issuer mismatch — browser dùng `localhost:8180`, Spring Boot dùng `keycloak:8080` | Thêm `KC_HOSTNAME_URL=http://localhost:8180` vào docker-compose (đã được fix sẵn) |

---

## 6. Lưu ý khi chạy trên Rancher Desktop

Rancher Desktop giới hạn RAM mặc định thấp. Stack này cần tối thiểu:

| Service | RAM |
|---------|-----|
| Keycloak (JVM) | ~384 MB |
| Spring Boot (JVM) | ~256 MB |
| Next.js | ~256 MB |
| Redis | ~50 MB |
| **Tổng** | **~950 MB + overhead** |

→ Cấu hình tối thiểu: **2 GB RAM, 2 CPU** cho VM của Rancher Desktop.

Vào: **Rancher Desktop → Preferences → Virtual Machine → Hardware**
