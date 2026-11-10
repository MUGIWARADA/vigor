package com.vigor.backend;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** GET /api/v1/players — filters, whitelisted sorting, pagination, errors. */
class PlayersApiIT extends IntegrationTestBase {

    @Test
    @DisplayName("default listing is sorted by minutes, descending")
    void defaultListingSortedByMinutes() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/players?pageSize=50", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Integer> minutes = JsonPath.read(response.getBody(), "$.items[*].stats.minutes");
        assertThat(minutes).isSortedAccordingTo((a, b) -> Integer.compare(b, a));
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.totalElements")).isEqualTo(24);
    }

    @Test
    @DisplayName("team filter returns only that team's players")
    void filterByTeam() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?teamId=1&pageSize=50", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<String> teamIds = JsonPath.read(response.getBody(), "$.items[*].teamId");
        assertThat(teamIds).hasSize(6).containsOnly("1");
    }

    @Test
    @DisplayName("position filter returns only that position")
    void filterByPosition() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?position=GK&pageSize=50", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<String> positions = JsonPath.read(response.getBody(), "$.items[*].position");
        assertThat(positions).hasSize(4).containsOnly("GK");
    }

    @Test
    @DisplayName("name filter is a case-insensitive contains match")
    void filterByName() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?name=moreau&pageSize=50", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<String> names = JsonPath.read(response.getBody(), "$.items[*].name");
        assertThat(names).containsExactly("Andrej Moreau");
    }

    @Test
    @DisplayName("minMinutes filter uses the season stats")
    void filterByMinutes() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?minMinutes=180&pageSize=50", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Integer> minutes = JsonPath.read(response.getBody(), "$.items[*].stats.minutes");
        assertThat(minutes).allSatisfy(m -> assertThat(m).isGreaterThanOrEqualTo(180));
    }

    @Test
    @DisplayName("sort=goals desc puts the top scorer first (Andrej Moreau, 3)")
    void sortByGoalsDescending() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?sort=goals&direction=desc&pageSize=5", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(JsonPath.<String>read(response.getBody(), "$.items[0].name"))
                .isEqualTo("Andrej Moreau");
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.items[0].stats.goals")).isEqualTo(3);
        List<Integer> goals = JsonPath.read(response.getBody(), "$.items[*].stats.goals");
        assertThat(goals).isSortedAccordingTo((a, b) -> Integer.compare(b, a));
    }

    @Test
    @DisplayName("pagination metadata is consistent")
    void paginationMetadata() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/players?page=1&pageSize=10", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.page")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.pageSize")).isEqualTo(10);
        assertThat(JsonPath.<Integer>read(response.getBody(), "$.totalPages")).isEqualTo(3);
        assertThat((List<?>) JsonPath.read(response.getBody(), "$.items")).hasSize(10);
        assertThat(JsonPath.<Boolean>read(response.getBody(), "$.hasNext")).isTrue();
    }

    @Test
    @DisplayName("sorting by an unsupported key is rejected with 422 VALIDATION_ERROR")
    void unsupportedSortKeyRejected() {
        ResponseEntity<String> response =
                rest.getForEntity("/api/v1/players?sort=password", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("VALIDATION_ERROR");
    }

    @Test
    @DisplayName("unknown player id returns the 404 error envelope")
    void unknownPlayerIs404() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/players/9999", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("NOT_FOUND");
        assertThat(JsonPath.<String>read(response.getBody(), "$.message")).contains("9999");
    }

    @Test
    @DisplayName("invalid pageSize is rejected with 422")
    void invalidPageSizeRejected() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/players?pageSize=0", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(JsonPath.<String>read(response.getBody(), "$.code")).isEqualTo("VALIDATION_ERROR");
    }

    @Test
    @DisplayName("player minutes endpoint returns per-match rows")
    void playerMinutes() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/players/18/minutes", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Integer> minutes = JsonPath.read(response.getBody(), "$[*].minutes");
        assertThat(minutes).containsExactlyInAnyOrder(90, 90);
        List<Boolean> starters = JsonPath.read(response.getBody(), "$[*].starter");
        assertThat(starters).containsOnly(true);
    }
}
