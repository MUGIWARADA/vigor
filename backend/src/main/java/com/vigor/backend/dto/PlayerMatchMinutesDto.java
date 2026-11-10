package com.vigor.backend.dto;

import com.vigor.backend.domain.PlayerMatchMinutes;

import java.math.BigDecimal;

/** Mirrors the frontend's PlayerMatchMinutes type. */
public record PlayerMatchMinutesDto(
        String playerId,
        String matchId,
        int minutes,
        boolean starter,
        BigDecimal rating
) {

    public static PlayerMatchMinutesDto from(PlayerMatchMinutes entity) {
        return new PlayerMatchMinutesDto(
                String.valueOf(entity.getPlayerId()),
                String.valueOf(entity.getMatchId()),
                entity.getMinutes(),
                entity.isStarter(),
                entity.getRating());
    }
}
