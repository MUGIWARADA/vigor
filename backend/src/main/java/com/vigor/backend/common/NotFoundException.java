package com.vigor.backend.common;

import java.util.Map;

/** 404 — the addressed resource does not exist. */
public class NotFoundException extends ApiException {

    public NotFoundException(String resource, Object id) {
        super(404, "NOT_FOUND",
                "%s '%s' was not found.".formatted(resource, id),
                Map.of("resource", resource, "id", String.valueOf(id)));
    }
}
