package com.vigor.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure-JVM test: the proxy configuration normalises its inputs and the
 * competition whitelist behaves case-insensitively (no database, no Spring
 * context needed).
 */
class FootballDataPropertiesTest {

    @Test
    void normalisesBaseUrlTrimsTokenAndUpperCasesCodes() {
        FootballDataProperties props = new FootballDataProperties(
                "https://api.football-data.org/v4/", "  secret-token  ", 300, "pl, SA ,, bl1");
        assertEquals("https://api.football-data.org/v4", props.getBaseUrl());
        assertEquals("secret-token", props.getToken());
        assertTrue(props.isConfigured());
        assertTrue(props.isExposed("PL"));
        assertTrue(props.isExposed("sa"));
        assertFalse(props.isExposed("EL"));
        assertFalse(props.isExposed(null));
    }

    @Test
    void blankTokenMeansUnconfigured() {
        FootballDataProperties props = new FootballDataProperties(
                "https://api.football-data.org/v4", " ", 300, "PL");
        assertFalse(props.isConfigured());
    }
}
