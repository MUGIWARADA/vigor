/** Fixtures for the football-data.org mapper tests.
 *
 * TRIMMED COPIES OF REAL API RESPONSES captured on 2026-10-16 (free-tier
 * token) — season 2026/27, Premier League matchday 7 / Champions League
 * league phase. Trimmed to keep the test file small; field shapes are
 * exactly as the provider returned them. The assertions below therefore
 * check the mappers against reality, not against invented data.
 */
import type { FdEnvelope, RawMatchesData, RawScorersData, RawStandingsData } from '@/lib/footballData'

export const standingsPlEnv = {
  "source": "football-data.org (free tier)",
  "endpoint": "/competitions/PL/standings",
  "competition": "PL",
  "fetchedAt": "2026-10-16T13:14:07Z",
  "cached": false,
  "data": {
    "competition": {
      "code": "PL",
      "name": "Premier League"
    },
    "season": {
      "id": 2502,
      "currentMatchday": 7,
      "startDate": "2026-08-21",
      "endDate": "2027-05-30"
    },
    "standings": [
      {
        "stage": "REGULAR_SEASON",
        "type": "TOTAL",
        "group": "Matchday",
        "table": [
          {
            "position": 1,
            "team": {
              "id": 65,
              "name": "Manchester City FC",
              "shortName": "Man City",
              "tla": "MCI"
            },
            "playedGames": 6,
            "form": null,
            "won": 6,
            "draw": 0,
            "lost": 0,
            "points": 18,
            "goalsFor": 16,
            "goalsAgainst": 5,
            "goalDifference": 11
          },
          {
            "position": 2,
            "team": {
              "id": 57,
              "name": "Arsenal FC",
              "shortName": "Arsenal",
              "tla": "ARS"
            },
            "playedGames": 6,
            "form": null,
            "won": 5,
            "draw": 0,
            "lost": 1,
            "points": 15,
            "goalsFor": 10,
            "goalsAgainst": 5,
            "goalDifference": 5
          },
          {
            "position": 3,
            "team": {
              "id": 397,
              "name": "Brighton & Hove Albion FC",
              "shortName": "Brighton Hove",
              "tla": "BHA"
            },
            "playedGames": 6,
            "form": null,
            "won": 4,
            "draw": 1,
            "lost": 1,
            "points": 13,
            "goalsFor": 18,
            "goalsAgainst": 5,
            "goalDifference": 13
          },
          {
            "position": 4,
            "team": {
              "id": 402,
              "name": "Brentford FC",
              "shortName": "Brentford",
              "tla": "BRE"
            },
            "playedGames": 6,
            "form": null,
            "won": 2,
            "draw": 4,
            "lost": 0,
            "points": 10,
            "goalsFor": 12,
            "goalsAgainst": 6,
            "goalDifference": 6
          },
          {
            "position": 5,
            "team": {
              "id": 62,
              "name": "Everton FC",
              "shortName": "Everton",
              "tla": "EVE"
            },
            "playedGames": 6,
            "form": null,
            "won": 2,
            "draw": 4,
            "lost": 0,
            "points": 10,
            "goalsFor": 8,
            "goalsAgainst": 5,
            "goalDifference": 3
          },
          {
            "position": 6,
            "team": {
              "id": 61,
              "name": "Chelsea FC",
              "shortName": "Chelsea",
              "tla": "CHE"
            },
            "playedGames": 6,
            "form": null,
            "won": 3,
            "draw": 1,
            "lost": 2,
            "points": 10,
            "goalsFor": 15,
            "goalsAgainst": 13,
            "goalDifference": 2
          },
          {
            "position": 7,
            "team": {
              "id": 341,
              "name": "Leeds United FC",
              "shortName": "Leeds United",
              "tla": "LEE"
            },
            "playedGames": 6,
            "form": null,
            "won": 2,
            "draw": 3,
            "lost": 1,
            "points": 9,
            "goalsFor": 8,
            "goalsAgainst": 5,
            "goalDifference": 3
          },
          {
            "position": 8,
            "team": {
              "id": 322,
              "name": "Hull City AFC",
              "shortName": "Hull City",
              "tla": "HUL"
            },
            "playedGames": 6,
            "form": null,
            "won": 2,
            "draw": 3,
            "lost": 1,
            "points": 9,
            "goalsFor": 8,
            "goalsAgainst": 6,
            "goalDifference": 2
          }
        ]
      }
    ]
  }
} as FdEnvelope<RawStandingsData>

