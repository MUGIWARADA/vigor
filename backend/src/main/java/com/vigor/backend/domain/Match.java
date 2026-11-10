package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "matches")
public class Match extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "round", nullable = false)
    private Integer round;

    @Column(name = "kickoff", nullable = false)
    private Instant kickoff;

    @Column(name = "home_team_id", nullable = false)
    private Long homeTeamId;

    @Column(name = "away_team_id", nullable = false)
    private Long awayTeamId;

    @Column(name = "home_goals", nullable = false)
    private Integer homeGoals;

    @Column(name = "away_goals", nullable = false)
    private Integer awayGoals;

    @Column(name = "venue", nullable = false, length = 120)
    private String venue;

    /** Whole-number home possession share, 0–100. */
    @Column(name = "possession_home", nullable = false)
    private Integer possessionHome;

    @Column(name = "shots_home", nullable = false)
    private Integer shotsHome;

    @Column(name = "shots_away", nullable = false)
    private Integer shotsAway;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    /** Set for IMPORTED records — ties the row to import_sources. */
    @Column(name = "source_id")
    private Long sourceId;

    public Match() {
    }

    public Long getId() {
        return id;
    }

    public Long getCompetitionId() {
        return competitionId;
    }

    public void setCompetitionId(Long competitionId) {
        this.competitionId = competitionId;
    }

    public Long getSeasonId() {
        return seasonId;
    }

    public void setSeasonId(Long seasonId) {
        this.seasonId = seasonId;
    }

    public Integer getRound() {
        return round;
    }

    public void setRound(Integer round) {
        this.round = round;
    }

    public Instant getKickoff() {
        return kickoff;
    }

    public void setKickoff(Instant kickoff) {
        this.kickoff = kickoff;
    }

    public Long getHomeTeamId() {
        return homeTeamId;
    }

    public void setHomeTeamId(Long homeTeamId) {
        this.homeTeamId = homeTeamId;
    }

    public Long getAwayTeamId() {
        return awayTeamId;
    }

    public void setAwayTeamId(Long awayTeamId) {
        this.awayTeamId = awayTeamId;
    }

    public Integer getHomeGoals() {
        return homeGoals;
    }

    public void setHomeGoals(Integer homeGoals) {
        this.homeGoals = homeGoals;
    }

    public Integer getAwayGoals() {
        return awayGoals;
    }

    public void setAwayGoals(Integer awayGoals) {
        this.awayGoals = awayGoals;
    }

    public String getVenue() {
        return venue;
    }

    public void setVenue(String venue) {
        this.venue = venue;
    }

    public Integer getPossessionHome() {
        return possessionHome;
    }

    public void setPossessionHome(Integer possessionHome) {
        this.possessionHome = possessionHome;
    }

    public Integer getShotsHome() {
        return shotsHome;
    }

    public void setShotsHome(Integer shotsHome) {
        this.shotsHome = shotsHome;
    }

    public Integer getShotsAway() {
        return shotsAway;
    }

    public void setShotsAway(Integer shotsAway) {
        this.shotsAway = shotsAway;
    }

    public String getProvenance() {
        return provenance;
    }

    public void setProvenance(String provenance) {
        this.provenance = provenance;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public void setSourceId(Long sourceId) {
        this.sourceId = sourceId;
    }
}
