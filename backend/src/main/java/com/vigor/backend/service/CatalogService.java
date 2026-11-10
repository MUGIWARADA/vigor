package com.vigor.backend.service;

import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.dto.CompetitionDto;
import com.vigor.backend.dto.SeasonDto;
import com.vigor.backend.dto.TeamDto;
import com.vigor.backend.repository.CompetitionRepository;
import com.vigor.backend.repository.SeasonRepository;
import com.vigor.backend.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Competitions, seasons and teams — reference data reads.
 * Note: teams are not competition-scoped in the Phase 2 schema (membership is
 * implied through matches); a competitions↔teams membership table arrives with
 * multi-competition support in a later phase.
 */
@Service
public class CatalogService {

    private final CompetitionRepository competitions;
    private final SeasonRepository seasons;
    private final TeamRepository teams;

    public CatalogService(CompetitionRepository competitions,
                          SeasonRepository seasons,
                          TeamRepository teams) {
        this.competitions = competitions;
        this.seasons = seasons;
        this.teams = teams;
    }

    @Transactional(readOnly = true)
    public List<CompetitionDto> listCompetitions() {
        return competitions.findAllByOrderByNameAsc().stream().map(CompetitionDto::from).toList();
    }

    /** Seasons, newest first; optionally narrowed to one competition. */
    @Transactional(readOnly = true)
    public List<SeasonDto> listSeasons(Long competitionId) {
        return seasons.findByCompetition(competitionId).stream()
                .sorted((a, b) -> b.getStartDate().compareTo(a.getStartDate()))
                .map(SeasonDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TeamDto> listTeams() {
        return teams.findAllByOrderByNameAsc().stream().map(TeamDto::from).toList();
    }

    @Transactional(readOnly = true)
    public TeamDto getTeam(long id) {
        return teams.findById(id).map(TeamDto::from)
                .orElseThrow(() -> new NotFoundException("team", id));
    }
}
