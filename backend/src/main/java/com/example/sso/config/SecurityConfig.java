package com.example.sso.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * The public FE base URL. After a successful login/logout, Spring Security
     * will redirect the browser to this domain (not back to the internal BE port).
     */
    private static final String FE_BASE_URL = "http://localhost:3000";

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            /*
             * CSRF is disabled because:
             *  - The BE is not accessible directly from the browser.
             *  - All requests arrive through the Next.js reverse proxy.
             * In production, evaluate enabling CSRF with a proper token strategy.
             */
            .csrf(AbstractHttpConfigurer::disable)

            .authorizeHttpRequests(auth -> auth
                // Permit Spring Security's internal OAuth2 and login endpoints.
                .requestMatchers("/login/**", "/oauth2/**", "/error").permitAll()
                .anyRequest().authenticated()
            )

            .oauth2Login(oauth2 -> oauth2
                // Redirect to FE dashboard on successful Google authentication.
                .defaultSuccessUrl(FE_BASE_URL + "/dashboard", true)
                // Redirect to FE login page with an error flag on failure.
                .failureUrl(FE_BASE_URL + "?error=true")
            )

            .logout(logout -> logout
                // Accept both GET and POST for /logout (convenient for the demo).
                .logoutRequestMatcher(new AntPathRequestMatcher("/logout"))
                .logoutSuccessUrl(FE_BASE_URL)
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .permitAll()
            )

            .exceptionHandling(ex -> ex
                // For /user/** API calls, return HTTP 401 instead of
                // auto-redirecting the browser to Google — the FE handles that.
                .defaultAuthenticationEntryPointFor(
                    new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                    new AntPathRequestMatcher("/user/**")
                )
            );

        return http.build();
    }
}
