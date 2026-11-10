package com.vigor.backend.repository;

import com.vigor.backend.domain.MatchEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MatchEventRepository extends JpaRepository<MatchEvent, Long> {

    List<MatchEvent> findAllByMatchIdOrderByMinuteAscIdAsc(Long matchId);

    @Query("select e from MatchEvent e where e.matchId = :matchId " +
           "and (:type is null or e.type = :type) order by e.minute asc, e.id asc")
    List<MatchEvent> findByMatch(@Param("matchId") Long matchId, @Param("type") String type);

    List<MatchEvent> findAllByOrderByMatchIdAscMinuteAscIdAsc();
}
