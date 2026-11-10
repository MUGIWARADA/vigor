package com.vigor.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Vigor backend — Phase 2 core domain.
 *
 * Serves the versioned REST API under /api/v1 and the /api/v1/bootstrap payload
 * the Phase 1 frontend expects when VITE_API_BASE_URL is configured. All sample
 * records are labelled DEMO; imported records carry a reference to their import
 * source (import_sources table).
 */
@SpringBootApplication
public class VigorApplication {

    public static void main(String[] args) {
        SpringApplication.run(VigorApplication.class, args);
    }
}
