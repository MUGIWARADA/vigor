package com.vigor.backend.dto;

import com.vigor.backend.domain.Match;

import java.time.Instant;

/** Mirrors the frontend's Match type (kickoff serialises as ISO-8601 UTC). */
public record MatchDto(
        String id,
        String competitionId,
        String seasonId,
        int round,
        Instant kickoff,
        String homeTeamId,
        String awayTeamId,
        int homeGoals,
        int awayGoals,
        String venue,
        int possessionHome,
        int shotsHome,
        int shotsAway,
        String provenance
) {

    public static MatchDto from(Match entity) {
        return new MatchDto(
                String.valueOf(entity.getId()),
                String.valueOf(entity.getCompetitionId()),
                String.valueOf(entity.getSeasonId()),
                entity.getRound(),
                entity.getKickoff(),
                String.valueOf(entity.getHomeTeamId()),
                String.valueOf(entity.getAwayTeamId()),
                entity.getHomeGoals(),
                entity.getAwayGoals(),
                entity.getVenue(),
                entity.getPossessionHome(),
                entity.getShotsHome(),
                entity.getShotsAway(),
                entity.getProvenance());
    }
}
