package com.vigor.backend.api;

import com.vigor.backend.dto.CompetitionDto;
import com.vigor.backend.dto.SeasonDto;
import com.vigor.backend.dto.TeamDto;
import com.vigor.backend.service.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Reference data: competitions, seasons, teams. */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/competitions")
    public List<CompetitionDto> competitions() {
        return catalog.listCompetitions();
    }

    @GetMapping("/seasons")
    public List<SeasonDto> seasons(@RequestParam(required = false) Long competitionId) {
        return catalog.listSeasons(competitionId);
    }

    @GetMapping("/teams")
    public List<TeamDto> teams() {
        return catalog.listTeams();
    }

    @GetMapping("/teams/{id}")
    public TeamDto team(@PathVariable long id) {
        return catalog.getTeam(id);
    }
}
