package com.vigor.backend.repository;

import com.vigor.backend.domain.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, Long> {

    List<Team> findAllByOrderByNameAsc();
}
