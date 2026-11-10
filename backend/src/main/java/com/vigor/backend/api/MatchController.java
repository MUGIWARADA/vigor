package com.vigor.backend.api;

import com.vigor.backend.dto.ManualEventRequest;
import com.vigor.backend.dto.MatchDto;
import com.vigor.backend.dto.MatchEventDto;
import com.vigor.backend.dto.PageResponseDto;
import com.vigor.backend.dto.PlayerMatchMinutesDto;
import com.vigor.backend.service.ManualEventService;
import com.vigor.backend.service.MatchService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/**
 * Match reads plus manual event tagging writes (the frontend's manual-tagging
 * contract). Writes are validated server-side; provenance MANUAL is forced.
 */
@RestController
@RequestMapping("/api/v1/matches")
@Validated
public class MatchController {

    private final MatchService matchService;
    private final ManualEventService manualEventService;

    public MatchController(MatchService matchService, ManualEventService manualEventService) {
        this.matchService = matchService;
        this.manualEventService = manualEventService;
    }

    @GetMapping
    public PageResponseDto<MatchDto> list(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) Integer round,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be 0 or greater") Integer page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "pageSize must be between 1 and 100")
            @Max(value = 100, message = "pageSize must be between 1 and 100") Integer pageSize) {
        return matchService.list(teamId, seasonId, round, page, pageSize);
    }

    @GetMapping("/{id}")
    public MatchDto get(@PathVariable long id) {
        return matchService.get(id);
    }

    @GetMapping("/{id}/events")
    public List<MatchEventDto> events(@PathVariable long id,
                                      @RequestParam(required = false) String type) {
        return matchService.events(id, type);
    }

    @GetMapping("/{id}/minutes")
    public List<PlayerMatchMinutesDto> minutes(@PathVariable long id) {
        return matchService.minutesForMatch(id);
    }

    @PostMapping("/{id}/events")
    public ResponseEntity<MatchEventDto> createManualEvent(@PathVariable long id,
                                                           @Valid @RequestBody ManualEventRequest request) {
        MatchEventDto created = manualEventService.create(id, request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .location(URI.create("/api/v1/matches/" + id + "/events/" + created.id()))
                .body(created);
    }

    @DeleteMapping("/{id}/events/{eventId}")
    public ResponseEntity<Void> deleteManualEvent(@PathVariable long id, @PathVariable long eventId) {
        manualEventService.delete(id, eventId);
        return ResponseEntity.noContent().build();
    }
}
