package com.example.sso.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/user")
public class UserController {

    /**
     * Returns basic profile information of the currently authenticated user.
     * Works for both OidcUser (openid scope) and plain OAuth2User
     * because OidcUser extends OAuth2User.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, String>> getCurrentUser(
            @AuthenticationPrincipal OAuth2User principal) {

        if (principal == null) {
            return ResponseEntity.status(401).build();
        }

        Map<String, String> userInfo = Map.of(
            "name",    Objects.toString(principal.getAttribute("name"), ""),
            "email",   Objects.toString(principal.getAttribute("email"), ""),
            "picture", Objects.toString(principal.getAttribute("picture"), "")
        );

        return ResponseEntity.ok(userInfo);
    }
}
