package com.vigor.backend.repository;

import com.vigor.backend.domain.PlayerMatchMinutes;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlayerMatchMinutesRepository extends JpaRepository<PlayerMatchMinutes, Long> {

    List<PlayerMatchMinutes> findAllByMatchIdOrderByPlayerIdAsc(Long matchId);

    List<PlayerMatchMinutes> findAllByPlayerIdOrderByMatchIdAsc(Long playerId);

    List<PlayerMatchMinutes> findAllByOrderByMatchIdAscPlayerIdAsc();
}
