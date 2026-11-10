package com.vigor.backend.repository;

import com.vigor.backend.domain.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MatchRepository extends JpaRepository<Match, Long> {

    /**
     * Filtered match list (all filters optional), newest kickoff first.
     * Sorting/paging over the filtered result happens in the service layer
     * (documented Phase 2 trade-off).
     */
    @Query("select m from Match m where " +
           "(:teamId is null or m.homeTeamId = :teamId or m.awayTeamId = :teamId) and " +
           "(:seasonId is null or m.seasonId = :seasonId) and " +
           "(:round is null or m.round = :round) " +
           "order by m.kickoff desc, m.id desc")
    List<Match> search(@Param("teamId") Long teamId,
                       @Param("seasonId") Long seasonId,
                       @Param("round") Integer round);
}
