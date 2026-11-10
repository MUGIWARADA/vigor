package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * Season aggregate statistics for one player — one row per player per season.
 * In Phase 2 a single active season is supported; the player_id primary key
 * keeps the mapping 1:1 and a future migration widens it to (player_id, season_id).
 *
 * Missing values are NULL — never zero-as-missing (spec §7).
 */
@Entity
@Table(name = "player_season_stats")
public class PlayerSeasonStats extends Auditable {

    @Id
    @Column(name = "player_id")
    private Long playerId;

    @Column(name = "appearances", nullable = false)
    private Integer appearances;

    @Column(name = "minutes", nullable = false)
    private Integer minutes;

    @Column(name = "starts", nullable = false)
    private Integer starts;

    @Column(name = "goals", nullable = false)
    private Integer goals;

    @Column(name = "assists", nullable = false)
    private Integer assists;

    @Column(name = "shots", nullable = false)
    private Integer shots;

    /** Expected goals — model estimate (provenance MODEL_ESTIMATE in the API). */
    @Column(name = "xg", nullable = false, precision = 6, scale = 2)
    private BigDecimal xg;

    /** Expected assists — model estimate. */
    @Column(name = "xa", nullable = false, precision = 6, scale = 2)
    private BigDecimal xa;

    @Column(name = "passes_attempted", nullable = false)
    private Integer passesAttempted;

    @Column(name = "passes_completed", nullable = false)
    private Integer passesCompleted;

    @Column(name = "forward_passes_attempted", nullable = false)
    private Integer forwardPassesAttempted;

    @Column(name = "forward_passes_completed", nullable = false)
    private Integer forwardPassesCompleted;

    @Column(name = "progressive_passes", nullable = false)
    private Integer progressivePasses;

    @Column(name = "passes_final_third", nullable = false)
    private Integer passesFinalThird;

    @Column(name = "line_breaking_passes", nullable = false)
    private Integer lineBreakingPasses;

    @Column(name = "carries", nullable = false)
    private Integer carries;

    @Column(name = "progressive_carries", nullable = false)
    private Integer progressiveCarries;

    @Column(name = "carries_final_third", nullable = false)
    private Integer carriesFinalThird;

    @Column(name = "dribbles_attempted", nullable = false)
    private Integer dribblesAttempted;

    @Column(name = "dribbles_completed", nullable = false)
    private Integer dribblesCompleted;

    @Column(name = "touches", nullable = false)
    private Integer touches;

    @Column(name = "turnovers", nullable = false)
    private Integer turnovers;

    @Column(name = "build_up_receptions", nullable = false)
    private Integer buildUpReceptions;

    @Column(name = "build_up_turnovers", nullable = false)
    private Integer buildUpTurnovers;

    @Column(name = "tackles", nullable = false)
    private Integer tackles;

    @Column(name = "interceptions", nullable = false)
    private Integer interceptions;

    @Column(name = "recoveries", nullable = false)
    private Integer recoveries;

    @Column(name = "recoveries_final_third", nullable = false)
    private Integer recoveriesFinalThird;

    @Column(name = "clearances", nullable = false)
    private Integer clearances;

    @Column(name = "aerials_won", nullable = false)
    private Integer aerialsWon;

    @Column(name = "aerials_contested", nullable = false)
    private Integer aerialsContested;

    /* --- v3 (demo dataset v2): nullable — real API data leaves these NULL --- */

    @Column(name = "tackles_won")
    private Integer tacklesWon;

    @Column(name = "shots_blocked")
    private Integer shotsBlocked;

    @Column(name = "aerials_won_attacking")
    private Integer aerialsWonAttacking;

    @Column(name = "aerials_won_defensive")
    private Integer aerialsWonDefensive;

    @Column(name = "duels_contested")
    private Integer duelsContested;

    @Column(name = "duels_won")
    private Integer duelsWon;

    @Column(name = "long_passes_attempted")
    private Integer longPassesAttempted;

    @Column(name = "long_passes_completed")
    private Integer longPassesCompleted;

