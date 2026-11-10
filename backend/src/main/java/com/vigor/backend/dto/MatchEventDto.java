package com.vigor.backend.dto;

import com.vigor.backend.domain.MatchEvent;

import java.math.BigDecimal;

/** Mirrors the frontend's MatchEvent type. Optional fields are omitted when null. */
public record MatchEventDto(
        String id,
        String matchId,
        int minute,
        String type,
        String teamId,
        String playerId,
        String secondaryPlayerId,
        BigDecimal x,
        BigDecimal y,
        BigDecimal value,
        String note,
        String provenance
) {

    public static MatchEventDto from(MatchEvent entity) {
        return new MatchEventDto(
                String.valueOf(entity.getId()),
                String.valueOf(entity.getMatchId()),
                entity.getMinute(),
                entity.getType(),
                String.valueOf(entity.getTeamId()),
                entity.getPlayerId() == null ? null : String.valueOf(entity.getPlayerId()),
                entity.getSecondaryPlayerId() == null ? null : String.valueOf(entity.getSecondaryPlayerId()),
                entity.getX(),
                entity.getY(),
                entity.getValue(),
                entity.getNote(),
                entity.getProvenance());
    }
}
