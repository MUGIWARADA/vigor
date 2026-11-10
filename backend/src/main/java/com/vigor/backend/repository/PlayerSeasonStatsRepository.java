package com.vigor.backend.repository;

import com.vigor.backend.domain.PlayerSeasonStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PlayerSeasonStatsRepository extends JpaRepository<PlayerSeasonStats, Long> {

    List<PlayerSeasonStats> findAllByPlayerIdIn(Collection<Long> playerIds);
}
