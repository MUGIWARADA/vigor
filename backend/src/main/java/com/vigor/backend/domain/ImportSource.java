package com.vigor.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Registry of external data sources. Imported records carry source_id → this
 * table so every IMPORTED row is tied to its source, version and licence note
 * (spec: provenance & attribution). The DEMO sample dataset does not use it.
 */
@Entity
@Table(name = "import_sources")
public class ImportSource extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    /** Version of the feed/export the records came from. */
    @Column(name = "version", nullable = false, length = 60)
    private String version;

    /** Licence/attribution obligations for records from this source. */
    @Column(name = "licence_note", length = 500)
    private String licenceNote;

    public ImportSource() {
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

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getLicenceNote() {
        return licenceNote;
    }

    public void setLicenceNote(String licenceNote) {
        this.licenceNote = licenceNote;
    }
}
