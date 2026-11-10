package com.vigor.backend.dto;

import com.vigor.backend.domain.Competition;

/** Mirrors the frontend's Competition type. */
public record CompetitionDto(
        String id,
        String name,
        String shortName,
        String provenance
) {

    public static CompetitionDto from(Competition entity) {
        return new CompetitionDto(
                String.valueOf(entity.getId()),
                entity.getName(),
                entity.getShortName(),
                entity.getProvenance());
    }
}
