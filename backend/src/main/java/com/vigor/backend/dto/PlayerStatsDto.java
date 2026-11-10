package com.vigor.backend.dto;

import com.vigor.backend.domain.PlayerSeasonStats;

import java.math.BigDecimal;

/**
 * Season aggregate statistics — field names mirror the frontend's
 * PlayerSeasonStats interface exactly (camelCase).
 */
public record PlayerStatsDto(
        int appearances,
        int minutes,
        int starts,
        int goals,
        int assists,
        int shots,
        BigDecimal xg,
        BigDecimal xa,
        int passesAttempted,
        int passesCompleted,
        int forwardPassesAttempted,
        int forwardPassesCompleted,
        int progressivePasses,
        int passesFinalThird,
        int lineBreakingPasses,
        int carries,
        int progressiveCarries,
        int carriesFinalThird,
        int dribblesAttempted,
        int dribblesCompleted,
        int touches,
        int turnovers,
        int buildUpReceptions,
        int buildUpTurnovers,
        int tackles,
        int interceptions,
        int recoveries,
        int recoveriesFinalThird,
        int clearances,
        int aerialsWon,
        int aerialsContested,
        Integer tacklesWon,
        Integer shotsBlocked,
        Integer aerialsWonAttacking,
        Integer aerialsWonDefensive,
        Integer duelsContested,
        Integer duelsWon,
        Integer longPassesAttempted,
        Integer longPassesCompleted,
        Integer shortPassesAttempted,
        Integer shortPassesCompleted,
        Integer chancesCreated,
        Integer carryDistance,
        Integer saves,
        BigDecimal xgPrevented,
        Integer penaltiesFaced,
        Integer penaltiesStopped,
        Integer positioningAttack,
        Integer positioningDefense
) {

    public static PlayerStatsDto from(PlayerSeasonStats s) {
        return new PlayerStatsDto(
                s.getAppearances(), s.getMinutes(), s.getStarts(), s.getGoals(), s.getAssists(),
                s.getShots(), s.getXg(), s.getXa(),
                s.getPassesAttempted(), s.getPassesCompleted(),
                s.getForwardPassesAttempted(), s.getForwardPassesCompleted(),
                s.getProgressivePasses(), s.getPassesFinalThird(), s.getLineBreakingPasses(),
                s.getCarries(), s.getProgressiveCarries(), s.getCarriesFinalThird(),
                s.getDribblesAttempted(), s.getDribblesCompleted(), s.getTouches(),
                s.getTurnovers(), s.getBuildUpReceptions(), s.getBuildUpTurnovers(),
                s.getTackles(), s.getInterceptions(), s.getRecoveries(),
                s.getRecoveriesFinalThird(), s.getClearances(),
                s.getAerialsWon(), s.getAerialsContested(),
                s.getTacklesWon(), s.getShotsBlocked(),
                s.getAerialsWonAttacking(), s.getAerialsWonDefensive(),
                s.getDuelsContested(), s.getDuelsWon(),
                s.getLongPassesAttempted(), s.getLongPassesCompleted(),
                s.getShortPassesAttempted(), s.getShortPassesCompleted(),
                s.getChancesCreated(), s.getCarryDistance(),
                s.getSaves(), s.getXgPrevented(),
                s.getPenaltiesFaced(), s.getPenaltiesStopped(),
                s.getPositioningAttack(), s.getPositioningDefense());
    }
}
