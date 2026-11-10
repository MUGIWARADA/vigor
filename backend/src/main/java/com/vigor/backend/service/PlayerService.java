package com.vigor.backend.service;

import com.vigor.backend.common.NotFoundException;
import com.vigor.backend.common.UnprocessableEntityException;
import com.vigor.backend.domain.Player;
import com.vigor.backend.domain.PlayerSeasonStats;
import com.vigor.backend.dto.PageResponseDto;
import com.vigor.backend.dto.PlayerDto;
import com.vigor.backend.dto.PlayerStatsDto;
import com.vigor.backend.repository.PlayerRepository;
import com.vigor.backend.repository.PlayerSeasonStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Player reads with filtering, whitelisted sorting and pagination. */
@Service
public class PlayerService {

    /** Whitelisted sort keys — anything else is rejected with 422. */
    private static final Set<String> SORT_KEYS = Set.of("name", "minutes", "goals", "assists", "xg", "xa");

    private final PlayerRepository players;
    private final PlayerSeasonStatsRepository stats;

    public PlayerService(PlayerRepository players, PlayerSeasonStatsRepository stats) {
        this.players = players;
        this.stats = stats;
    }

    @Transactional(readOnly = true)
    public PageResponseDto<PlayerDto> search(Long teamId,
                                             String position,
                                             String name,
                                             Integer minMinutes,
                                             int page,
                                             int pageSize,
                                             String sort,
                                             String direction) {
        String sortKey = sort == null || sort.isBlank() ? "minutes" : sort;
        if (!SORT_KEYS.contains(sortKey)) {
            throw new UnprocessableEntityException("VALIDATION_ERROR",
                    "Unsupported sort key '%s'. Supported: %s".formatted(sortKey, SORT_KEYS),
                    Map.of("supportedSortKeys", SORT_KEYS));
        }
        boolean ascending = "asc".equalsIgnoreCase(direction);

        List<Player> found = players.search(teamId, position, blankToNull(name), minMinutes);
        Map<Long, PlayerSeasonStats> statsByPlayer = loadStats(found);

        List<Player> sorted = new java.util.ArrayList<>(found);
        Comparator<Player> comparator = comparatorFor(sortKey, statsByPlayer);
        sorted.sort(ascending ? comparator : comparator.reversed());

        List<PlayerDto> dtos = sorted.stream()
                .map(p -> PlayerDto.from(p, statsByPlayer.get(p.getId()) == null
                        ? null
                        : PlayerStatsDto.from(statsByPlayer.get(p.getId()))))
                .toList();
        return PageResponseDto.of(dtos, page, pageSize);
    }

    @Transactional(readOnly = true)
    public PlayerDto get(long id) {
        Player player = players.findById(id)
                .orElseThrow(() -> new NotFoundException("player", id));
        PlayerSeasonStats s = stats.findById(id).orElse(null);
        return PlayerDto.from(player, s == null ? null : PlayerStatsDto.from(s));
    }

    private Map<Long, PlayerSeasonStats> loadStats(List<Player> found) {
        List<Long> ids = found.stream().map(Player::getId).toList();
        Map<Long, PlayerSeasonStats> map = new HashMap<>();
        for (PlayerSeasonStats s : stats.findAllByPlayerIdIn(ids)) {
            map.put(s.getPlayerId(), s);
        }
        return map;
    }

    private static Comparator<Player> comparatorFor(String sortKey,
                                                    Map<Long, PlayerSeasonStats> statsByPlayer) {
        return switch (sortKey) {
            case "name" -> Comparator.comparing(Player::getFullName, String.CASE_INSENSITIVE_ORDER);
            case "goals" -> Comparator.comparingInt(p -> statsOf(p, statsByPlayer).getGoals());
            case "assists" -> Comparator.comparingInt(p -> statsOf(p, statsByPlayer).getAssists());
            case "xg" -> Comparator.comparing(p -> statsOf(p, statsByPlayer).getXg());
            case "xa" -> Comparator.comparing(p -> statsOf(p, statsByPlayer).getXa());
            default -> Comparator.comparingInt(p -> statsOf(p, statsByPlayer).getMinutes());
        };
    }

    /** Stats are required on every player for sorting — a missing row is a data bug. */
    private static PlayerSeasonStats statsOf(Player p, Map<Long, PlayerSeasonStats> statsByPlayer) {
        PlayerSeasonStats s = statsByPlayer.get(p.getId());
        if (s == null) {
            throw new IllegalStateException(
                    "Player %d has no season stats row — data integrity violation.".formatted(p.getId()));
        }
        return s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
