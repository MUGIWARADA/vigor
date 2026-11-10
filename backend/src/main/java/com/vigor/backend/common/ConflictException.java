package com.vigor.backend.common;

import java.util.Map;

/** 409 — the request conflicts with the current state of the resource. */
public class ConflictException extends ApiException {

    public ConflictException(String code, String message, Map<String, Object> details) {
        super(409, code, message, details);
    }
}
