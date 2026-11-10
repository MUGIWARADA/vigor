package com.vigor.backend.common;

import java.time.Instant;
import java.util.Map;

/**
 * The single error envelope used by every endpoint (see backend/README contract):
 *
 * <pre>{ "code": "...", "message": "...", "details": {...}, "timestamp": "..." }</pre>
 *
 * Codes used in Phase 2: VALIDATION_ERROR, MALFORMED_REQUEST, NOT_FOUND,
 * CONFLICT, INTERNAL_ERROR. HTTP 422 is returned for validation failures.
 */
public record ApiError(
        String code,
        String message,
        Map<String, Object> details,
        Instant timestamp
) {

    public static ApiError of(String code, String message, Map<String, Object> details) {
        return new ApiError(code, message, details == null ? Map.of() : details, Instant.now());
    }
}
