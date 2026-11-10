package com.vigor.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for API integration tests.
 *
 * Two ways to run (see backend/README "Running the tests"):
 *   1. Default: a hermetic PostgreSQL 17 Testcontainer (requires Docker Desktop).
 *   2. No Docker: point the tests at a local PostgreSQL instance:
 *        mvn verify -Dit.db.url=jdbc:postgresql://localhost:5432/touchline_iq_test ^
 *                   -Dit.db.user=vigor_app -Dit.db.password=change-me
 *      The test database must be EMPTY (Flyway migrates and seeds it).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class IntegrationTestBase {

    private static final PostgreSQLContainer<?> POSTGRES;

    static {
        if (System.getProperty("it.db.url") == null) {
            POSTGRES = new PostgreSQLContainer<>(DockerImageName.parse("postgres:17-alpine"));
            POSTGRES.start();
        } else {
            POSTGRES = null;
        }
    }

    @DynamicPropertySource
    static void dataSource(DynamicPropertyRegistry registry) {
        String url = System.getProperty("it.db.url");
        if (url != null) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.username",
                    () -> System.getProperty("it.db.user", "vigor_app"));
            registry.add("spring.datasource.password",
                    () -> System.getProperty("it.db.password", "change-me"));
        } else {
            registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
            registry.add("spring.datasource.username", POSTGRES::getUsername);
            registry.add("spring.datasource.password", POSTGRES::getPassword);
        }
    }

    @Autowired
    protected TestRestTemplate rest;
}
