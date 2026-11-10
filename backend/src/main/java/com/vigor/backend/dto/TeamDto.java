package com.vigor.backend.dto;

import com.vigor.backend.domain.Team;

/** Mirrors the frontend's Team type. */
public record TeamDto(
        String id,
        String name,
        String shortName,
        String city,
        String style,
        String formation,
        String color,
        String provenance,
        String sourceName
) {

    public static TeamDto from(Team entity) {
        return new TeamDto(
                String.valueOf(entity.getId()),
                entity.getName(),
                entity.getShortName(),
                entity.getCity(),
                entity.getStyle(),
                entity.getFormation(),
                entity.getPrimaryColour(),
                entity.getProvenance(),
                entity.getSourceName());
    }
}
