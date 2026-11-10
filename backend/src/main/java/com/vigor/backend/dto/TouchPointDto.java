package com.vigor.backend.dto;

import java.math.BigDecimal;

/**
 * Demo spatial sample point for the profile action map (frontend TouchPoint).
 * The Phase 2 backend does not store touch maps — bootstrap returns an empty
 * list per player and the UI states that real positional data requires a
 * licensed provider. The shape exists so later phases can fill it without a
 * breaking contract change.
 */
public record TouchPointDto(
        BigDecimal x,
        BigDecimal y,
        BigDecimal w
) {
}
