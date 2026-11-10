package com.vigor.backend.api;

import com.vigor.backend.dto.PageResponseDto;
import com.vigor.backend.dto.PlayerDto;
import com.vigor.backend.dto.PlayerMatchMinutesDto;
import com.vigor.backend.service.MatchService;
import com.vigor.backend.service.PlayerService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Player reads. All filters are optional; sorting is whitelisted
 * (name, minutes, goals, assists, xg, xa) with direction asc|desc.
 */
@RestController
@RequestMapping("/api/v1/players")
@Validated
public class PlayerController {

    private final PlayerService players;
    private final MatchService matchService;

    public PlayerController(PlayerService players, MatchService matchService) {
        this.players = players;
        this.matchService = matchService;
    }

    @GetMapping
    public PageResponseDto<PlayerDto> list(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Integer minMinutes,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be 0 or greater") Integer page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "pageSize must be between 1 and 100")
            @Max(value = 100, message = "pageSize must be between 1 and 100") Integer pageSize,
            @RequestParam(defaultValue = "minutes") String sort,
            @RequestParam(defaultValue = "desc") String direction) {
        return players.search(teamId, position, name, minMinutes, page, pageSize, sort, direction);
    }

    @GetMapping("/{id}")
    public PlayerDto get(@PathVariable long id) {
        return players.get(id);
    }

    @GetMapping("/{id}/minutes")
    public List<PlayerMatchMinutesDto> minutes(@PathVariable long id) {
        return matchService.minutesForPlayer(id);
    }
}
