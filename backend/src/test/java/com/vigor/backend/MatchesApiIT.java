package com.vigor.backend;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Matches, events, minutes and manual event tagging (validation + errors). */
class MatchesApiIT extends IntegrationTestBase {

    @Test
    @DisplayName("match list is filterable by team (home or away)")
    void matchListFilterByTeam() {
        ResponseEntity<String> all = rest.getForEntity("/api/v1/matches?pageSize=50", String.class);
        assertThat(all.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((List<?>) JsonPath.read(all.getBody(), "$.items")).hasSize(4);

        ResponseEntity<String> harbour =
                rest.getForEntity("/api/v1/matches?teamId=1&pageSize=50", String.class);
        assertThat((List<?>) JsonPath.read(harbour.getBody(), "$.items")).hasSize(2);
        List<String> kickoffs = JsonPath.read(harbour.getBody(), "$.items[*].kickoff");
        // Newest kickoff first.
        assertThat(kickoffs).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    @DisplayName("match detail returns the full record")
    void matchDetail() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/matches/1", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(JsonPath.<String>read(response.getBody(), "$.venue")).isEqualTo("Harbour Ground");
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.homeGoals")).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.awayGoals")).isEqualTo(1);
        assertThat(JsonPath.<String>read(response.getBody(), "$.provenance")).isEqualTo("DEMO");
    }

    @Test
    @DisplayName("unknown match id returns the 404 envelope")
    void unknownMatchIs404() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/matches/9999", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("NOT_FOUND");
    }

    @Test
    @DisplayName("events are ordered by minute and filterable by type")
    void eventsOrderedAndFilterable() {
        ResponseEntity<String> all = rest.getForEntity("/api/v1/matches/1/events", String.class);
        assertThat(all.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Integer> minutes = JsonPath.read(all.getBody(), "$[*].minute");
        assertThat(minutes).isSorted().containsExactly(12, 20, 34, 41, 58, 63, 71, 78);

        ResponseEntity<String> goals = rest.getForEntity("/api/v1/matches/1/events?type=goal", String.class);
        List<String> types = JsonPath.read(goals.getBody(), "$[*].type");
        assertThat(types).containsOnly("goal");
        assertThat(types).hasSize(3);
    }

    @Test
    @DisplayName("match minutes rows are returned per player")
    void matchMinutes() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/matches/1/minutes", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((List<?>) JsonPath.read(response.getBody(), "$")).hasSize(12);
    }

    @Test
    @DisplayName("manual event: happy path stores a MANUAL-provenance tag")
    void createManualEvent() {
        String body = """
                {
                  "minute": 55,
                  "type": "turnover",
                  "teamId": "1",
                  "playerId": "4",
                  "x": 42.5,
                  "y": 61.0,
                  "note": "Loose touch under pressure on the left touchline."
                }
                """;
        ResponseEntity<String> created = postManualEvent(1, body);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(JsonPath.<String>read(created.getBody(), "$.provenance")).isEqualTo("MANUAL");
        assertThat(JsonPath.<String>read(created.getBody(), "$.teamId")).isEqualTo("1");
        assertThat(JsonPath.<String>read(created.getBody(), "$.note")).contains("Loose touch");

        // The new event appears in the match event list.
        String eventId = JsonPath.read(created.getBody(), "$.id");
        ResponseEntity<String> events = rest.getForEntity("/api/v1/matches/1/events?type=turnover", String.class);
        List<String> ids = JsonPath.read(events.getBody(), "$[*].id");
        assertThat(ids).contains(eventId);

        // Clean up so other tests observe the seed state.
        ResponseEntity<Void> deleted =
                rest.exchange("/api/v1/matches/1/events/" + eventId, HttpMethod.DELETE,
                        new HttpEntity<Void>(new HttpHeaders()), Void.class);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @DisplayName("manual event: bean validation failures return 422 with field details")
    void manualEventValidationErrors() {
        String body = """
                {
                  "minute": 95,
                  "type": "nuclear-launch",
                  "teamId": "",
                  "x": 250
                }
                """;
        ResponseEntity<String> response = postManualEvent(1, body);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("VALIDATION_ERROR");
        Map<String, Object> details = JsonPath.read(response.getBody(), "$.details");
        assertThat(details).containsKeys("minute", "type", "teamId", "x");
    }

    @Test
    @DisplayName("manual event: team not in the match is rejected (TEAM_NOT_IN_MATCH)")
    void manualEventTeamNotInMatch() {
        String body = """
                {
                  "minute": 10,
                  "type": "turnover",
                  "teamId": "2"
                }
                """;
        ResponseEntity<String> response = postManualEvent(1, body);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("TEAM_NOT_IN_MATCH");
    }

    @Test
    @DisplayName("manual event: player from the wrong team is rejected (PLAYER_TEAM_MISMATCH)")
    void manualEventPlayerTeamMismatch() {
        // Player 18 (Moreau) plays for team 3; match 1 is team 1 vs team 3 —
        // tagging him for team 1 must fail.
        String body = """
                {
                  "minute": 10,
                  "type": "turnover",
                  "teamId": "1",
                  "playerId": "18"
                }
                """;
        ResponseEntity<String> response = postManualEvent(1, body);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("PLAYER_TEAM_MISMATCH");
    }

    @Test
    @DisplayName("manual event: unknown player reference is rejected (PLAYER_NOT_FOUND)")
    void manualEventUnknownPlayer() {
        String body = """
                {
                  "minute": 10,
                  "type": "turnover",
                  "teamId": "1",
                  "playerId": "9999"
                }
                """;
        ResponseEntity<String> response = postManualEvent(1, body);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("PLAYER_NOT_FOUND");
    }

    @Test
    @DisplayName("provider events cannot be deleted (ONLY_MANUAL_EVENTS_DELETABLE)")
    void providerEventNotDeletable() {
        ResponseEntity<String> response = rest.exchange("/api/v1/matches/1/events/1",
                HttpMethod.DELETE, new HttpEntity<Void>(new HttpHeaders()), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code"))
                .isEqualTo("ONLY_MANUAL_EVENTS_DELETABLE");
    }

    @Test
    @DisplayName("malformed JSON body returns 400 MALFORMED_REQUEST")
    void malformedJson() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = rest.exchange("/api/v1/matches/1/events",
                HttpMethod.POST, new HttpEntity<>("{not json", headers), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("MALFORMED_REQUEST");
    }

    private ResponseEntity<String> postManualEvent(long matchId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange("/api/v1/matches/" + matchId + "/events",
                HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    }
}
