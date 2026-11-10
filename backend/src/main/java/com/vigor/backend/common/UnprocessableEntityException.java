package com.vigor.backend.common;

import java.util.Map;

/** 422 — the request is well-formed but violates a domain rule. */
public class UnprocessableEntityException extends ApiException {

    public UnprocessableEntityException(String code, String message, Map<String, Object> details) {
        super(422, code, message, details);
    }
}
