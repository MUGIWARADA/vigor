package com.vigor.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Envelope for real-data responses: the provider payload plus the provenance
 * metadata the spec requires. Imported records are always labelled with the
 * source they came from, when they were fetched, and whether they were served
 * from cache — so the UI can display honest attribution.
 */
public record FootballDataEnvelope(
        String source,
        String endpoint,
        String competition,
        String fetchedAt,
        boolean cached,
        JsonNode data) {
}