    @Column(name = "short_passes_attempted")
    private Integer shortPassesAttempted;

    @Column(name = "short_passes_completed")
    private Integer shortPassesCompleted;

    @Column(name = "chances_created")
    private Integer chancesCreated;

    @Column(name = "carry_distance")
    private Integer carryDistance;

    @Column(name = "saves")
    private Integer saves;

    @Column(name = "xg_prevented", precision = 6, scale = 2)
    private BigDecimal xgPrevented;

    @Column(name = "penalties_faced")
    private Integer penaltiesFaced;

    @Column(name = "penalties_stopped")
    private Integer penaltiesStopped;

    @Column(name = "positioning_attack")
    private Integer positioningAttack;

    @Column(name = "positioning_defense")
    private Integer positioningDefense;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    @Column(name = "source_name", nullable = false, length = 120)
    private String sourceName;

    public PlayerSeasonStats() {
    }

    public Long getPlayerId() {
        return playerId;
    }

    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }

    public Integer getAppearances() { return appearances; }
    public void setAppearances(Integer v) { this.appearances = v; }

    public Integer getMinutes() { return minutes; }
    public void setMinutes(Integer v) { this.minutes = v; }

    public Integer getStarts() { return starts; }
    public void setStarts(Integer v) { this.starts = v; }

    public Integer getGoals() { return goals; }
    public void setGoals(Integer v) { this.goals = v; }

    public Integer getAssists() { return assists; }
    public void setAssists(Integer v) { this.assists = v; }

    public Integer getShots() { return shots; }
    public void setShots(Integer v) { this.shots = v; }

    public BigDecimal getXg() { return xg; }
    public void setXg(BigDecimal v) { this.xg = v; }

    public BigDecimal getXa() { return xa; }
    public void setXa(BigDecimal v) { this.xa = v; }

    public Integer getPassesAttempted() { return passesAttempted; }
    public void setPassesAttempted(Integer v) { this.passesAttempted = v; }

    public Integer getPassesCompleted() { return passesCompleted; }
    public void setPassesCompleted(Integer v) { this.passesCompleted = v; }

    public Integer getForwardPassesAttempted() { return forwardPassesAttempted; }
    public void setForwardPassesAttempted(Integer v) { this.forwardPassesAttempted = v; }

    public Integer getForwardPassesCompleted() { return forwardPassesCompleted; }
    public void setForwardPassesCompleted(Integer v) { this.forwardPassesCompleted = v; }

    public Integer getProgressivePasses() { return progressivePasses; }
    public void setProgressivePasses(Integer v) { this.progressivePasses = v; }

    public Integer getPassesFinalThird() { return passesFinalThird; }
    public void setPassesFinalThird(Integer v) { this.passesFinalThird = v; }

    public Integer getLineBreakingPasses() { return lineBreakingPasses; }
    public void setLineBreakingPasses(Integer v) { this.lineBreakingPasses = v; }

    public Integer getCarries() { return carries; }
    public void setCarries(Integer v) { this.carries = v; }

    public Integer getProgressiveCarries() { return progressiveCarries; }
    public void setProgressiveCarries(Integer v) { this.progressiveCarries = v; }

    public Integer getCarriesFinalThird() { return carriesFinalThird; }
    public void setCarriesFinalThird(Integer v) { this.carriesFinalThird = v; }

    public Integer getDribblesAttempted() { return dribblesAttempted; }
    public void setDribblesAttempted(Integer v) { this.dribblesAttempted = v; }

    public Integer getDribblesCompleted() { return dribblesCompleted; }
    public void setDribblesCompleted(Integer v) { this.dribblesCompleted = v; }

    public Integer getTouches() { return touches; }
    public void setTouches(Integer v) { this.touches = v; }

    public Integer getTurnovers() { return turnovers; }
    public void setTurnovers(Integer v) { this.turnovers = v; }

    public Integer getBuildUpReceptions() { return buildUpReceptions; }
    public void setBuildUpReceptions(Integer v) { this.buildUpReceptions = v; }

    public Integer getBuildUpTurnovers() { return buildUpTurnovers; }
    public void setBuildUpTurnovers(Integer v) { this.buildUpTurnovers = v; }

    public Integer getTackles() { return tackles; }
    public void setTackles(Integer v) { this.tackles = v; }

    public Integer getInterceptions() { return interceptions; }
    public void setInterceptions(Integer v) { this.interceptions = v; }

    public Integer getRecoveries() { return recoveries; }
    public void setRecoveries(Integer v) { this.recoveries = v; }

    public Integer getRecoveriesFinalThird() { return recoveriesFinalThird; }
    public void setRecoveriesFinalThird(Integer v) { this.recoveriesFinalThird = v; }

    public Integer getClearances() { return clearances; }
    public void setClearances(Integer v) { this.clearances = v; }

    public Integer getAerialsWon() { return aerialsWon; }
    public void setAerialsWon(Integer v) { this.aerialsWon = v; }

    public Integer getAerialsContested() { return aerialsContested; }
    public void setAerialsContested(Integer v) { this.aerialsContested = v; }

    /* --- v3 (demo dataset v2) accessors --- */

    public Integer getTacklesWon() { return tacklesWon; }
    public void setTacklesWon(Integer v) { this.tacklesWon = v; }

    public Integer getShotsBlocked() { return shotsBlocked; }
    public void setShotsBlocked(Integer v) { this.shotsBlocked = v; }

    public Integer getAerialsWonAttacking() { return aerialsWonAttacking; }
    public void setAerialsWonAttacking(Integer v) { this.aerialsWonAttacking = v; }

    public Integer getAerialsWonDefensive() { return aerialsWonDefensive; }
    public void setAerialsWonDefensive(Integer v) { this.aerialsWonDefensive = v; }

    public Integer getDuelsContested() { return duelsContested; }
    public void setDuelsContested(Integer v) { this.duelsContested = v; }

    public Integer getDuelsWon() { return duelsWon; }
    public void setDuelsWon(Integer v) { this.duelsWon = v; }

    public Integer getLongPassesAttempted() { return longPassesAttempted; }
    public void setLongPassesAttempted(Integer v) { this.longPassesAttempted = v; }

    public Integer getLongPassesCompleted() { return longPassesCompleted; }
    public void setLongPassesCompleted(Integer v) { this.longPassesCompleted = v; }

    public Integer getShortPassesAttempted() { return shortPassesAttempted; }
    public void setShortPassesAttempted(Integer v) { this.shortPassesAttempted = v; }

    public Integer getShortPassesCompleted() { return shortPassesCompleted; }
    public void setShortPassesCompleted(Integer v) { this.shortPassesCompleted = v; }

    public Integer getChancesCreated() { return chancesCreated; }
    public void setChancesCreated(Integer v) { this.chancesCreated = v; }

    public Integer getCarryDistance() { return carryDistance; }
    public void setCarryDistance(Integer v) { this.carryDistance = v; }

    public Integer getSaves() { return saves; }
    public void setSaves(Integer v) { this.saves = v; }

    public BigDecimal getXgPrevented() { return xgPrevented; }
    public void setXgPrevented(BigDecimal v) { this.xgPrevented = v; }

    public Integer getPenaltiesFaced() { return penaltiesFaced; }
    public void setPenaltiesFaced(Integer v) { this.penaltiesFaced = v; }

    public Integer getPenaltiesStopped() { return penaltiesStopped; }
    public void setPenaltiesStopped(Integer v) { this.penaltiesStopped = v; }

    public Integer getPositioningAttack() { return positioningAttack; }
    public void setPositioningAttack(Integer v) { this.positioningAttack = v; }

    public Integer getPositioningDefense() { return positioningDefense; }
    public void setPositioningDefense(Integer v) { this.positioningDefense = v; }


    public String getProvenance() { return provenance; }
    public void setProvenance(String v) { this.provenance = v; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String v) { this.sourceName = v; }
}
