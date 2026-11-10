package com.vigor.backend.service;

import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.domain.Match;
import com.vigor.backend.dto.MatchDto;
import com.vigor.backend.dto.MatchEventDto;
import com.vigor.backend.dto.PageResponseDto;
import com.vigor.backend.dto.PlayerMatchMinutesDto;
import com.vigor.backend.repository.MatchEventRepository;
import com.vigor.backend.repository.MatchRepository;
import com.vigor.backend.repository.PlayerMatchMinutesRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Match, event and minutes reads. */
@Service
public class MatchService {

    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final PlayerMatchMinutesRepository minutes;

    public MatchService(MatchRepository matches,
                        MatchEventRepository events,
                        PlayerMatchMinutesRepository minutes) {
        this.matches = matches;
        this.events = events;
        this.minutes = minutes;
    }

    @Transactional(readOnly = true)
    public PageResponseDto<MatchDto> list(Long teamId, Long seasonId, Integer round,
                                          int page, int pageSize) {
        List<MatchDto> dtos = matches.search(teamId, seasonId, round).stream()
                .map(MatchDto::from)
                .toList();
        return PageResponseDto.of(dtos, page, pageSize);
    }

    @Transactional(readOnly = true)
    public Match getEntity(long id) {
        return matches.findById(id)
                .orElseThrow(() -> new NotFoundException("match", id));
    }

    @Transactional(readOnly = true)
    public MatchDto get(long id) {
        return MatchDto.from(getEntity(id));
    }

    @Transactional(readOnly = true)
    public List<MatchEventDto> events(long matchId, String type) {
        requireMatch(matchId);
        String typeFilter = type == null || type.isBlank() ? null : type.trim();
        return events.findByMatch(matchId, typeFilter).stream()
                .map(MatchEventDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlayerMatchMinutesDto> minutesForMatch(long matchId) {
        requireMatch(matchId);
        return minutes.findAllByMatchIdOrderByPlayerIdAsc(matchId).stream()
                .map(PlayerMatchMinutesDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlayerMatchMinutesDto> minutesForPlayer(long playerId) {
        return minutes.findAllByPlayerIdOrderByMatchIdAsc(playerId).stream()
                .map(PlayerMatchMinutesDto::from)
                .toList();
    }

    private void requireMatch(long matchId) {
        if (!matches.existsById(matchId)) {
            throw new NotFoundException("match", matchId);
        }
    }
}
