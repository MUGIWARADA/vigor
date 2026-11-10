package com.vigor.backend.api;

import com.vigor.backend.dto.BootstrapDto;
import com.vigor.backend.service.BootstrapService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bootstrap payload for the Phase 1 frontend (loadPlatformData).
 * Served from the database — sample rows carry the DEMO provenance label.
 */
@RestController
@RequestMapping("/api/v1")
public class BootstrapController {

    private final BootstrapService bootstrapService;

    public BootstrapController(BootstrapService bootstrapService) {
        this.bootstrapService = bootstrapService;
    }

    @GetMapping("/bootstrap")
    public BootstrapDto bootstrap() {
        return bootstrapService.bootstrap();
    }
}
