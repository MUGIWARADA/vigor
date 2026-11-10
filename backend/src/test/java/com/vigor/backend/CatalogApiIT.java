package com.vigor.backend;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Competitions, seasons and teams reference endpoints. */
class CatalogApiIT extends IntegrationTestBase {

    @Test
    @DisplayName("competitions list the demo competition")
    void competitions() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/competitions", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<String> names = JsonPath.read(response.getBody(), "$[*].name");
        // The demo seed now carries two competitions: league + cup (Phase 3 gap work).
        assertThat(names).containsExactly("Atlantic Premier League", "Atlantica Cup");
    }

    @Test
    @DisplayName("seasons are filterable by competition and carry ISO dates")
    void seasons() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/seasons?competitionId=1", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(JsonPath.<String>read(response.getBody(), "$[0].label")).isEqualTo("2026/27");
        assertThat(JsonPath.<String>read(response.getBody(), "$[0].startDate")).isEqualTo("2026-08-01");
        assertThat(JsonPath.<String>read(response.getBody(), "$[0].endDate")).isEqualTo("2027-05-31");
    }

    @Test
    @DisplayName("teams list all four demo teams with style and colour")
    void teams() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/teams", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<String> shortNames = JsonPath.read(response.getBody(), "$[*].shortName");
        assertThat(shortNames).containsExactlyInAnyOrder("HAR", "MER", "CAL", "NGR");
    }

    @Test
    @DisplayName("team detail by id returns the full record")
    void teamDetail() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/teams/3", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(JsonPath.<String>read(response.getBody(), "$.name")).isEqualTo("Caldera United");
        assertThat(JsonPath.<String>read(response.getBody(), "$.style")).isEqualTo("Counterattacking");
        assertThat(JsonPath.<String>read(response.getBody(), "$.provenance")).isEqualTo("DEMO");
    }

    @Test
    @DisplayName("unknown team id returns the 404 envelope")
    void unknownTeamIs404() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/teams/9999", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("NOT_FOUND");
    }
}
