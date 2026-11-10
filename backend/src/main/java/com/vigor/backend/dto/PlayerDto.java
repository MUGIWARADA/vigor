package com.vigor.backend.dto;

import com.vigor.backend.domain.Player;

import java.time.LocalDate;
import java.util.List;

/** Mirrors the frontend's Player type. Optional fields are omitted when null. */
public record PlayerDto(
        String id,
        String name,
        String teamId,
        String position,
        String secondaryPosition,
        String role,
        String foot,
        LocalDate dob,
        Integer heightCm,
        Integer shirtNumber,
        String provenance,
        String sourceName,
        PlayerStatsDto stats,
        List<TouchPointDto> touchMap
) {

    public static PlayerDto from(Player entity, PlayerStatsDto stats) {
        return new PlayerDto(
                String.valueOf(entity.getId()),
                entity.getFullName(),
                String.valueOf(entity.getTeamId()),
                entity.getPosition(),
                entity.getSecondaryPosition(),
                entity.getRole(),
                entity.getFoot(),
                entity.getDob(),
                entity.getHeightCm(),
                entity.getShirtNumber(),
                entity.getProvenance(),
                entity.getSourceName(),
                stats,
                List.of());
    }
}
