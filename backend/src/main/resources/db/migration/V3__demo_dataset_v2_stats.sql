-- ----------------------------------------------------------------------------
-- V3 — demo dataset v2 stat fields (Phase 4c)
--
-- The demo dataset grew position-specific stats (goalkeeping, pass split,
-- chances, carries, duels, blocks, positioning estimates). The real-data API
-- path does not provide these, so every column is NULLABLE: real rows simply
-- leave them NULL (gated, honest) while the demo importer fills them.
-- Positioning (0-100) and xG prevented are MODEL_ESTIMATE values; they are
-- only ever populated for demo provenance rows and never fabricated for
-- imported data.
-- ----------------------------------------------------------------------------

ALTER TABLE player_season_stats
    ADD COLUMN tackles_won             INTEGER,
    ADD COLUMN shots_blocked           INTEGER,
    ADD COLUMN aerials_won_attacking   INTEGER,
    ADD COLUMN aerials_won_defensive   INTEGER,
    ADD COLUMN duels_contested         INTEGER,
    ADD COLUMN duels_won               INTEGER,
    ADD COLUMN long_passes_attempted   INTEGER,
    ADD COLUMN long_passes_completed   INTEGER,
    ADD COLUMN short_passes_attempted  INTEGER,
    ADD COLUMN short_passes_completed  INTEGER,
    ADD COLUMN chances_created         INTEGER,
    ADD COLUMN carry_distance          INTEGER,
    ADD COLUMN saves                   INTEGER,
    ADD COLUMN xg_prevented            NUMERIC(6, 2),
    ADD COLUMN penalties_faced         INTEGER,
    ADD COLUMN penalties_stopped       INTEGER,
    ADD COLUMN positioning_attack      INTEGER,
    ADD COLUMN positioning_defense     INTEGER;

-- Logical constraints, applied only when the v2 fields are populated
-- (NULL-aware: real-data rows with NULLs always pass).
ALTER TABLE player_season_stats
    ADD CONSTRAINT ck_pss_v2_passes CHECK (
        (long_passes_attempted IS NULL AND long_passes_completed IS NULL
            AND short_passes_attempted IS NULL AND short_passes_completed IS NULL)
        OR (
            long_passes_completed <= long_passes_attempted
            AND short_passes_completed <= short_passes_attempted
            AND long_passes_attempted + short_passes_attempted <= passes_attempted
            AND long_passes_completed + short_passes_completed <= passes_completed)),
    ADD CONSTRAINT ck_pss_v2_duels CHECK (
        (duels_contested IS NULL AND duels_won IS NULL)
        OR (duels_won <= duels_contested AND duels_contested >= 0)),
    ADD CONSTRAINT ck_pss_v2_tackles CHECK (
        tackles_won IS NULL OR (tackles_won >= 0 AND tackles_won <= tackles)),
    ADD CONSTRAINT ck_pss_v2_blocks CHECK (
        shots_blocked IS NULL OR (shots_blocked >= 0 AND shots_blocked <= clearances)),
    ADD CONSTRAINT ck_pss_v2_aerials CHECK (
        (aerials_won_attacking IS NULL AND aerials_won_defensive IS NULL)
        OR (aerials_won_attacking + aerials_won_defensive <= aerials_won)),
    ADD CONSTRAINT ck_pss_v2_gk CHECK (
        (penalties_faced IS NULL AND penalties_stopped IS NULL AND saves IS NULL)
        OR (penalties_stopped <= penalties_faced AND saves >= 0)),
    ADD CONSTRAINT ck_pss_v2_positioning CHECK (
        (positioning_attack IS NULL OR (positioning_attack >= 0 AND positioning_attack <= 100))
        AND (positioning_defense IS NULL OR (positioning_defense >= 0 AND positioning_defense <= 100)));

-- ----------------------------------------------------------------------------
-- Position vocabulary: dataset v2 adds second strikers (SS), centre forwards
-- (CF), wing-backs (WB) and wide midfielders (LMF/RMF). Replace the CHECKs.
-- ----------------------------------------------------------------------------

ALTER TABLE players DROP CONSTRAINT ck_players_position;
ALTER TABLE players
    ADD CONSTRAINT ck_players_position
    CHECK (position IN ('GK', 'CB', 'LB', 'RB', 'WB', 'DM', 'CM', 'LMF', 'RMF', 'AM', 'LW', 'RW', 'SS', 'CF', 'ST'));

ALTER TABLE players DROP CONSTRAINT ck_players_secondary_position;
ALTER TABLE players
    ADD CONSTRAINT ck_players_secondary_position
    CHECK (secondary_position IS NULL OR secondary_position IN (
        'GK', 'CB', 'LB', 'RB', 'WB', 'DM', 'CM', 'LMF', 'RMF', 'AM', 'LW', 'RW', 'SS', 'CF', 'ST'));
