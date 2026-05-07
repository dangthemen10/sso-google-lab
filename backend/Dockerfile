# ─────────────────────────────────────────────
# Stage 1 — Build (Gradle + JDK 21)
# ─────────────────────────────────────────────
FROM gradle:8.8-jdk21-alpine AS builder

WORKDIR /app

# Copy only dependency manifests first to leverage Docker layer cache.
# Gradle re-downloads dependencies only when build.gradle / settings.gradle changes.
COPY build.gradle settings.gradle ./

# Pre-fetch dependencies (offline cache warm-up)
RUN gradle dependencies --no-daemon || true

# Copy the rest of the source code
COPY src ./src

# Build the fat JAR; skip tests for faster image build
RUN gradle bootJar --no-daemon -x test

# ─────────────────────────────────────────────
# Stage 2 — Runtime (JRE 21 only, smaller image)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runner

# Non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
