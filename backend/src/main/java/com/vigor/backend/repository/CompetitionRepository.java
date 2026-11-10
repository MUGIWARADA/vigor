package com.vigor.backend.repository;

import com.vigor.backend.domain.Competition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    List<Competition> findAllByOrderByNameAsc();
}
