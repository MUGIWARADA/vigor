package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "teams")
public class Team extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "short_name", nullable = false, length = 12)
    private String shortName;

    @Column(name = "city", nullable = false, length = 120)
    private String city;

    @Column(name = "style", nullable = false, length = 40)
    private String style;

    @Column(name = "formation", nullable = false, length = 12)
    private String formation;

    @Column(name = "primary_colour", nullable = false, length = 9)
    private String primaryColour;

    @Column(name = "provenance", nullable = false, length = 20)
    private String provenance;

    @Column(name = "source_name", nullable = false, length = 120)
    private String sourceName;

    /**
     * Optional reference to import_sources — set for IMPORTED records so every
     * imported row is tied to its source; NULL for the DEMO sample records.
     */
    @Column(name = "source_id")
    private Long sourceId;

    public Team() {
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getShortName() {
        return shortName;
    }

    public void setShortName(String shortName) {
        this.shortName = shortName;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public String getFormation() {
        return formation;
    }

    public void setFormation(String formation) {
        this.formation = formation;
    }

    public String getPrimaryColour() {
        return primaryColour;
    }

    public void setPrimaryColour(String primaryColour) {
        this.primaryColour = primaryColour;
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