export const standingsClEnv = {
  "source": "football-data.org (free tier)",
  "endpoint": "/competitions/CL/standings",
  "competition": "CL",
  "fetchedAt": "2026-10-16T13:14:07Z",
  "cached": false,
  "data": {
    "competition": {
      "code": "CL",
      "name": "UEFA Champions League"
    },
    "season": {
      "id": 2557,
      "currentMatchday": 2
    },
    "standings": [
      {
        "stage": "LEAGUE_STAGE",
        "type": "TOTAL",
        "group": "League phase",
        "table": [
          {
            "position": 1,
            "team": {
              "id": 524,
              "name": "Paris Saint-Germain FC",
              "shortName": "PSG",
              "tla": "PSG"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 10,
            "goalsAgainst": 3,
            "goalDifference": 7
          },
          {
            "position": 2,
            "team": {
              "id": 81,
              "name": "FC Barcelona",
              "shortName": "Bar\u00e7a",
              "tla": "FCB"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 9,
            "goalsAgainst": 2,
            "goalDifference": 7
          },
          {
            "position": 3,
            "team": {
              "id": 58,
              "name": "Aston Villa FC",
              "shortName": "Aston Villa",
              "tla": "AVL"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 9,
            "goalsAgainst": 2,
            "goalDifference": 7
          },
          {
            "position": 4,
            "team": {
              "id": 10,
              "name": "VfB Stuttgart",
              "shortName": "Stuttgart",
              "tla": "VFB"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 6,
            "goalsAgainst": 1,
            "goalDifference": 5
          },
          {
            "position": 5,
            "team": {
              "id": 64,
              "name": "Liverpool FC",
              "shortName": "Liverpool",
              "tla": "LIV"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 8,
            "goalsAgainst": 4,
            "goalDifference": 4
          },
          {
            "position": 6,
            "team": {
              "id": 498,
              "name": "Sporting Clube de Portugal",
              "shortName": "Sporting CP",
              "tla": "SPO"
            },
            "playedGames": 2,
            "won": 2,
            "draw": 0,
            "lost": 0,
            "points": 6,
            "goalsFor": 5,
            "goalsAgainst": 1,
            "goalDifference": 4
          }
        ]
      }
    ]
  }
} as FdEnvelope<RawStandingsData>

export const matchesPlEnv = {
  "source": "football-data.org (free tier)",
  "endpoint": "/competitions/PL/matches",
  "competition": "PL",
  "fetchedAt": "2026-10-16T13:14:07Z",
  "cached": false,
  "data": {
    "count": null,
    "matches": [
      {
        "id": 560593,
        "utcDate": "2026-10-10T11:30:00Z",
        "status": "FINISHED",
        "matchday": 6,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 57,
          "name": "Arsenal FC",
          "shortName": "Arsenal",
          "tla": "ARS"
        },
        "awayTeam": {
          "id": 341,
          "name": "Leeds United FC",
          "shortName": "Leeds United",
          "tla": "LEE"
        },
        "score": {
          "fullTime": {
            "home": 2,
            "away": 1
          },
          "halfTime": {
            "home": 0,
            "away": 0
          }
        }
      },
      {
        "id": 560592,
        "utcDate": "2026-10-10T14:00:00Z",
        "status": "FINISHED",
        "matchday": 6,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 71,
          "name": "Sunderland AFC",
          "shortName": "Sunderland",
          "tla": "SUN"
        },
        "awayTeam": {
          "id": 397,
          "name": "Brighton & Hove Albion FC",
          "shortName": "Brighton Hove",
          "tla": "BHA"
        },
        "score": {
          "fullTime": {
            "home": 0,
            "away": 2
          },
          "halfTime": {
            "home": 0,
            "away": 0
          }
        }
      },
      {
        "id": 560595,
        "utcDate": "2026-10-10T14:00:00Z",
        "status": "FINISHED",
        "matchday": 6,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 61,
          "name": "Chelsea FC",
          "shortName": "Chelsea",
          "tla": "CHE"
        },
        "awayTeam": {
          "id": 1044,
          "name": "AFC Bournemouth",
          "shortName": "Bournemouth",
          "tla": "BOU"
        },
        "score": {
          "fullTime": {
            "home": 5,
            "away": 1
          },
          "halfTime": {
            "home": 2,
            "away": 0
          }
        }
      },
      {
        "id": 560599,
        "utcDate": "2026-10-10T14:00:00Z",
        "status": "FINISHED",
        "matchday": 6,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 349,
          "name": "Ipswich Town FC",
          "shortName": "Ipswich Town",
          "tla": "IPS"
        },
        "awayTeam": {
          "id": 63,
          "name": "Fulham FC",
          "shortName": "Fulham",
          "tla": "FUL"
        },
        "score": {
          "fullTime": {
            "home": 2,
            "away": 1
          },
          "halfTime": {
            "home": 0,
            "away": 0
          }
        }
      },
      {
        "id": 560603,
        "utcDate": "2026-10-17T11:30:00Z",
        "status": "TIMED",
        "matchday": 7,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 62,
          "name": "Everton FC",
          "shortName": "Everton",
          "tla": "EVE"
        },
        "awayTeam": {
          "id": 61,
          "name": "Chelsea FC",
          "shortName": "Chelsea",
          "tla": "CHE"
        },
        "score": {
          "fullTime": {
            "home": null,
            "away": null
          },
          "halfTime": {
            "home": null,
            "away": null
          }
        }
      },
      {
        "id": 560602,
        "utcDate": "2026-10-17T14:00:00Z",
        "status": "TIMED",
        "matchday": 7,
        "stage": "REGULAR_SEASON",
        "group": null,
        "homeTeam": {
          "id": 63,
          "name": "Fulham FC",
          "shortName": "Fulham",
          "tla": "FUL"
        },
        "awayTeam": {
          "id": 322,
          "name": "Hull City AFC",
          "shortName": "Hull City",
          "tla": "HUL"
        },
        "score": {
          "fullTime": {
            "home": null,
            "away": null
          },
          "halfTime": {
            "home": null,
            "away": null
          }
        }
      }
    ]
  }
} as FdEnvelope<RawMatchesData>

