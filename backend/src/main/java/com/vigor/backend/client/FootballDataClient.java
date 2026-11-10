package com.vigor.backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vigor.backend.common.ApiException;
import com.vigor.backend.config.FootballDataProperties;
import com.vigor.backend.dto.FootballDataEnvelope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thin proxy client for api.football-data.org (v4).
 *
 * Rate-limit discipline (the provider asked us to examine the response
 * headers): every response carries {@code X-Requests-Available-Minute}
 * (requests remaining in the current minute) and {@code X-RequestCounter-Reset}
 * (seconds until the budget resets). This client tracks both headers, waits
 * out the reset window before spending a request when the budget is
 * exhausted, and retries once on HTTP 429. Requests run on virtual threads
 * (spring.threads.virtual.enabled=true), so briefly blocking is cheap.
 *
 * Responses are cached in memory with a configurable TTL so refreshing in the
 * UI does not re-spend budget. The API token is attached server-side only and
 * never reaches the browser.
 */
@Component
public class FootballDataClient {

    private static final Logger log = LoggerFactory.getLogger(FootballDataClient.class);

    private static final String SOURCE = "football-data.org (free tier)";

    private final FootballDataProperties props;
    private final ObjectMapper mapper;
    private final RestClient http;

    private record CachedEntry(JsonNode data, Instant fetchedAt) {}

    private final ConcurrentHashMap<String, CachedEntry> cache = new ConcurrentHashMap<>();

    /** Requests remaining in the current provider minute; -1 = not yet known. */
    private final AtomicInteger available = new AtomicInteger(-1);

    /** Epoch millis when the provider rate-limit budget resets. */
    private final AtomicLong resetAtMillis = new AtomicLong(0);

    public FootballDataClient(FootballDataProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .defaultHeader("X-Auth-Token", props.getToken())
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Fetch a provider resource as a provenance-labelled envelope. Served from
     * cache when fresh; otherwise throttled against the per-minute budget.
     *
     * @param competition competition code for attribution (null for catalog calls)
     * @param endpoint   provider path, e.g. "/competitions/PL/standings"
     * @param query      optional already-encoded query string without the '?'
     */
    public FootballDataEnvelope get(String competition, String endpoint, String query) {
        if (!props.isConfigured()) {
            throw new ApiException(503, "REAL_DATA_NOT_CONFIGURED",
                    "Real data is not configured: set the FOOTBALL_DATA_TOKEN environment variable on the backend.",
                    Map.of("source", SOURCE));
        }
        String cacheKey = (competition == null ? "" : competition) + ":" + endpoint
                + (query == null ? "" : "?" + query);
        String path = endpoint + (query == null ? "" : "?" + query);

        CachedEntry hit = cache.get(cacheKey);
        if (hit != null && Duration.between(hit.fetchedAt(), Instant.now()).toSeconds() < props.getCacheTtlSeconds()) {
            return envelope(competition, endpoint, hit.fetchedAt(), true, hit.data());
        }

        JsonNode body = fetchWithThrottling(path);
        Instant fetchedAt = Instant.now();
        cache.put(cacheKey, new CachedEntry(body, fetchedAt));
        return envelope(competition, endpoint, fetchedAt, false, body);
    }

    /* ------------------------------------------------------------------ */
    /* Upstream exchange + throttling                                      */
    /* ------------------------------------------------------------------ */

    private JsonNode fetchWithThrottling(String path) {
        awaitBudgetIfExhausted();
        try {
            return exchange(path);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 429) {
                // Budget exhausted despite our tracking: wait out the reset window
                // and retry exactly once.
                long resetSeconds = Math.max(1, parseHeaderInt(ex.getResponseHeaders(), "X-RequestCounter-Reset"));
                log.debug("football-data.org rate limit hit; waiting {}s before one retry", resetSeconds);
                sleepQuietly(resetSeconds * 1000L + 500L);
                return exchange(path);
            }
            throw translate(ex);
        }
    }

    private JsonNode exchange(String path) {
        ResponseEntity<String> response = http.get()
                .uri(path)
                .retrieve()
                .toEntity(String.class);
        updateRateLimits(response.getHeaders());
        try {
            return mapper.readTree(response.getBody() == null ? "{}" : response.getBody());
        } catch (IOException e) {
            throw new ApiException(502, "UPSTREAM_UNREADABLE",
                    "The data source returned a response that could not be parsed.",
                    Map.of("source", SOURCE));
        }
    }

    /** Track the provider's own throttling headers (case-insensitive lookup). */
    private void updateRateLimits(HttpHeaders headers) {
        Integer remaining = parseHeaderInt(headers, "X-Requests-Available-Minute");
        Integer reset = parseHeaderInt(headers, "X-RequestCounter-Reset");
        if (remaining != null) {
            available.set(remaining);
        }
        if (reset != null) {
            resetAtMillis.set(System.currentTimeMillis() + reset * 1000L);
        }
        log.debug("football-data.org budget: {} requests available, reset in {}s", remaining, reset);
    }

    /**
     * Wait out the provider's reset window before spending a request when the
     * tracked budget is exhausted. Synchronized so concurrent requests queue
     * instead of racing into the same exhausted window.
     */
    private synchronized void awaitBudgetIfExhausted() {
        if (available.get() != 0) {
            return;
        }
        long waitMillis = resetAtMillis.get() - System.currentTimeMillis();
        if (waitMillis > 0) {
            log.debug("football-data.org budget exhausted; waiting {} ms", Math.min(waitMillis, 60_000));
            sleepQuietly(Math.min(waitMillis + 250, 60_000));
        }
    }

    private Integer parseHeaderInt(HttpHeaders headers, String name) {
        if (headers == null) {
            return null;
        }
        String value = headers.getFirst(name);
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Map upstream failures onto our error envelope with stable codes. */
    private ApiException translate(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        if (status == 401) {
            return new ApiException(503, "REAL_DATA_AUTH",
                    "The data source rejected the configured API token. Check FOOTBALL_DATA_TOKEN on the backend.",
                    Map.of("source", SOURCE));
        }
        if (status == 403) {
            return new ApiException(503, "REAL_DATA_FORBIDDEN",
                    "The data source restricted this resource — it is likely outside the free tier.",
                    Map.of("source", SOURCE));
        }
        if (status == 404) {
            return new ApiException(404, "NOT_FOUND",
                    "The data source has no resource for this request.",
                    Map.of("source", SOURCE));
        }
        return new ApiException(502, "UPSTREAM_ERROR",
                "The data source responded with HTTP " + status + ".",
                Map.of("source", SOURCE));
    }

    private FootballDataEnvelope envelope(String competition, String endpoint, Instant fetchedAt,
                                          boolean cached, JsonNode data) {
        return new FootballDataEnvelope(SOURCE, endpoint, competition, fetchedAt.toString(), cached, data);
    }
}
