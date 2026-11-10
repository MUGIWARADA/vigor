package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/** Minutes played by one player in one match, with starter flag and rating. */
@Entity
@Table(name = "player_match_minutes",
        uniqueConstraints = @jakarta.persistence.UniqueConstraint(
                name = "uq_player_match_minutes_match_player",
                columnNames = {"match_id", "player_id"}))
public class PlayerMatchMinutes extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "minutes", nullable = false)
    private Integer minutes;

    @Column(name = "starter", nullable = false)
    private boolean starter;

    /** Match rating out of 10 — synthetic in the DEMO dataset, NULL if unrated. */
    @Column(name = "rating", precision = 3, scale = 1)
    private BigDecimal rating;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    public PlayerMatchMinutes() {
    }

    public Long getId() {
        return id;
    }

    public Long getMatchId() {
        return matchId;
    }

    public void setMatchId(Long matchId) {
        this.matchId = matchId;
    }

    public Long getPlayerId() {
        return playerId;
    }

    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }

    public Integer getMinutes() {
        return minutes;
    }

    public void setMinutes(Integer minutes) {
        this.minutes = minutes;
    }

    public boolean isStarter() {
        return starter;
    }

    public void setStarter(boolean starter) {
        this.starter = starter;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public String getProvenance() {
        return provenance;
    }

    public void setProvenance(String provenance) {
        this.provenance = provenance;
    }
}
