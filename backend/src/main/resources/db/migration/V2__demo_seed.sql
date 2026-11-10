-- =============================================================================
-- Vigor — Phase 2 DEMO seed dataset
--
-- FICTIONAL SAMPLE DATA. Every row carries provenance='DEMO' and a source_name
-- identifying the seed. It is never mixed silently with real or imported data:
-- imported records will carry provenance='IMPORTED' plus source_id →
-- import_sources (Phase 4 import pipeline).
--
-- Internal consistency (so the demo holds up to inspection):
--   * 1 competition, 1 season, 4 teams, 24 players, 4 matches (rounds 1–2);
--   * scorelines reconcile with goal events;
--   * event positions follow the app-wide convention: x ∈ [0,100], home attacks
--     toward x=100, so AWAY-team event x values are mirrored (x → 100 − x);
--   * season aggregates reconcile with goals/assists tallied from events;
--   * minutes rows reconcile with season minutes and starter flags.
-- =============================================================================

INSERT INTO competitions (id, name, short_name, provenance, source_name)
VALUES (1, 'Atlantic Premier League', 'APL', 'DEMO', 'Demo seed dataset v0.2.0'),
       (2, 'Atlantica Cup',            'AC',  'DEMO', 'Demo seed dataset v0.2.0');

INSERT INTO seasons (id, competition_id, label, start_date, end_date, provenance, source_name)
VALUES (1, 1, '2026/27',       DATE '2026-08-01', DATE '2027-05-31', 'DEMO', 'Demo seed dataset v0.2.0'),
       (2, 2, '2026/27 (cup)', DATE '2026-08-01', DATE '2027-05-31', 'DEMO', 'Demo seed dataset v0.2.0');

INSERT INTO teams (id, name, short_name, city, style, formation, primary_colour, provenance, source_name) VALUES
    (1, 'Harbour City FC', 'HAR', 'Port Meridian', 'Possession-oriented', '4-3-3', '#ffffff', 'DEMO', 'Demo seed dataset v0.2.0'),
    (2, 'Meridian Athletic', 'MER', 'Meridian',     'High-pressing',       '4-2-3-1', '#1e40af', 'DEMO', 'Demo seed dataset v0.2.0'),
    (3, 'Caldera United',   'CAL', 'Caldera',       'Counterattacking',    '4-4-2',   '#f5a524', 'DEMO', 'Demo seed dataset v0.2.0'),
    (4, 'Northgate Rovers', 'NGR', 'Northgate',     'Direct',              '3-5-2',   '#f2707f', 'DEMO', 'Demo seed dataset v0.2.0');

