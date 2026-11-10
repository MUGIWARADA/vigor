package com.vigor.backend.common;

import java.util.Map;

/**
 * Base class for expected, handled failures. Carries the HTTP status, a stable
 * machine-readable code and optional details for the error envelope.
 */
public class ApiException extends RuntimeException {

    private final int status;
    private final String code;
    private final Map<String, Object> details;

    public ApiException(int status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details == null ? Map.of() : details;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
