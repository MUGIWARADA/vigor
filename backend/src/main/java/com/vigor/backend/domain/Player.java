package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "players")
public class Player extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "position", nullable = false, length = 4)
    private String position;

    /** Secondary position, if any. NULL means none — never a placeholder value. */
    @Column(name = "secondary_position", length = 4)
    private String secondaryPosition;

    @Column(name = "role", nullable = false, length = 40)
    private String role;

    @Column(name = "foot", nullable = false, length = 6)
    private String foot;

    @Column(name = "dob", nullable = false)
    private LocalDate dob;

    @Column(name = "height_cm")
    private Integer heightCm;

    /** Squad shirt number (nullable — imported sources may not carry it). */
    @Column(name = "shirt_number")
    private Integer shirtNumber;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    @Column(name = "source_name", nullable = false, length = 120)
    private String sourceName;

    /** Set for IMPORTED records — ties the row to import_sources. */
    @Column(name = "source_id")
    private Long sourceId;

    public Player() {
    }

    public Long getId() {
        return id;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public String getSecondaryPosition() {
        return secondaryPosition;
    }

    public void setSecondaryPosition(String secondaryPosition) {
        this.secondaryPosition = secondaryPosition;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getFoot() {
        return foot;
    }

    public void setFoot(String foot) {
        this.foot = foot;
    }

    public LocalDate getDob() {
        return dob;
    }

    public void setDob(LocalDate dob) {
        this.dob = dob;
    }

    public Integer getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(Integer heightCm) {
        this.heightCm = heightCm;
    }

    public Integer getShirtNumber() {
        return shirtNumber;
    }

    public void setShirtNumber(Integer shirtNumber) {
        this.shirtNumber = shirtNumber;
    }

    public String getProvenance() {
        return provenance;
    }

    public void setProvenance(String provenance) {
        this.provenance = provenance;
    }

    public String getSourceName() {
        return sourceName;
    }

    public void setSourceName(String sourceName) {
        this.sourceName = sourceName;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public void setSourceId(Long sourceId) {
        this.sourceId = sourceId;
    }
}
