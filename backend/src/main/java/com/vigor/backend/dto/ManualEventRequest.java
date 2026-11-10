package com.vigor.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Manual match tag (provenance MANUAL — the backend forces it, never the client).
 * Mirrors the manual-tagging form in the frontend's match analysis module.
 */
public record ManualEventRequest(

        @NotNull(message = "minute is required")
        @Min(value = 1, message = "minute must be between 1 and 90")
        @Max(value = 90, message = "minute must be between 1 and 90")
        Integer minute,

        @NotBlank(message = "type is required")
        @Pattern(regexp = "goal|own-goal|yellow-card|red-card|substitution|shot|chance-created|turnover|recovery|progressive-carry",
                message = "type must be one of the ten supported event types")
        String type,

        @NotBlank(message = "teamId is required")
        String teamId,

        String playerId,

        String secondaryPlayerId,

        @DecimalMin(value = "0", message = "x must be between 0 and 100")
        @DecimalMax(value = "100", message = "x must be between 0 and 100")
        BigDecimal x,

        @DecimalMin(value = "0", message = "y must be between 0 and 100")
        @DecimalMax(value = "100", message = "y must be between 0 and 100")
        BigDecimal y,

        @DecimalMin(value = "0", message = "value (e.g. shot xG) must be between 0 and 1")
        @DecimalMax(value = "1", message = "value (e.g. shot xG) must be between 0 and 1")
        BigDecimal value,

        @Size(max = 500, message = "note must be at most 500 characters")
        String note
) {
}
