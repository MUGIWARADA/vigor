package com.vigor.backend.dto;

import com.vigor.backend.domain.Season;

import java.time.LocalDate;

/** Mirrors the frontend's Season type (dates serialise as ISO strings). */
public record SeasonDto(
        String id,
        String label,
        String competitionId,
        LocalDate startDate,
        LocalDate endDate,
        String provenance
) {

    public static SeasonDto from(Season entity) {
        return new SeasonDto(
                String.valueOf(entity.getId()),
                entity.getLabel(),
                String.valueOf(entity.getCompetitionId()),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getProvenance());
    }
}
