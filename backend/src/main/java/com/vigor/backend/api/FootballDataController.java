package com.vigor.backend.api;

import com.vigor.backend.client.FootballDataClient;
import com.vigor.backend.common.ApiException;
import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.config.FootballDataProperties;
import com.vigor.backend.dto.FootballDataEnvelope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Real-data proxy (Phase 4a): league tables, fixtures/results and top scorers
 * from football-data.org, wrapped in a provenance envelope (source, fetch
 * timestamp, cache status). The API token stays server-side; the browser never
 * sees it. Competition codes are whitelisted to what the free tier serves.
 */
@RestController
@RequestMapping("/api/v1/fd")
public class FootballDataController {

    private final FootballDataClient client;
    private final FootballDataProperties props;

    public FootballDataController(FootballDataClient client, FootballDataProperties props) {
        this.client = client;
        this.props = props;
    }

    /** Competition catalogue as served by the provider for this token. */
    @GetMapping("/competitions")
    public FootballDataEnvelope competitions() {
        return client.get(null, "/competitions", null);
    }

    @GetMapping("/competitions/{code}/standings")
    public FootballDataEnvelope standings(@PathVariable String code) {
        return forCode(code, () -> client.get(code, "/competitions/" + code + "/standings", null));
    }

    /**
     * Fixtures and results. Optional ISO dates (yyyy-MM-dd) bound the window;
     * without them the provider returns the whole current season.
     */
    @GetMapping("/competitions/{code}/matches")
    public FootballDataEnvelope matches(
            @PathVariable String code,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo) {
        validateDate("dateFrom", dateFrom);
        validateDate("dateTo", dateTo);
        StringBuilder query = new StringBuilder();
        if (dateFrom != null) {
            query.append("dateFrom=").append(dateFrom);
        }
        if (dateTo != null) {
            if (query.length() > 0) {
                query.append('&');
            }
            query.append("dateTo=").append(dateTo);
        }
        String q = query.length() > 0 ? query.toString() : null;
        return forCode(code, () -> client.get(code, "/competitions/" + code + "/matches", q));
    }

    @GetMapping("/competitions/{code}/scorers")
    public FootballDataEnvelope scorers(@PathVariable String code) {
        return forCode(code, () -> client.get(code, "/competitions/" + code + "/scorers", null));
    }

    private FootballDataEnvelope forCode(String code, Supplier<FootballDataEnvelope> call) {
        if (!props.isExposed(code)) {
            throw new NotFoundException("competition", code);
        }
        return call.get();
    }

    private void validateDate(String name, String value) {
        if (value == null) {
            return;
        }
        try {
            LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "VALIDATION_ERROR",
                    "Query parameter '" + name + "' must be an ISO date (yyyy-MM-dd).",
                    Map.of(name, value));
        }
    }
}
