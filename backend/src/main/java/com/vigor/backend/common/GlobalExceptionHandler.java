package com.vigor.backend.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Translates every failure into the consistent {@link ApiError} envelope.
 * No stack traces or internal details are ever returned to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Bean Validation failures on @Valid request bodies → 422 VALIDATION_ERROR. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(fe -> fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        ex.getBindingResult().getGlobalErrors()
                .forEach(ge -> fieldErrors.put(ge.getObjectName(), ge.getDefaultMessage()));
        ApiError error = ApiError.of("VALIDATION_ERROR",
                "The request failed validation. Check 'details' for each field.", fieldErrors);
        return ResponseEntity.unprocessableEntity().body(error);
    }

    /** Method-parameter constraint violations (e.g. ?pageSize=0) → 422. */
    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(
            jakarta.validation.ConstraintViolationException ex) {
        Map<String, Object> fieldErrors = new LinkedHashMap<>();
        ex.getConstraintViolations()
                .forEach(v -> fieldErrors.put(v.getPropertyPath().toString(), v.getMessage()));
        ApiError error = ApiError.of("VALIDATION_ERROR",
                "The request failed validation. Check 'details' for each field.", fieldErrors);
        return ResponseEntity.unprocessableEntity().body(error);
    }

    /** Malformed JSON body → 400. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex) {
        return badRequest("The request body could not be parsed as JSON.");
    }

    /** Missing required query parameter → 400. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException ex) {
        return badRequest("Missing required query parameter '%s'.".formatted(ex.getParameterName()));
    }

    /** Wrong query parameter type (e.g. page=abc) → 400. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return badRequest("Query parameter '%s' has an invalid value.".formatted(ex.getName()));
    }

    /** No route matched → 404 envelope (only when the mapping exists for other methods). */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNoHandler(NoHandlerFoundException ex) {
        return notFound("route", ex.getRequestURL());
    }

    /** Domain-raised failures (404/409/422 with stable codes). */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        ApiError error = ApiError.of(ex.getCode(), ex.getMessage(), ex.getDetails());
        return ResponseEntity.status(ex.getStatus()).body(error);
    }

    /** Unexpected failures → 500 with a generic message; details go to the log only. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unhandled exception while processing request", ex);
        ApiError error = ApiError.of("INTERNAL_ERROR",
                "An unexpected error occurred. The incident has been logged.", Map.of());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    private ResponseEntity<ApiError> badRequest(String message) {
        return ResponseEntity.badRequest().body(ApiError.of("MALFORMED_REQUEST", message, Map.of()));
    }

    private ResponseEntity<ApiError> notFound(String resource, Object id) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("NOT_FOUND",
                        "%s '%s' was not found.".formatted(resource, id),
                        Map.of("resource", resource, "id", String.valueOf(id))));
    }
}
