package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * A single match event. Event categories are distinguished by provenance:
 * provider-supplied (DEMO/IMPORTED), manually tagged (MANUAL), and — from later
 * phases — automatically detected and human-verified (spec §10).
 */
@Entity
@Table(name = "match_events")
public class MatchEvent extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "minute", nullable = false)
    private Integer minute;

    /** One of the twelve event types — CHECK-constrained in the database. */
    @Column(name = "type", nullable = false, length = 20)
    private String type;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    /** Primary actor — NULL for team-level events. */
    @Column(name = "player_id")
    private Long playerId;

    /** Secondary actor: assist provider or substitute coming on. */
    @Column(name = "secondary_player_id")
    private Long secondaryPlayerId;

    /** Normalised pitch coordinates, 0–100. NULL when the event has no position. */
    @Column(name = "x", precision = 5, scale = 2)
    private BigDecimal x;

    @Column(name = "y", precision = 5, scale = 2)
    private BigDecimal y;

    /** End point for two-point events (passes, carries) — same 0–100 frame as x/y. */
    @Column(name = "end_x", precision = 5, scale = 2)
    private BigDecimal endX;

    @Column(name = "end_y", precision = 5, scale = 2)
    private BigDecimal endY;

    /** Optional numeric payload, e.g. shot xG. */
    @Column(name = "value", precision = 5, scale = 2)
    private BigDecimal value;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    /** Set for IMPORTED records — ties the row to import_sources. */
    @Column(name = "source_id")
    private Long sourceId;

    public MatchEvent() {
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

    public Integer getMinute() {
        return minute;
    }

    public void setMinute(Integer minute) {
        this.minute = minute;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }

    public Long getPlayerId() {
        return playerId;
    }

    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }

    public Long getSecondaryPlayerId() {
        return secondaryPlayerId;
    }

    public void setSecondaryPlayerId(Long secondaryPlayerId) {
        this.secondaryPlayerId = secondaryPlayerId;
    }

    public BigDecimal getX() {
        return x;
    }

    public void setX(BigDecimal x) {
        this.x = x;
    }

    public BigDecimal getY() {
        return y;
    }

    public void setY(BigDecimal y) {
        this.y = y;
    }

    public BigDecimal getEndX() {
        return endX;
    }

    public void setEndX(BigDecimal endX) {
        this.endX = endX;
    }

    public BigDecimal getEndY() {
        return endY;
    }

    public void setEndY(BigDecimal endY) {
        this.endY = endY;
    }

    public BigDecimal getValue() {
        return value;
    }

    public void setValue(BigDecimal value) {
        this.value = value;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
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
