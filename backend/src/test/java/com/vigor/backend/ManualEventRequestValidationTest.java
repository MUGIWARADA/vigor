package com.vigor.backend;

import com.vigor.backend.dto.ManualEventRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit test for the manual-tag contract — no Spring context, no database.
 * Runs on every `mvn test` (Docker and PostgreSQL not required).
 */
class ManualEventRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        if (factory != null) {
            factory.close();
        }
    }

    private static ManualEventRequest valid() {
        return new ManualEventRequest(45, "turnover", "1", "4", null,
                new BigDecimal("42.5"), new BigDecimal("61.0"), null, "note");
    }

    @Test
    @DisplayName("a well-formed manual tag passes validation")
    void validRequestPasses() {
        assertThat(validator.validate(valid())).isEmpty();
    }

    @Test
    @DisplayName("minute must be 1–90 (manual tags are regulation-time only)")
    void minuteBounds() {
        assertThat(violationFields(new ManualEventRequest(0, "turnover", "1", null, null, null, null, null, null)))
                .contains("minute");
        assertThat(violationFields(new ManualEventRequest(91, "turnover", "1", null, null, null, null, null, null)))
                .contains("minute");
        assertThat(violationFields(new ManualEventRequest(null, "turnover", "1", null, null, null, null, null, null)))
                .contains("minute");
    }

    @Test
    @DisplayName("type must be one of the ten supported event types")
    void typeWhitelist() {
        assertThat(violationFields(new ManualEventRequest(45, "var-check", "1", null, null, null, null, null, null)))
                .contains("type");
        assertThat(violationFields(new ManualEventRequest(45, null, "1", null, null, null, null, null, null)))
                .contains("type");
    }

    @Test
    @DisplayName("teamId is required")
    void teamIdRequired() {
        assertThat(violationFields(new ManualEventRequest(45, "goal", " ", null, null, null, null, null, null)))
                .contains("teamId");
    }

    @Test
    @DisplayName("pitch coordinates must be within 0–100")
    void coordinateBounds() {
        assertThat(violationFields(new ManualEventRequest(45, "goal", "1", null, null,
                new BigDecimal("100.01"), null, null, null))).contains("x");
        assertThat(violationFields(new ManualEventRequest(45, "goal", "1", null, null,
                null, new BigDecimal("-0.5"), null, null))).contains("y");
    }

    @Test
    @DisplayName("xG-style value must be within 0–1 and notes capped at 500 characters")
    void valueAndNoteBounds() {
        assertThat(violationFields(new ManualEventRequest(45, "shot", "1", null, null,
                null, null, new BigDecimal("1.5"), null))).contains("value");
        assertThat(violationFields(new ManualEventRequest(45, "goal", "1", null, null,
                null, null, null, "x".repeat(501)))).contains("note");
    }

    private static Set<String> violationFields(ManualEventRequest request) {
        Set<ConstraintViolation<ManualEventRequest>> violations = validator.validate(request);
        return violations.stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(java.util.stream.Collectors.toSet());
    }
}
