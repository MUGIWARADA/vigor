package com.vigor.backend.service;

import com.vigor.backend.common.ConflictException;
import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.common.UnprocessableEntityException;
import com.vigor.backend.domain.Match;
import com.vigor.backend.domain.MatchEvent;
import com.vigor.backend.domain.Player;
import com.vigor.backend.dto.ManualEventRequest;
import com.vigor.backend.dto.MatchEventDto;
import com.vigor.backend.repository.MatchEventRepository;
import com.vigor.backend.repository.PlayerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Creation and deletion of manually tagged match events (provenance MANUAL).
 * Manual tags stay visually and semantically distinct from provider events —
 * the service forces the MANUAL label, clients cannot choose it.
 */
@Service
public class ManualEventService {

    private final MatchService matchService;
    private final MatchEventRepository events;
    private final PlayerRepository players;

    public ManualEventService(MatchService matchService,
                              MatchEventRepository events,
                              PlayerRepository players) {
        this.matchService = matchService;
        this.events = events;
        this.players = players;
    }

    @Transactional
    public MatchEventDto create(long matchId, ManualEventRequest request) {
        Match match = matchService.getEntity(matchId);

        Long teamId = parseId(request.teamId(), "teamId");
        if (!teamId.equals(match.getHomeTeamId()) && !teamId.equals(match.getAwayTeamId())) {
            throw new UnprocessableEntityException("TEAM_NOT_IN_MATCH",
                    "Team %d does not participate in match %d.".formatted(teamId, matchId),
                    Map.of("teamId", request.teamId(), "matchId", matchId));
        }

        Long playerId = parseOptionalId(request.playerId(), "playerId");
        Long secondaryPlayerId = parseOptionalId(request.secondaryPlayerId(), "secondaryPlayerId");

        if (playerId != null) {
            Player player = players.findById(playerId).orElseThrow(() ->
                    new UnprocessableEntityException("PLAYER_NOT_FOUND",
                            "Player '%s' was not found.".formatted(request.playerId()),
                            Map.of("playerId", request.playerId())));
            if (!player.getTeamId().equals(teamId)) {
                throw new UnprocessableEntityException("PLAYER_TEAM_MISMATCH",
                        "Player %s plays for another team and cannot be tagged for team %s in this match."
                                .formatted(request.playerId(), request.teamId()),
                        Map.of("playerId", request.playerId(), "teamId", request.teamId()));
            }
        }
        if (secondaryPlayerId != null) {
            players.findById(secondaryPlayerId).orElseThrow(() ->
                    new UnprocessableEntityException("PLAYER_NOT_FOUND",
                            "Player '%s' was not found.".formatted(request.secondaryPlayerId()),
                            Map.of("playerId", request.secondaryPlayerId())));
        }
        if (playerId != null && playerId.equals(secondaryPlayerId)) {
            throw new UnprocessableEntityException("DUPLICATE_EVENT_ACTOR",
                    "playerId and secondaryPlayerId cannot reference the same player.",
                    Map.of("playerId", request.playerId()));
        }

        MatchEvent event = new MatchEvent();
        event.setMatchId(matchId);
        event.setMinute(request.minute());
        event.setType(request.type());
        event.setTeamId(teamId);
        event.setPlayerId(playerId);
        event.setSecondaryPlayerId(secondaryPlayerId);
        event.setX(request.x());
        event.setY(request.y());
        event.setValue(request.value());
        event.setNote(request.note() == null || request.note().isBlank() ? null : request.note().trim());
        // Forced by the server — manual tags are always MANUAL, never client-chosen.
        event.setProvenance("MANUAL");

        return MatchEventDto.from(events.save(event));
    }

    @Transactional
    public void delete(long matchId, long eventId) {
        MatchEvent event = events.findById(eventId)
                .orElseThrow(() -> new NotFoundException("match event", eventId));
        if (event.getMatchId() != matchId) {
            throw new NotFoundException("match event", eventId);
        }
        if (!"MANUAL".equals(event.getProvenance())) {
            throw new ConflictException("ONLY_MANUAL_EVENTS_DELETABLE",
                    "Only manually tagged events can be deleted. Provider events (provenance %s) are read-only."
                            .formatted(event.getProvenance()),
                    Map.of("eventId", eventId, "provenance", event.getProvenance()));
        }
        events.delete(event);
    }

    private static Long parseId(String raw, String field) {
        try {
            return Long.valueOf(raw.trim());
        } catch (NumberFormatException ex) {
            throw new UnprocessableEntityException("VALIDATION_ERROR",
                    "'%s' must be a numeric id.".formatted(field),
                    Map.of(field, String.valueOf(raw)));
        }
    }

    private static Long parseOptionalId(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return parseId(raw, field);
    }
}