export const scorersPlEnv = {
  "source": "football-data.org (free tier)",
  "endpoint": "/competitions/PL/scorers",
  "competition": "PL",
  "fetchedAt": "2026-10-16T13:14:07Z",
  "cached": false,
  "data": {
    "count": 10,
    "scorers": [
      {
        "player": {
          "id": 38101,
          "name": "Erling Haaland",
          "nationality": "Norway",
          "position": null,
          "section": "Offence"
        },
        "team": {
          "id": 65,
          "name": "Manchester City FC",
          "shortName": "Man City",
          "tla": "MCI"
        },
        "playedMatches": 6,
        "goals": 6,
        "assists": null,
        "penalties": null
      },
      {
        "player": {
          "id": 103125,
          "name": "Jo\u00e3o Pedro",
          "nationality": "Brazil",
          "position": null,
          "section": "Offence"
        },
        "team": {
          "id": 61,
          "name": "Chelsea FC",
          "shortName": "Chelsea",
          "tla": "CHE"
        },
        "playedMatches": 5,
        "goals": 5,
        "assists": 3,
        "penalties": null
      },
      {
        "player": {
          "id": 82140,
          "name": "Morgan Rogers",
          "nationality": "England",
          "position": null,
          "section": "Midfield"
        },
        "team": {
          "id": 61,
          "name": "Chelsea FC",
          "shortName": "Chelsea",
          "tla": "CHE"
        },
        "playedMatches": 6,
        "goals": 4,
        "assists": 1,
        "penalties": null
      },
      {
        "player": {
          "id": 133242,
          "name": "Rayan Cherki",
          "nationality": "France",
          "position": null,
          "section": "Midfield"
        },
        "team": {
          "id": 65,
          "name": "Manchester City FC",
          "shortName": "Man City",
          "tla": "MCI"
        },
        "playedMatches": 6,
        "goals": 4,
        "assists": 2,
        "penalties": null
      },
      {
        "player": {
          "id": 6486,
          "name": "Alexander Isak",
          "nationality": "Sweden",
          "position": null,
          "section": "Offence"
        },
        "team": {
          "id": 64,
          "name": "Liverpool FC",
          "shortName": "Liverpool",
          "tla": "LIV"
        },
        "playedMatches": 5,
        "goals": 4,
        "assists": null,
        "penalties": null
      }
    ]
  }
} as FdEnvelope<RawScorersData>