-- players: (id, team, name, position, secondary, role, foot, dob, height)
INSERT INTO players (id, team_id, full_name, position, secondary_position, role, foot, dob, height_cm, shirt_number, provenance, source_name) VALUES
    (1,  1, 'Marek Novak',      'GK', NULL,   'goalkeeper',              'Right', DATE '1995-03-14', 189,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (2,  1, 'Andrej Hoffmann',  'CB', 'DM',   'ball-playing-cb',         'Left',  DATE '1998-07-22', 186,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (3,  1, 'Tomas Wagner',     'LB', NULL,   'attacking-fb',            'Left',  DATE '2000-01-30', 178,  3, 'DEMO', 'Demo seed dataset v0.2.0'),
    (4,  1, 'Luca Bianchi',     'CM', 'DM',   'deep-lying-playmaker',    'Right', DATE '1997-11-05', 175,  8, 'DEMO', 'Demo seed dataset v0.2.0'),
    (5,  1, 'Mateo Silva',      'AM', 'CM',   'advanced-playmaker',      'Left',  DATE '1999-05-18', 172, 10, 'DEMO', 'Demo seed dataset v0.2.0'),
    (6,  1, 'Dario Costa',      'ST', NULL,   'mobile-striker',          'Right', DATE '1998-09-09', 183,  9, 'DEMO', 'Demo seed dataset v0.2.0'),
    (7,  2, 'Emil Larsen',      'GK', NULL,   'goalkeeper',              'Right', DATE '1996-06-01', 191,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (8,  2, 'Viktor Hansen',    'CB', NULL,   'aggressive-cb',           'Right', DATE '1997-02-17', 188,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (9,  2, 'Jonas Berg',       'RB', NULL,   'defensive-fb',            'Right', DATE '2001-04-25', 176,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (10, 2, 'Andrej Marchetti', 'CM', 'AM',   'box-to-box',              'Right', DATE '1996-12-12', 180,  8, 'DEMO', 'Demo seed dataset v0.2.0'),
    (11, 2, 'Kofi Mensah',      'AM', 'LW',   'advanced-playmaker',      'Right', DATE '2000-08-03', 170, 10, 'DEMO', 'Demo seed dataset v0.2.0'),
    (12, 2, 'Ilya Petrov',      'ST', NULL,   'target-forward',          'Left',  DATE '1995-10-28', 192,  9, 'DEMO', 'Demo seed dataset v0.2.0'),
    (13, 3, 'Samuel Osei',      'GK', NULL,   'goalkeeper',              'Left',  DATE '1994-09-19', 187,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (14, 3, 'Milan Kovac',      'CB', NULL,   'aggressive-cb',           'Right', DATE '1999-01-08', 185,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (15, 3, 'Rafael Duarte',    'LB', 'LW',   'attacking-fb',            'Left',  DATE '1998-03-27', 174,  3, 'DEMO', 'Demo seed dataset v0.2.0'),
    (16, 3, 'Pedro Alves',      'DM', 'CM',   'ball-winner',             'Right', DATE '1997-07-15', 177,  6, 'DEMO', 'Demo seed dataset v0.2.0'),
    (17, 3, 'Nathan Cole',      'RW', 'AM',   'winger',                  'Right', DATE '2001-02-14', 168,  7, 'DEMO', 'Demo seed dataset v0.2.0'),
    (18, 3, 'Andrej Moreau',    'ST', NULL,   'mobile-striker',          'Right', DATE '1997-04-06', 184,  9, 'DEMO', 'Demo seed dataset v0.2.0'),
    (19, 4, 'Hugo Ferreira',    'GK', NULL,   'goalkeeper',              'Right', DATE '1995-05-23', 190,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (20, 4, 'Bram De Vries',    'CB', NULL,   'ball-playing-cb',         'Left',  DATE '1996-08-30', 187,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (21, 4, 'Sven Olsen',       'DM', 'CB',   'ball-winner',             'Right', DATE '1998-10-11', 181,  6, 'DEMO', 'Demo seed dataset v0.2.0'),
    (22, 4, 'Karim Aziz',       'RW', 'AM',   'inverted-winger',         'Left',  DATE '2000-06-21', 171,  7, 'DEMO', 'Demo seed dataset v0.2.0'),
    (23, 4, 'Tobias Frank',     'AM', NULL,   'advanced-playmaker',      'Right', DATE '1999-12-03', 173, 10, 'DEMO', 'Demo seed dataset v0.2.0'),
    (24, 4, 'Marcus Bell',      'ST', NULL,   'target-forward',          'Right', DATE '1996-02-05', 193,  9, 'DEMO', 'Demo seed dataset v0.2.0');

-- matches: (id, competition, season, round, kickoff, home, away, hg, ag, venue, poss, shots)
INSERT INTO matches (id, competition_id, season_id, round, kickoff, home_team_id, away_team_id,
                     home_goals, away_goals, venue, possession_home, shots_home, shots_away, provenance) VALUES
    (1, 1, 1, 1, TIMESTAMPTZ '2026-08-08 15:00:00 UTC', 1, 3, 2, 1, 'Harbour Ground',  58, 14,  9, 'DEMO'),
    (2, 1, 1, 1, TIMESTAMPTZ '2026-08-08 17:30:00 UTC', 2, 4, 1, 1, 'Meridian Arena',  61, 16,  7, 'DEMO'),
    (3, 1, 1, 2, TIMESTAMPTZ '2026-08-15 14:00:00 UTC', 1, 2, 0, 2, 'Harbour Ground',  56,  9, 15, 'DEMO'),
    (4, 1, 1, 2, TIMESTAMPTZ '2026-08-15 19:00:00 UTC', 3, 4, 3, 1, 'Caldera Park',    46, 12,  8, 'DEMO');

-- player match minutes: (id, match, player, minutes, starter, rating)
INSERT INTO player_match_minutes (id, match_id, player_id, minutes, starter, rating, provenance) VALUES
    -- match 1: HAR (1-6) vs CAL (13-18)
    (1,  1, 1,  90, TRUE,  7.1, 'DEMO'),
    (2,  1, 2,  90, TRUE,  7.4, 'DEMO'),
    (3,  1, 3,  90, TRUE,  7.8, 'DEMO'),
    (4,  1, 4,  90, TRUE,  7.2, 'DEMO'),
    (5,  1, 5,  90, TRUE,  8.0, 'DEMO'),
    (6,  1, 6,  90, TRUE,  8.2, 'DEMO'),
    (7,  1, 13, 90, TRUE,  6.4, 'DEMO'),
    (8,  1, 14, 90, TRUE,  6.8, 'DEMO'),
    (9,  1, 15, 71, TRUE,  6.5, 'DEMO'),
    (10, 1, 16, 90, TRUE,  7.0, 'DEMO'),
    (11, 1, 17, 19, FALSE, 6.6, 'DEMO'),
    (12, 1, 18, 90, TRUE,  8.4, 'DEMO'),
    -- match 2: MER (7-12) vs NGR (19-24)
    (13, 2, 7,  90, TRUE,  7.0, 'DEMO'),
    (14, 2, 8,  90, TRUE,  7.3, 'DEMO'),
    (15, 2, 9,  90, TRUE,  6.9, 'DEMO'),
    (16, 2, 10, 90, TRUE,  7.6, 'DEMO'),
    (17, 2, 11, 90, TRUE,  7.5, 'DEMO'),
    (18, 2, 12, 90, TRUE,  7.7, 'DEMO'),
    (19, 2, 19, 90, TRUE,  6.3, 'DEMO'),
    (20, 2, 20, 90, TRUE,  6.6, 'DEMO'),
    (21, 2, 21, 85, TRUE,  6.2, 'DEMO'),
    (22, 2, 22, 20, FALSE, 6.4, 'DEMO'),
    (23, 2, 23, 90, TRUE,  7.1, 'DEMO'),
    (24, 2, 24, 90, TRUE,  7.4, 'DEMO'),
    -- match 3: HAR (1-6) vs MER (7-12); Berg (9) did not feature
    (25, 3, 1,  90, TRUE,  6.5, 'DEMO'),
    (26, 3, 2,  90, TRUE,  6.7, 'DEMO'),
    (27, 3, 3,  70, TRUE,  6.4, 'DEMO'),
    (28, 3, 4,  90, TRUE,  6.8, 'DEMO'),
    (29, 3, 5,  65, TRUE,  6.6, 'DEMO'),
    (30, 3, 6,  90, TRUE,  6.3, 'DEMO'),
    (31, 3, 7,  90, TRUE,  7.2, 'DEMO'),
    (32, 3, 8,  90, TRUE,  7.5, 'DEMO'),
    (33, 3, 10, 90, TRUE,  8.1, 'DEMO'),
    (34, 3, 11, 70, TRUE,  7.9, 'DEMO'),
    (35, 3, 12, 90, TRUE,  8.3, 'DEMO'),
    -- match 4: CAL (13-18) vs NGR (19-24)
    (36, 4, 13, 90, TRUE,  6.9, 'DEMO'),
    (37, 4, 14, 90, TRUE,  7.9, 'DEMO'),
    (38, 4, 15, 64, TRUE,  6.7, 'DEMO'),
    (39, 4, 16, 90, TRUE,  7.7, 'DEMO'),
    (40, 4, 17, 90, TRUE,  8.0, 'DEMO'),
    (41, 4, 18, 90, TRUE,  8.6, 'DEMO'),
    (42, 4, 19, 90, TRUE,  6.1, 'DEMO'),
    (43, 4, 20, 90, TRUE,  6.5, 'DEMO'),
    (44, 4, 21, 90, TRUE,  6.0, 'DEMO'),
    (45, 4, 22, 90, TRUE,  7.3, 'DEMO'),
    (46, 4, 23, 90, TRUE,  6.8, 'DEMO'),
    (47, 4, 24, 75, TRUE,  7.0, 'DEMO');

-- match events: (id, match, minute, type, team, player, secondary, x, y, value, note)
INSERT INTO match_events (id, match_id, minute, type, team_id, player_id, secondary_player_id, x, y, end_x, end_y, value, provenance) VALUES
    -- match 1: HAR 2–1 CAL (away-team CAL x values mirrored)
    (1, 1, 12, 'goal', 3, 18, NULL, 37.50, 48.00, NULL, NULL, 0.31, 'DEMO'),
    (2, 1, 20, 'shot', 1, 6, NULL, 78.00, 44.00, NULL, NULL, 0.12, 'DEMO'),
    (3, 1, 34, 'goal', 1, 6, 5, 71.50, 52.00, NULL, NULL, 0.28, 'DEMO'),
    (4, 1, 41, 'yellow-card', 3, 14, NULL, 45.00, 30.00, NULL, NULL, NULL, 'DEMO'),
    (5, 1, 58, 'turnover', 1, 4, NULL, 40.00, 60.00, NULL, NULL, NULL, 'DEMO'),
    (6, 1, 63, 'recovery', 1, 2, NULL, 32.00, 45.00, NULL, NULL, NULL, 'DEMO'),
    (7, 1, 71, 'substitution', 3, 15, 17, 75.00, 15.00, NULL, NULL, NULL, 'DEMO'),
    (8, 1, 78, 'goal', 1, 6, 3, 74.00, 58.00, NULL, NULL, 0.45, 'DEMO'),
    -- match 2: MER 1–1 NGR (away-team NGR x values mirrored)
    (9, 2, 30, 'shot', 2, 12, NULL, 80.00, 50.00, NULL, NULL, 0.09, 'DEMO'),
    (10, 2, 44, 'turnover', 4, 21, NULL, 48.00, 62.00, NULL, NULL, NULL, 'DEMO'),
    (11, 2, 55, 'goal', 2, 12, 11, 76.50, 47.50, NULL, NULL, 0.38, 'DEMO'),
    (12, 2, 66, 'progressive-carry', 2, 11, NULL, 45.00, 70.00, 56.00, 66.00, NULL, 'DEMO'),
    (13, 2, 81, 'goal', 4, 24, 23, 32.00, 40.00, NULL, NULL, 0.62, 'DEMO'),
    -- match 3: HAR 0–2 MER (away-team MER x values mirrored)
    (14, 3, 15, 'shot', 1, 5, NULL, 82.00, 36.00, NULL, NULL, 0.07, 'DEMO'),
    (15, 3, 23, 'goal', 2, 11, 10, 21.00, 55.00, NULL, NULL, 0.26, 'DEMO'),
    (16, 3, 52, 'recovery', 2, 10, NULL, 52.00, 42.00, NULL, NULL, NULL, 'DEMO'),
    (17, 3, 70, 'goal', 2, 12, NULL, 15.00, 50.00, NULL, NULL, 0.76, 'DEMO'),
    (18, 3, 84, 'yellow-card', 1, 3, NULL, 60.00, 25.00, NULL, NULL, NULL, 'DEMO'),
    -- match 4: CAL 3–1 NGR (away-team NGR x values mirrored)
    (19, 4, 8, 'goal', 3, 18, NULL, 72.00, 46.00, NULL, NULL, 0.54, 'DEMO'),
    (20, 4, 21, 'chance-created', 3, 17, NULL, 60.00, 68.00, NULL, NULL, NULL, 'DEMO'),
    (21, 4, 33, 'yellow-card', 4, 21, NULL, 50.00, 55.00, NULL, NULL, NULL, 'DEMO'),
    (22, 4, 39, 'goal', 3, 18, 17, 66.00, 52.00, NULL, NULL, 0.18, 'DEMO'),
    (23, 4, 50, 'shot', 3, 18, NULL, 80.00, 44.00, NULL, NULL, 0.22, 'DEMO'),
    (24, 4, 66, 'goal', 3, 14, 16, 58.00, 50.00, NULL, NULL, 0.28, 'DEMO'),
    (25, 4, 72, 'turnover', 4, 20, NULL, 65.00, 30.00, NULL, NULL, NULL, 'DEMO'),
    (26, 4, 90, 'goal', 4, 22, NULL, 30.00, 35.00, NULL, NULL, 0.41, 'DEMO');

-- season aggregates — reconcile with the events and minutes above.
INSERT INTO player_season_stats
    (player_id, appearances, minutes, starts, goals, assists, shots, xg, xa,
     passes_attempted, passes_completed, forward_passes_attempted, forward_passes_completed,
     progressive_passes, passes_final_third, line_breaking_passes,
     carries, progressive_carries, carries_final_third,
     dribbles_attempted, dribbles_completed, touches, turnovers,
     build_up_receptions, build_up_turnovers, tackles, interceptions, recoveries,
     recoveries_final_third, clearances, aerials_won, aerials_contested, provenance, source_name) VALUES
    (1,  2, 180, 2, 0, 0, 0, 0.00, 0.02,  24,  18,  12,  6,  2,  1,  0,  12,  2,  0,  0,  0,  42,  3,  2,  1,  1,  1,  9,  1,  8,  0,  0, 'DEMO', 'Demo seed dataset v0.2.0'),
    (2,  2, 180, 2, 0, 0, 1, 0.04, 0.18, 168, 152,  62, 50, 18, 10,  6,  14,  4,  2,  0,  0, 128,  6, 12,  2,  3,  4, 14,  2, 10,  1,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (3,  2, 160, 2, 0, 1, 1, 0.06, 0.31, 128, 110,  48, 36, 14,  8,  5,  26,  9,  4,  4,  3,  96,  7,  6,  2,  5,  3, 11,  3,  4,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (4,  2, 180, 2, 0, 0, 2, 0.12, 0.25, 152, 138,  54, 46, 26, 16,  9,  22,  7,  3,  3,  2, 118,  5, 18,  3,  6,  5, 16,  4,  3,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (5,  2, 155, 2, 0, 1, 3, 0.40, 0.42, 118, 102,  46, 37, 16, 12,  8,  31, 12,  7,  8,  5,  92,  9, 14,  4,  4,  2, 10,  5,  1,  0,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (6,  2, 180, 2, 2, 0, 6, 1.15, 0.15,  58,  40,  22, 13,  6,  5,  3,  18,  6,  4,  5,  2,  64,  8,  4,  2,  1,  0,  5,  2,  1,  3,  6, 'DEMO', 'Demo seed dataset v0.2.0'),
    (7,  2, 180, 2, 0, 0, 0, 0.00, 0.01,  30,  21,  14,  7,  2,  0,  0,  10,  1,  0,  0,  0,  38,  2,  2,  1,  0,  1, 10,  0,  9,  0,  0, 'DEMO', 'Demo seed dataset v0.2.0'),
    (8,  2, 180, 2, 0, 0, 1, 0.03, 0.12, 160, 141,  55, 44, 15,  9,  5,  12,  3,  1,  0,  0, 122,  7, 10,  2,  4,  5, 15,  3,  9,  2,  3, 'DEMO', 'Demo seed dataset v0.2.0'),
    (9,  1,  90, 1, 0, 0, 0, 0.00, 0.08,  62,  51,  24, 18,  5,  3,  1,  12,  3,  1,  2,  1,  48,  4,  3,  1,  3,  2,  7,  1,  3,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (10, 2, 180, 2, 0, 1, 2, 0.10, 0.45, 158, 140,  58, 48, 24, 15,  8,  20,  6,  3,  2,  1, 124,  6, 16,  3,  7,  4, 17,  4,  2,  0,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (11, 2, 160, 2, 1, 1, 4, 0.65, 0.38, 112,  95,  44, 34, 15, 11,  7,  34, 14,  8,  9,  6,  88,  8, 12,  3,  3,  1,  9,  4,  1,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (12, 2, 180, 2, 2, 0, 5, 1.05, 0.10,  54,  36,  20, 12,  4,  4,  2,  16,  5,  3,  4,  2,  60,  9,  3,  2,  0,  0,  4,  1,  1,  5,  9, 'DEMO', 'Demo seed dataset v0.2.0'),
    (13, 2, 180, 2, 0, 0, 0, 0.00, 0.02,  26,  18,  10,  5,  1,  0,  0,  11,  1,  0,  0,  0,  40,  3,  2,  1,  1,  1,  8,  1, 11,  0,  0, 'DEMO', 'Demo seed dataset v0.2.0'),
    (14, 2, 180, 2, 1, 0, 2, 0.30, 0.05, 132, 103,  46, 33, 10,  6,  3,  10,  2,  1,  0,  0,  98,  8,  8,  3,  5,  6, 13,  2, 14,  4,  7, 'DEMO', 'Demo seed dataset v0.2.0'),
    (15, 2, 135, 2, 0, 0, 0, 0.05, 0.20, 108,  84,  38, 27,  9,  5,  3,  24,  8,  4,  6,  4,  82,  9,  5,  2,  6,  4, 12,  3,  3,  0,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (16, 2, 180, 2, 0, 1, 1, 0.02, 0.22, 138, 111,  44, 32, 12,  7,  4,  14,  4,  2,  1,  0, 104, 10, 14,  5,  8,  7, 18,  3,  6,  1,  3, 'DEMO', 'Demo seed dataset v0.2.0'),
    (17, 2, 109, 1, 0, 1, 2, 0.18, 0.36,  54,  38,  24, 15,  6,  4,  2,  32, 13,  7, 10,  6,  70,  7,  4,  1,  2,  1,  6,  3,  1,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (18, 2, 180, 2, 3, 0, 7, 1.45, 0.12,  48,  31,  18, 10,  3,  3,  1,  14,  5,  3,  6,  3,  58,  7,  2,  1,  0,  0,  4,  2,  0,  2,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (19, 2, 180, 2, 0, 0, 0, 0.00, 0.03,  22,  14,  12,  6,  1,  0,  0,   9,  1,  0,  0,  0,  36,  2,  1,  1,  0,  0,  7,  0, 10,  0,  0, 'DEMO', 'Demo seed dataset v0.2.0'),
    (20, 2, 180, 2, 0, 0, 0, 0.02, 0.10, 128,  97,  42, 29,  8,  4,  2,  11,  2,  1,  0,  0,  92,  9,  7,  3,  6,  5, 14,  2, 16,  5,  8, 'DEMO', 'Demo seed dataset v0.2.0'),
    (21, 2, 175, 2, 0, 0, 1, 0.00, 0.06, 124,  95,  38, 26,  9,  5,  3,  12,  3,  2,  1,  0,  96, 11, 13,  5,  9,  8, 17,  2,  7,  1,  4, 'DEMO', 'Demo seed dataset v0.2.0'),
    (22, 2, 110, 1, 1, 0, 3, 0.50, 0.15,  44,  30,  20, 12,  4,  3,  2,  22,  9,  5,  7,  4,  58,  6,  3,  1,  1,  1,  5,  2,  1,  0,  1, 'DEMO', 'Demo seed dataset v0.2.0'),
    (23, 2, 180, 2, 0, 1, 3, 0.22, 0.29, 104,  82,  40, 29, 12,  8,  5,  26,  9,  5,  5,  3,  86,  8, 10,  3,  3,  2,  8,  3,  1,  0,  2, 'DEMO', 'Demo seed dataset v0.2.0'),
    (24, 2, 165, 2, 1, 0, 4, 0.85, 0.08,  50,  33,  19, 11,  3,  2,  1,  15,  4,  2,  5,  2,  62,  8,  3,  2,  0,  0,  3,  1,  0,  6, 11, 'DEMO', 'Demo seed dataset v0.2.0');

-- Advance identity sequences past the explicit seed ids.
-- (player_season_stats.player_id is a plain FK primary key — no sequence.)
SELECT setval(pg_get_serial_sequence('competitions', 'id'),         1, TRUE);
SELECT setval(pg_get_serial_sequence('seasons', 'id'),              1, TRUE);
SELECT setval(pg_get_serial_sequence('teams', 'id'),                4, TRUE);
SELECT setval(pg_get_serial_sequence('players', 'id'),             24, TRUE);
SELECT setval(pg_get_serial_sequence('matches', 'id'),              4, TRUE);
SELECT setval(pg_get_serial_sequence('player_match_minutes', 'id'), 47, TRUE);
SELECT setval(pg_get_serial_sequence('match_events', 'id'),        26, TRUE);
