package com.vigor.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Configuration for the football-data.org real-data proxy (Phase 4a).
 *
 * The API token is ONLY ever read from the environment (FOOTBALL_DATA_TOKEN)
 * and lives server-side — it is never exposed to the browser. The competition
 * whitelist restricts proxying to codes the free tier can actually serve
 * (verified 2026-10: PL, PD, SA, BL1, FL1 and CL are accessible; the Europa
 * League and Conference League return 403 on a free token).
 */
@Component
public class FootballDataProperties {

    private final String baseUrl;
    private final String token;
    private final long cacheTtlSeconds;
    private final Set<String> competitionCodes;

    public FootballDataProperties(
            @Value("${touchline.football-data.base-url}") String baseUrl,
            @Value("${touchline.football-data.token}") String token,
            @Value("${touchline.football-data.cache-ttl-seconds}") long cacheTtlSeconds,
            @Value("${touchline.football-data.competition-codes}") String competitionCodes) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        this.token = token == null ? "" : token.trim();
        this.cacheTtlSeconds = cacheTtlSeconds;
        this.competitionCodes = competitionCodes == null ? Set.of()
                : Set.copyOf(Arrays.stream(competitionCodes.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(String::toUpperCase)
                        .collect(Collectors.toSet()));
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getToken() {
        return token;
    }

    /** A token must be configured before any upstream call is made. */
    public boolean isConfigured() {
        return !token.isEmpty();
    }

    public long getCacheTtlSeconds() {
        return cacheTtlSeconds;
    }

    public Set<String> getCompetitionCodes() {
        return competitionCodes;
    }

    /** Case-insensitive whitelist check for a competition code. */
    public boolean isExposed(String code) {
        return code != null && competitionCodes.contains(code.toUpperCase());
    }
}
