package com.vigor.backend.domain;

/**
 * Provenance labels mirrored from the platform specification and the frontend's
 * six-value Provenance type. Stored as VARCHAR with a CHECK constraint in the
 * database (adding values later is a plain migration, no ALTER TYPE needed).
 *
 * DEMO          — fictional sample records (explicitly labelled, never mixed silently)
 * IMPORTED      — records from a connected external source, tied to import_sources
 * CALCULATED    — values computed from stored records (deterministic formulas)
 * MODEL_ESTIMATE— model-derived estimates (e.g. xG), versioned via the source fields
 * MANUAL        — user-created content (e.g. manual match tags)
 * VERIFIED      — human-verified records
 */
public final class Provenance {

    public static final String DEMO = "DEMO";
    public static final String IMPORTED = "IMPORTED";
    public static final String CALCULATED = "CALCULATED";
    public static final String MODEL_ESTIMATE = "MODEL_ESTIMATE";
    public static final String MANUAL = "MANUAL";
    public static final String VERIFIED = "VERIFIED";

    private Provenance() {
    }
}
