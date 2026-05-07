package com.example.sso.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/v1")
public class HomeController {

    /**
     * Returns basic profile information of the currently authenticated user.
     * Works for both OidcUser (openid scope) and plain OAuth2User
     * because OidcUser extends OAuth2User.
     */
    @GetMapping("/home")
    public ResponseEntity<String> getHomePage() {
        return ResponseEntity.ok("Home Page!");
    }
}
