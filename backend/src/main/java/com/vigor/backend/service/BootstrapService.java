package com.vigor.backend.service;

import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.domain.Competition;
import com.vigor.backend.domain.PlayerSeasonStats;
import com.vigor.backend.domain.Season;
import com.vigor.backend.dto.BootstrapDto;
import com.vigor.backend.dto.CompetitionDto;
import com.vigor.backend.dto.MatchDto;
import com.vigor.backend.dto.MatchEventDto;
import com.vigor.backend.dto.PlayerDto;
import com.vigor.backend.dto.PlayerMatchMinutesDto;
import com.vigor.backend.dto.PlayerStatsDto;
import com.vigor.backend.dto.SeasonDto;
import com.vigor.backend.dto.TeamDto;
import com.vigor.backend.repository.CompetitionRepository;
import com.vigor.backend.repository.MatchEventRepository;
import com.vigor.backend.repository.MatchRepository;
import com.vigor.backend.repository.PlayerMatchMinutesRepository;
import com.vigor.backend.repository.PlayerRepository;
import com.vigor.backend.repository.PlayerSeasonStatsRepository;
import com.vigor.backend.repository.SeasonRepository;
import com.vigor.backend.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * Assembles the /api/v1/bootstrap payload — the exact PlatformData shape the
 * Phase 1 frontend expects. Serves the competition's active (most recent)
 * season with all its teams, players, matches, events and minutes rows.
 */
@Service
public class BootstrapService {

    private final CompetitionRepository competitions;
    private final SeasonRepository seasons;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final PlayerSeasonStatsRepository stats;
    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final PlayerMatchMinutesRepository minutes;

    public BootstrapService(CompetitionRepository competitions,
                            SeasonRepository seasons,
                            TeamRepository teams,
                            PlayerRepository players,
                            PlayerSeasonStatsRepository stats,
                            MatchRepository matches,
                            MatchEventRepository events,
                            PlayerMatchMinutesRepository minutes) {
        this.competitions = competitions;
        this.seasons = seasons;
        this.teams = teams;
        this.players = players;
        this.stats = stats;
        this.matches = matches;
        this.events = events;
        this.minutes = minutes;
    }

    @Transactional(readOnly = true)
    public BootstrapDto bootstrap() {
        Competition competition = competitions.findAllByOrderByNameAsc().stream().findFirst()
                .orElseThrow(() -> new NotFoundException("dataset", "active"));
        Season season = seasons.findAllByOrderByStartDateDesc().stream().findFirst()
                .orElseThrow(() -> new NotFoundException("season", "active"));

        Map<Long, PlayerSeasonStats> statsByPlayer = new HashMap<>();
        stats.findAll().forEach(s -> statsByPlayer.put(s.getPlayerId(), s));

        return new BootstrapDto(
                new BootstrapDto.DatasetDto(
                        CompetitionDto.from(competition),
                        SeasonDto.from(season),
                        teams.findAllByOrderByNameAsc().stream().map(TeamDto::from).toList(),
                        players.findAllByOrderByFullNameAsc().stream()
                                .map(p -> PlayerDto.from(p, statsByPlayer.get(p.getId()) == null
                                        ? null
                                        : PlayerStatsDto.from(statsByPlayer.get(p.getId()))))
                                .toList(),
                        matches.search(null, null, null).stream().map(MatchDto::from).toList(),
                        events.findAllByOrderByMatchIdAscMinuteAscIdAsc().stream()
                                .map(MatchEventDto::from).toList(),
                        minutes.findAllByOrderByMatchIdAscPlayerIdAsc().stream()
                                .map(PlayerMatchMinutesDto::from).toList()),
                BootstrapDto.ContentDto.empty());
    }
}
