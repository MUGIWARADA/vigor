package com.vigor.backend.repository;

import com.vigor.backend.domain.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    /**
     * Filtered player search. All filters are optional (NULL disables them).
     * minMinutes is applied against the joined season stats via an EXISTS
     * subquery (spec-safe JPQL, no ad-hoc join).
     *
     * Sorting and paging happen in the service layer over the filtered result —
     * documented in backend/README (Phase 2 dataset scale); DB-level pagination
     * is a tracked follow-up once datasets grow.
     */
    @Query("select p from Player p where " +
           "(:teamId is null or p.teamId = :teamId) and " +
           "(:position is null or p.position = cast(:position as string)) and " +
           "(:name is null or lower(p.fullName) like lower(concat('%', cast(:name as string), '%'))) and " +
           "(:minMinutes is null or exists " +
           "  (select s.id from PlayerSeasonStats s where s.playerId = p.id and s.minutes >= :minMinutes))")
    List<Player> search(@Param("teamId") Long teamId,
                        @Param("position") String position,
                        @Param("name") String name,
                        @Param("minMinutes") Integer minMinutes);

    List<Player> findAllByOrderByFullNameAsc();
}
