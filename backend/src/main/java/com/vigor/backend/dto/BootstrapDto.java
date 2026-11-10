package com.vigor.backend.dto;

import java.util.List;

/**
 * Payload of GET /api/v1/bootstrap — the exact shape the Phase 1 frontend's
 * loadPlatformData() expects (PlatformData). Property names must not change
 * without a frontend migration.
 *
 * content is intentionally empty in Phase 2: news, discussions, shortlists and
 * scenarios are not backend modules yet, and the frontend renders explicit
 * empty states for them rather than the backend fabricating sample content.
 */
public record BootstrapDto(DatasetDto dataset, ContentDto content) {

    public record DatasetDto(
            CompetitionDto competition,
            SeasonDto season,
            List<TeamDto> teams,
            List<PlayerDto> players,
            List<MatchDto> matches,
            List<MatchEventDto> events,
            List<PlayerMatchMinutesDto> playerMatchMinutes
    ) {
    }

    public record ContentDto(
            List<Object> news,
            List<Object> discussions,
            List<Object> shortlists,
            List<Object> formChanges,
            List<Object> demoScenarios
    ) {

        public static ContentDto empty() {
            return new ContentDto(List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }
}
