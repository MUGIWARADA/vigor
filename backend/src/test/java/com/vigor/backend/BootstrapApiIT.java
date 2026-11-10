package com.vigor.backend;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * GET /api/v1/bootstrap — the payload the Phase 1 frontend consumes
 * (loadPlatformData → PlatformData). Shape, counts and DEMO labelling.
 */
class BootstrapApiIT extends IntegrationTestBase {

    @Test
    @DisplayName("health endpoint reports UP")
    void healthIsUp() {
        ResponseEntity<String> response = rest.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"UP\"");
    }

    @Test
    @DisplayName("bootstrap returns the PlatformData shape with the DEMO seed dataset")
    void bootstrapReturnsFrontendShape() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/bootstrap", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        String body = response.getBody();
        assertThat(body).isNotNull();

        // Dataset structure the frontend expects.
        assertThat(JsonPath.<String>read(body, "$.dataset.competition.name"))
                .isEqualTo("Atlantic Premier League");
        assertThat(JsonPath.<String>read(body, "$.dataset.season.label")).isEqualTo("2026/27");
        assertThat((List<?>) JsonPath.read(body, "$.dataset.teams")).hasSize(4);
        assertThat((List<?>) JsonPath.read(body, "$.dataset.players")).hasSize(24);
        assertThat((List<?>) JsonPath.read(body, "$.dataset.matches")).hasSize(4);
        assertThat((List<?>) JsonPath.read(body, "$.dataset.playerMatchMinutes")).hasSize(47);

        // Every player carries stats and the DEMO provenance label.
        List<String> playerProvenance = JsonPath.read(body, "$.dataset.players[*].provenance");
        assertThat(playerProvenance).hasSize(24).containsOnly("DEMO");
        List<Object> stats = JsonPath.read(body, "$.dataset.players[*].stats");
        assertThat(stats).hasSize(24);
        Integer anyMinutes = JsonPath.read(body, "$.dataset.players[0].stats.minutes");
        assertThat(anyMinutes).isPositive();

        // Events exist and are DEMO-labelled; scorelines reconcile with goal events.
        List<String> eventProvenance = JsonPath.read(body, "$.dataset.events[*].provenance");
        assertThat(eventProvenance).hasSize(26).containsOnly("DEMO");
        // Matches are ordered newest kickoff first → matches[0] is CAL 3–1 NGR.
        Integer newestHomeGoals = JsonPath.read(body, "$.dataset.matches[0].homeGoals");
        Integer newestAwayGoals = JsonPath.read(body, "$.dataset.matches[0].awayGoals");
        assertThat(newestHomeGoals).isEqualTo(3);
        assertThat(newestAwayGoals).isEqualTo(1);

        // Content modules are intentionally empty in Phase 2 — the frontend
        // renders explicit empty states; the backend never fabricates content.
        assertThat((List<?>) JsonPath.read(body, "$.content.news")).isEmpty();
        assertThat((List<?>) JsonPath.read(body, "$.content.discussions")).isEmpty();
        assertThat((List<?>) JsonPath.read(body, "$.content.shortlists")).isEmpty();
        assertThat((List<?>) JsonPath.read(body, "$.content.formChanges")).isEmpty();
        assertThat((List<?>) JsonPath.read(body, "$.content.demoScenarios")).isEmpty();
    }

    @Test
    @DisplayName("optional fields are omitted from JSON, not sent as null")
    void optionalFieldsAreOmitted() {
        // Event 1 is a goal without an assist — secondaryPlayerId must be absent
        // from the payload entirely (the frontend distinguishes missing vs null).
        ResponseEntity<String> events = rest.getForEntity("/api/v1/matches/1/events", String.class);
        assertThat(events.getStatusCode()).isEqualTo(HttpStatus.OK);
        String eventsBody = events.getBody();
        assertThat(eventsBody).isNotNull();
        assertThat(JsonPath.<Integer>read(eventsBody, "$[0].minute")).isEqualTo(12);
        assertThatThrownBy(() -> JsonPath.read(eventsBody, "$[0].secondaryPlayerId"))
                .isInstanceOf(com.jayway.jsonpath.PathNotFoundException.class);

        // Player 1 (GK) has no secondary position either.
        ResponseEntity<String> player = rest.getForEntity("/api/v1/players/1", String.class);
        String playerBody = player.getBody();
        assertThat(playerBody).isNotNull();
        assertThatThrownBy(() -> JsonPath.read(playerBody, "$.secondaryPosition"))
                .isInstanceOf(com.jayway.jsonpath.PathNotFoundException.class);
    }
}
