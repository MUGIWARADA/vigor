package com.vigor.backend.repository;

import com.vigor.backend.domain.Season;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SeasonRepository extends JpaRepository<Season, Long> {

    List<Season> findAllByOrderByStartDateDesc();

    @Query("select s from Season s where :competitionId is null or s.competitionId = :competitionId")
    List<Season> findByCompetition(@Param("competitionId") Long competitionId);
}
