import type { Position, TeamStyle } from '@/types'

/**
 * Reference data for the DEMO dataset (v2).
 *
 * IMPORTANT: everything in this module is FICTIONAL, created for interface
 * and interaction testing only. None of these players, teams, competitions
 * or statistics are real football facts (spec §19).
 *
 * v2: five fictional national leagues (96 teams) + one cross-league cup
 * (Atlantica Cup, 16 teams). Per-country name pools keep each league's
 * squad lists culturally flavored; ~30% of names are drawn cross-pool to
 * mimic foreign signings.
 */

/* ------------------------------------------------------------------ */
/* Name pools                                                          */
/* ------------------------------------------------------------------ */

export interface NamePool {
  first: readonly string[]
  last: readonly string[]
}

export const NAME_POOLS: Record<string, NamePool> = {
  en: {
    first: [
      'Harvey', 'Mason', 'Callum', 'Jude', 'Declan', 'Reuben', 'Elliot', 'Owen',
      'Lewis', 'Kieran', 'Aaron', 'Theo', 'Finlay', 'Rowan', 'Isaac', 'Dylan',
      'Charlie', 'Alfie', 'Jayden', 'Louis', 'Ronnie', 'Stanley', 'Wilf', 'Zack',
    ],
    last: [
      'Whitfield', 'Harlow', 'Pemberton', 'Greaves', 'Ashden', 'Colton', 'Barwick', 'Fenwick',
      'Marlow', 'Oxley', 'Radcliffe', 'Selby', 'Thacker', 'Underhill', 'Voss', 'Wainwright',
      'Yardley', 'Abbott', 'Brindley', 'Carrow', 'Dunston', 'Elwick', 'Farrow', 'Grafton',
    ],
  },
  es: {
    first: [
      'Álvaro', 'Iker', 'Sergio', 'Pablo', 'Hugo', 'Marcos', 'Iván', 'Rubén',
      'Diego', 'Adrián', 'Gonzalo', 'Bruno', 'Nico', 'Javi', 'Unai', 'Aitor',
      'Mikel', 'Ander', 'Pedro', 'Saúl', 'Dani', 'Bryan', 'Marco', 'Raúl',
    ],
    last: [
      'Navarrete', 'Quesada', 'Olmedo', 'Betancor', 'Aranguren', 'Lacruz', 'Ferrer', 'Domínguez',
      'Vilaró', 'Ruibal', 'Tejeda', 'Marchena', 'Alcolea', 'Padilla', 'Ocaña', 'Rentero',
      'Segovia', 'Trujillo', 'Ureña', 'Valdés', 'Yagüe', 'Zambrano', 'Caldera', 'Serrat',
    ],
  },
  it: {
    first: [
      'Lorenzo', 'Matteo', 'Andrea', 'Davide', 'Alessio', 'Riccardo', 'Federico', 'Gianluca',
      'Simone', 'Fabio', 'Dario', 'Enzo', 'Gianni', 'Luca', 'Niccolò', 'Pietro',
      'Samuele', 'Tommaso', 'Umberto', 'Vittorio', 'Ettore', 'Ciro', 'Sandro', 'Iacopo',
    ],
    last: [
      'Montefiori', 'Santoro', 'Licciardi', 'Basso', 'Calabresi', "D'Amico", 'Esposito', 'Ferraro',
      'Gatti', 'Larosa', 'Marconi', 'Nardi', 'Orsini', 'Pelosi', 'Quaranta', 'Rizzo',
      'Sartori', 'Vitali', 'Zanelli', 'Marchetti', 'Bellandi', 'Corvetti', 'Lombardi', 'Tessaro',
    ],
  },
  de: {
    first: [
      'Jonas', 'Leon', 'Niklas', 'Timo', 'Florian', 'Lukas', 'Finn', 'Jannik',
      'Kai', 'Moritz', 'Fabian', 'Julian', 'Marius', 'Sven', 'Henrik', 'Ole',
      'Malte', 'Constantin', 'Emil', 'Paul', 'Felix', 'Mats', 'Anton', 'Joost',
    ],
    last: [
      'Brandtner', 'Eichhorn', 'Vogelsang', 'Kienast', 'Lindhorst', 'Meinhardt', 'Ostheim', 'Reichenbach',
      'Sandtner', 'Ulmert', 'Waldner', 'Zimmerer', 'Ackermeier', 'Bruckner', 'Dannenberg', 'Falkenberg',
      'Gründel', 'Hollenbach', 'Kirchner', 'Leitzke', 'Münzberg', 'Nesselrath', 'Ohlenkamp', 'Pfeiffer',
    ],
  },
  fr: {
    first: [
      'Théo', 'Hugo', 'Enzo', 'Lucas', 'Nathan', 'Louis', 'Jules', 'Mathis',
      'Rayan', 'Axel', 'Killian', 'Maxence', 'Baptiste', 'Quentin', 'Romain', 'Sylvain',
      'Thibault', 'Yannis', 'Zacharie', 'Amine', 'Ilyès', 'Nolan', 'Evan', 'Mattéo',
    ],
    last: [
      'Aubertin', 'Bonnardel', 'Chevalier', 'Delaunay', 'Fournel', 'Guillory', 'Hébert', 'Imbert',
      'Jaubert', 'Kerdraon', 'Lavergne', 'Mounet', 'Nabais', 'Ollivier', 'Perrineau', 'Quiniou',
      'Roussel', 'Sanson', 'Thibert', 'Vasseur', 'Yvernault', 'Zollier', 'Marchand', 'Blaise',
    ],
  },
  /** Generic fallback / foreign-signing mix pool. */
  world: {
    first: [
      'Adrián', 'Kofi', 'Joran', 'Mateus', 'Elio', 'Yusuf', 'Tomas', 'Rasmus',
      'Kenji', 'Malick', 'Oskar', 'Pavel', 'Andrej', 'Mihai', 'Cédric', 'Tariq',
      'Lasse', 'Niels', 'Emeric', 'Joao', 'Stepan', 'Aleks', 'Dwayne', 'Gustav',
      'Isak', 'Viktor', 'Wout', 'Amine', 'Otis', 'Piotr',
    ],
    last: [
      'Varga', 'Okafor', 'Lindqvist', 'Moreau', 'Castellan', 'Bergström', 'Duarte', 'Ferreira',
      'Novak', 'Kowalczyk', 'Osei', 'Antunes', 'Bakker', 'Halvorsen', 'Iversen', 'Janssen',
      'Kessler', 'Mensah', 'Nordström', 'Petrov', 'Sørensen', 'Toure', 'Ulmer', 'Vermeer',
      'Wolff', 'Zielinski', 'Ekwueme', 'Grimaldi', 'Ibáñez', 'Kraft',
    ],
  },
}

/* ------------------------------------------------------------------ */
/* Leagues                                                             */
/* ------------------------------------------------------------------ */

export type NamePoolKey = keyof typeof NAME_POOLS

export interface LeagueConfig {
  /** Competition id (demo ids are fictional). */
  id: string
  /** Team-id prefix. */
  code: string
  name: string
  shortName: string
  country: string
  namePool: NamePoolKey
  teamCount: number
  /** Full double round-robin length — the demo season plays the first 8. */
  totalRounds: number
  /** League-wide style multipliers applied on top of team style mods. */
  mods: Partial<Record<keyof PositionTemplate | 'fwdShare', number>>
}

export const LEAGUES: LeagueConfig[] = [
  {
    id: 'c-brm', code: 'brm', name: 'Bremya League', shortName: 'Bremya', country: 'England',
    namePool: 'en', teamCount: 20, totalRounds: 38,
    mods: { passesAtt: 0.94, progressive: 1.08, fwdShare: 1.15, clearances: 1.12, aerials: 1.12, tackles: 1.06, completion: 0.99 },
  },
  {
    id: 'c-lgs', code: 'lgs', name: 'La Ligarse', shortName: 'Ligarse', country: 'Spain',
    namePool: 'es', teamCount: 20, totalRounds: 38,
    mods: { passesAtt: 1.12, completion: 1.01, progressive: 1.08, dribbles: 1.12, fwdShare: 0.85, recoveriesFT: 1.05 },
  },
  {
    id: 'c-sas', code: 'sas', name: 'Serie Ass', shortName: 'Serie Ass', country: 'Italy',
    namePool: 'it', teamCount: 20, totalRounds: 38,
    mods: { passesAtt: 0.96, clearances: 1.15, tackles: 1.1, shots: 0.95, completion: 1.0, progressive: 0.95 },
  },
  {
    id: 'c-bnd', code: 'bnd', name: 'Bundassliga', shortName: 'Bundass', country: 'Germany',
    namePool: 'de', teamCount: 18, totalRounds: 34,
    mods: { passesAtt: 1.05, progressive: 1.1, shots: 1.1, recoveriesFT: 1.1, fwdShare: 1.05, carries: 1.05 },
  },
  {
    id: 'c-lsf', code: 'lsf', name: 'Ligue Stirfry', shortName: 'Stirfry', country: 'France',
    namePool: 'fr', teamCount: 18, totalRounds: 34,
    mods: { passesAtt: 0.92, dribbles: 1.15, progressive: 1.08, turnovers: 1.08, progCarries: 1.1, tackles: 1.06 },
  },
]

/** Cross-league continental cup — 16 teams, straight knockout. */
export const CUP = {
  id: 'c-ac',
  seasonId: 's-2026-27-ac',
  name: 'Atlantica Cup',
  shortName: 'Atlantica',
  country: 'International',
  /** Teams per league qualifying directly (by strength), + best remaining. */
  qualifiersPerLeague: 3,
  wildcards: 1,
} as const

export const leagueById = (id: string) => LEAGUES.find((l) => l.id === id)

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export interface DemoTeamSeed {
  id: string
  leagueId: string
  name: string
  shortName: string
  city: string
  style: TeamStyle
  formation: string
  color: string
  venue: string
  strength: number
}

/** [name, short, city, style, formation, color, venue, strength] */
type TeamTuple = [string, string, string, TeamStyle, string, string, string, number]

const TEAM_TUPLES: Record<string, TeamTuple[]> = {
  'c-brm': [
    ['Atlantica FC', 'ATL', 'Atlantica Bay', 'Possession-oriented', '4-3-3', '#ffffff', 'Harbour Ground', 0.86],
    ['Riverton United', 'RIV', 'Riverton', 'High-pressing', '4-2-3-1', '#f5a524', 'Old Mill Park', 0.82],
    ['Boreal FC', 'BOR', 'Borealhaven', 'Possession-oriented', '4-3-3', '#3ddc97', 'Northlight Arena', 0.78],
    ['Falconbridge City', 'FLC', 'Falconbridge', 'High-pressing', '4-3-3', '#38bdf8', ' Peregrine Park', 0.76],
    ['Port Meridian SC', 'PME', 'Meridian Port', 'Possession-oriented', '4-2-3-1', '#c084fc', 'Dockside Stadium', 0.74],
    ['Stonewell Park', 'STW', 'Stonewell', 'Possession-oriented', '4-2-3-1', '#22d3ee', 'The Quarry', 0.72],
    ['Kestrel Athletic', 'KES', 'Kestrelford', 'High-pressing', '3-4-3', '#60a5fa', 'The Eyrie', 0.70],
    ['Wexbridge FC', 'WEX', 'Wexbridge', 'Possession-oriented', '4-3-3', '#fde047', 'Bridgefield', 0.68],
    ['Northgate City', 'NGC', 'Northgate', 'Counterattacking', '4-4-2', '#fb923c', 'Ironworks Ground', 0.66],
    ['Dunmoor Abbey', 'DUN', 'Dunmoor', 'Counterattacking', '3-5-2', '#a78bfa', 'Abbey Meadow', 0.64],
    ['Ironfield FC', 'IRF', 'Ironfield', 'Direct', '4-4-2', '#94a3b8', 'Foundry Park', 0.62],
    ['Grimshaw Athletic', 'GRM', 'Grimshaw', 'Direct', '4-4-2', '#f87171', 'Blackvein Road', 0.60],
    ['Solent Wanderers', 'SOL', 'Solent', 'Counterattacking', '3-5-2', '#f472b6', 'Estuary Field', 0.58],
    ['Harrowgate Town', 'HRG', 'Harrowgate', 'Direct', '4-4-2', '#fbbf24', 'Spa Lane', 0.56],
    ['Vale Rovers', 'VLR', 'Vale', 'Direct', '3-5-2', '#a3e635', 'Valehead', 0.54],
    ['Amberdale FC', 'AMB', 'Amberdale', 'Counterattacking', '4-4-2', '#fca5a5', 'Amber Works', 0.52],
    ['Cape Lancers', 'CPL', 'Cape Verity', 'High-pressing', '4-4-2', '#1e40af', 'Lighthouse Road', 0.50],
    ['Redlake United', 'RLK', 'Redlake', 'High-pressing', '4-2-3-1', '#ef4444', 'Lakeside Terrace', 0.48],
    ['Whitmore Wanderers', 'WHM', 'Whitmore', 'Counterattacking', '3-4-2-1', '#e879f9', 'Moorside', 0.46],
    ['Oakhurst Town', 'OAK', 'Oakhurst', 'Direct', '4-4-2', '#a16207', 'The Coppins', 0.44],
  ],
  'c-lgs': [
    ['Real Alcores', 'ALC', 'Alcores', 'Possession-oriented', '4-3-3', '#f8fafc', 'Estadio del Alcor', 0.88],
    ['CF Marenostrum', 'MRN', 'Marenostrum', 'Possession-oriented', '4-3-3', '#e11d48', 'Camp del Mar', 0.86],
    ['Atlético Sabina', 'SAB', 'Sabinar', 'Counterattacking', '4-4-2', '#dc2626', 'La Sabina', 0.84],
    ['Deportivo Veramar', 'VER', 'Veramar', 'Possession-oriented', '4-2-3-1', '#0ea5e9', 'Estadio Veramar', 0.80],
    ['CD Turmero', 'TUR', 'Turmero', 'Possession-oriented', '4-3-3', '#f59e0b', 'El Turmeral', 0.77],
    ['Real Betancar', 'BET', 'Betancar', 'Possession-oriented', '4-2-3-1', '#16a34a', 'Verdiblanco', 0.75],
    ['Villamar CF', 'VLM', 'Villamar', 'Possession-oriented', '4-4-2', '#eab308', 'La Ribera', 0.72],
    ['UD Salmarina', 'SMR', 'Salmarina', 'Counterattacking', '4-4-2', '#0891b2', 'Playa Grande', 0.70],
    ['Valdemar CF', 'VAL', 'Valdemar', 'Counterattacking', '4-3-3', '#7c3aed', 'Estadio Valdemar', 0.67],
    ['CD Ornella', 'ORN', 'Ornella', 'Possession-oriented', '4-2-3-1', '#6366f1', 'El Ombral', 0.65],
    ['Giralda CF', 'GIR', 'Giralda', 'High-pressing', '4-2-3-1', '#f97316', 'La Giraldilla', 0.62],
    ['Osadera CF', 'OSA', 'Osadera', 'Direct', '4-4-2', '#0d9488', 'El Robledal', 0.60],
    ['Rayador CD', 'RYD', 'Rayodoro', 'High-pressing', '4-3-3', '#ef4444', 'Campo Rayado', 0.58],
    ['Cadisma FC', 'CAD', 'Cadisma', 'Counterattacking', '5-3-2', '#065f46', 'La Salina', 0.55],
    ['Almendra CF', 'ALM', 'Almendra', 'Possession-oriented', '4-3-3', '#fb923c', 'El Almendral', 0.53],
    ['Guatarra FC', 'GTA', 'Guatarra', 'Direct', '4-4-2', '#334155', 'El Guatar', 0.51],
    ['Isla Dorada CF', 'ISD', 'Isla Dorada', 'Counterattacking', '4-4-2', '#fbbf24', 'Puerto Dorado', 0.49],
    ['Riberia AC', 'RIB', 'Riberia', 'Direct', '4-4-2', '#dc2626', 'La Ría', 0.47],
    ['Real Ardoz', 'ARD', 'Ardoz', 'High-pressing', '4-3-3', '#2563eb', 'El Ardozal', 0.45],
    ['Granadilla CF', 'GRN', 'Granadilla', 'Direct', '4-4-2', '#be185d', 'La Granja', 0.43],
  ],
  'c-sas': [
    ['AC Volturno', 'VOL', 'Volturno', 'Possession-oriented', '4-2-3-1', '#1d4ed8', 'Stadio del Volturno', 0.88],
    ['Calcio Padavia', 'PAD', 'Padavia', 'Possession-oriented', '4-3-3', '#0f172a', 'Arena Padaviana', 0.86],
    ['SC Vesuvio', 'VES', 'Vesuvio', 'Counterattacking', '3-5-2', '#ea580c', 'Stadio Vesuvio', 0.84],
    ['AS Tiberina', 'TIB', 'Tiberia', 'Possession-oriented', '4-3-3', '#b91c1c', 'Stadio Tiberina', 0.80],
    ['AC Torrenova', 'TRN', 'Torrenova', 'Counterattacking', '3-4-2-1', '#0284c7', 'Torre Grande', 0.78],
    ['SS Laurentina', 'LAR', 'Laurentina', 'High-pressing', '4-2-3-1', '#38bdf8', 'Stadio Laurento', 0.75],
    ['AC Fiorenza', 'FIO', 'Fiorenza', 'Possession-oriented', '4-2-3-1', '#7c3aed', 'Violeta Arena', 0.72],
    ['US Alpaviva', 'ALV', 'Alpaviva', 'High-pressing', '3-4-2-1', '#1e3a8a', 'Alpaviva Park', 0.69],
    ['FC Lanterna', 'LNT', 'Lanterna', 'Counterattacking', '4-4-2', '#dc2626', 'La Lanterna', 0.67],
    ['AC Taurinia', 'TAU', 'Taurinia', 'Direct', '3-5-2', '#78350f', 'Stadio Taurino', 0.64],
    ['Udara Calcio', 'UDA', 'Udara', 'Possession-oriented', '4-3-3', '#15803d', 'Udara Field', 0.62],
    ['Sassella Calcio', 'SSL', 'Sassella', 'High-pressing', '4-2-3-1', '#059669', 'Sassella Park', 0.59],
    ['Grifone FC', 'GRI', 'Grifonia', 'Counterattacking', '4-4-2', '#0369a1', 'Grifone Stadium', 0.57],
    ['AC Doriana', 'DOR', 'Doriani', 'Direct', '4-4-2', '#475569', 'Doriani Field', 0.55],
    ['Isola Rossa Calcio', 'ISR', 'Isola Rossa', 'Counterattacking', '5-3-2', '#b91c1c', 'Rossomare', 0.52],
    ['AC Scaligera', 'SCA', 'Scaligera', 'Direct', '3-5-2', '#166534', 'Scaliger Park', 0.50],
    ['Brianza FC', 'BRI', 'Brianza', 'Possession-oriented', '4-3-3', '#4f46e5', 'Brianzola', 0.48],
    ['US Salentina', 'SLE', 'Salentina', 'High-pressing', '4-4-2', '#0e7490', 'Salentina Ground', 0.46],
    ['AC Valdera', 'VLD', 'Valdera', 'Direct', '4-4-2', '#713f12', 'Valdera Arena', 0.44],
    ['AC Ciociaria', 'CIO', 'Ciociaria', 'Direct', '4-4-2', '#9f1239', 'Ciociaro', 0.42],
  ],
  'c-bnd': [
    ['FC Donnerwald', 'DON', 'Donnerwald', 'High-pressing', '4-2-3-1', '#dc2626', 'Waldstadion', 0.87],
    ['SV Eisenberg 04', 'EIS', 'Eisenberg', 'Direct', '4-3-3', '#171717', 'Erzarena', 0.85],
    ['FC Adlerberg', 'ADL', 'Adlerberg', 'Counterattacking', '3-4-2-1', '#1e40af', 'Adlernest', 0.83],
    ['FC Rabenstein 09', 'RAB', 'Rabenstein', 'Possession-oriented', '4-2-3-1', '#be123c', 'Steinwald Park', 0.80],
    ['SG Lindenstadt', 'LIN', 'Lindenstadt', 'Possession-oriented', '4-3-3', '#65a30d', 'Lindenallee', 0.77],
    ['FC Hohenberg', 'HOH', 'Hohenberg', 'High-pressing', '4-3-3', '#0f766e', 'Bergstadion', 0.74],
    ['VfK Nebeltal', 'NEB', 'Nebeltal', 'Counterattacking', '3-5-2', '#475569', 'Nebelhof', 0.71],
    ['FC Silberbach', 'SIL', 'Silberbach', 'Possession-oriented', '4-2-3-1', '#94a3b8', 'Silberpark', 0.68],
    ['TSV Eichendorf', 'EIC', 'Eichendorf', 'Direct', '4-4-2', '#92400e', 'Eichenwald', 0.66],
    ['FC Kaiserquelle', 'KAI', 'Kaiserquelle', 'Possession-oriented', '4-3-3', '#facc15', 'Quellstadion', 0.63],
    ['SV Granitstadt', 'GRA', 'Granitstadt', 'High-pressing', '4-2-3-1', '#525252', 'Granitpark', 0.61],
    ['FC Falkenrath', 'FLK', 'Falkenrath', 'Counterattacking', '3-4-3', '#b45309', 'Falkenhöh', 0.59],
    ['TSV Morgenrot', 'MOR', 'Morgenrot', 'High-pressing', '4-3-3', '#f43f5e', 'Morgenrot Arena', 0.56],
    ['FC Bernsteinsee', 'BER', 'Bernsteinsee', 'Possession-oriented', '4-2-3-1', '#fb923c', 'Seebad', 0.54],
    ['SV Distelberg', 'DIS', 'Distelberg', 'Direct', '4-4-2', '#3f6212', 'Distelheim', 0.51],
    ['FC Kupferstadt', 'KUP', 'Kupferstadt', 'Counterattacking', '4-4-2', '#b45309', 'Kupferwerk', 0.49],
    ['TSV Habichtstal', 'HAB', 'Habichtstal', 'Direct', '3-5-2', '#1f2937', 'Habichtstal Park', 0.47],
    ['FC Zwieselberg', 'ZWI', 'Zwieselberg', 'High-pressing', '4-4-2', '#334155', 'Zwieselstadion', 0.45],
  ],
  'c-lsf': [
    ['AS Lumière', 'LUM', 'Lumière', 'Possession-oriented', '4-3-3', '#0ea5e9', 'Stade Lumière', 0.86],
    ['Olympique Verdon', 'VRD', 'Verdon', 'Possession-oriented', '4-2-3-1', '#1d4ed8', 'Stade du Verdon', 0.84],
    ['Stade Aquilon', 'AQL', 'Aquilon', 'Counterattacking', '3-4-2-1', '#0891b2', 'Parc Aquilon', 0.82],
    ['Racing Côtebleue', 'CTB', 'Côtebleue', 'High-pressing', '4-2-3-1', '#2563eb', 'Stade Bleu', 0.79],
    ['AS Mistral', 'MIS', 'Mistral', 'Counterattacking', '4-3-3', '#7c3aed', 'Stade Mistral', 0.76],
    ['Stade Candelle', 'CAN', 'Candelle', 'Possession-oriented', '4-3-3', '#f59e0b', 'La Chandelle', 0.73],
    ['Olympique Aubépine', 'AUB', 'Aubépine', 'High-pressing', '4-2-3-1', '#166534', 'Stade Épine', 0.70],
    ['FC Vendémiaire', 'VDG', 'Vendémiaire', 'Possession-oriented', '4-3-3', '#be123c', 'Le Pressoir', 0.67],
    ['AS Flandrin', 'FLN', 'Flandrin', 'Direct', '4-4-2', '#0369a1', 'Stade Flandrin', 0.65],
    ['Stade Tilleul', 'TIL', 'Tilleul', 'Counterattacking', '4-4-2', '#4d7c0f', 'Le Tilleul', 0.62],
    ['Racing Éperon', 'EPR', 'Éperon', 'High-pressing', '4-3-3', '#1e3a8a', 'Stade Éperon', 0.60],
    ['US Valmourène', 'VMO', 'Valmourène', 'Possession-oriented', '4-2-3-1', '#155e75', 'La Mourgène', 0.57],
    ['FC Bastide', 'BAS', 'Bastide', 'Direct', '4-4-2', '#78350f', 'La Bastide', 0.55],
    ['AS Rocavel', 'RCV', 'Rocavel', 'Counterattacking', '3-5-2', '#7c2d12', 'Le Roc', 0.52],
    ['Stade Maréeux', 'MRX', 'Maréeux', 'High-pressing', '4-4-2', '#0e7490', 'Stade des Marées', 0.50],
    ['US Ormarine', 'ORM', 'Ormarine', 'Direct', '4-4-2', '#a16207', 'Port Marine', 0.48],
    ['Racing Pelouse', 'PEL', 'Pelouse', 'Counterattacking', '4-4-2', '#3f6212', 'La Pelouse', 0.46],
    ['AS Bruyère', 'BRY', 'Bruyère', 'Direct', '3-5-2', '#57534e', 'La Bruyère', 0.44],
  ],
}

export const DEMO_TEAMS: DemoTeamSeed[] = LEAGUES.flatMap((league) =>
  TEAM_TUPLES[league.id].map((t, i) => ({
    id: `t-${league.code}-${String(i + 1).padStart(2, '0')}`,
    leagueId: league.id,
    name: t[0],
    shortName: t[1],
    city: t[2],
    style: t[3],
    formation: t[4],
    color: t[5],
    venue: t[6],
    strength: t[7],
  })),
)

/* ------------------------------------------------------------------ */
/* Formations & rosters                                                */
/* ------------------------------------------------------------------ */

export const FORMATION_SLOTS: Record<string, Position[]> = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LMF', 'CM', 'DM', 'CM', 'RMF', 'ST', 'ST'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LMF', 'CM', 'CM', 'RMF', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LMF', 'CM', 'CM', 'RMF', 'LW', 'ST', 'RW'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'LMF', 'DM', 'CM', 'RMF', 'SS', 'CF', 'ST'],
}

export const FORMATIONS = Object.keys(FORMATION_SLOTS)

/** Roster composition per team (24 players). */
export const ROSTER_LAYOUT: Position[] = [
  'GK', 'GK',
  'CB', 'CB', 'CB', 'CB',
  'LB', 'RB',
  'WB', 'WB',
  'DM', 'DM',
  'CM', 'CM',
  'LMF', 'RMF',
  'AM', 'AM',
  'LW', 'RW',
  'SS', 'CF',
  'ST', 'ST',
]

/** Shirt numbers per roster slot, index-aligned with ROSTER_LAYOUT (24 total). */
export const SHIRT_POOLS: Record<Position, number[]> = {
  GK: [1, 13],
  CB: [4, 5, 15, 22],
  LB: [3],
  RB: [2],
  WB: [12, 18],
  DM: [6, 16],
  CM: [8, 14],
  LMF: [11],
  RMF: [7],
  AM: [10, 20],
  LW: [19],
  RW: [23],
  SS: [17],
  CF: [21],
  ST: [9, 24],
}

export const SECONDARY_POSITION: Record<Position, Position[]> = {
  GK: ['CB'],
  CB: ['DM'],
  LB: ['CB', 'WB', 'LMF'],
  RB: ['CB', 'WB', 'RMF'],
  WB: ['LMF', 'RMF', 'LB', 'RB'],
  DM: ['CB'],
  CM: ['DM', 'AM'],
  LMF: ['LW', 'WB', 'LB'],
  RMF: ['RW', 'WB', 'RB'],
  AM: ['CM', 'SS', 'LW'],
  LW: ['LMF', 'AM', 'SS'],
  RW: ['RMF', 'AM', 'SS'],
  SS: ['ST', 'AM', 'CF'],
  CF: ['ST', 'SS'],
  ST: ['CF', 'SS', 'AM'],
}

export const HEIGHT_RANGES: Record<Position, [number, number]> = {
  GK: [187, 197], CB: [184, 196], LB: [174, 186], RB: [174, 186], WB: [172, 185],
  DM: [176, 190], CM: [172, 186], LMF: [170, 184], RMF: [170, 184], AM: [168, 182],
  LW: [166, 182], RW: [166, 182], SS: [172, 188], CF: [180, 194], ST: [176, 194],
}

/* ------------------------------------------------------------------ */
/* Per-90 rate templates                                               */
/* ------------------------------------------------------------------ */

/**
 * Per-90 rate templates by position. Ranges are fictional but plausible;
 * all values are DEMO.
 */
export interface PositionTemplate {
  passesAtt: [number, number]
  completion: [number, number]
  fwdShare: [number, number]
  progressive: [number, number]
  passesFT: [number, number]
  lineBreaking: [number, number]
  carries: [number, number]
  progCarries: [number, number]
  carriesFT: [number, number]
  dribbles: [number, number]
  dribbleRate: [number, number]
  touches: [number, number]
  turnovers: [number, number]
  buReceptions: [number, number]
  buTurnovers: [number, number]
  tackles: [number, number]
  interceptions: [number, number]
  recoveries: [number, number]
  recoveriesFT: [number, number]
  clearances: [number, number]
  aerials: [number, number]
  aerialRate: [number, number]
  shots: [number, number]
  xgQuality: [number, number]
  xaRate: [number, number]
}

export const TEMPLATES: Record<Position, PositionTemplate> = {
  GK: {
    passesAtt: [26, 34], completion: [0.78, 0.88], fwdShare: [0.45, 0.6],
    progressive: [2.5, 4.5], passesFT: [0.4, 1.2], lineBreaking: [0.2, 0.9],
    carries: [4, 7], progCarries: [0.05, 0.25], carriesFT: [0, 0.15],
    dribbles: [0, 0], dribbleRate: [0, 0], touches: [28, 36],
    turnovers: [0.2, 0.6], buReceptions: [3, 6], buTurnovers: [0.05, 0.2],
    tackles: [0, 0], interceptions: [0, 0], recoveries: [0.4, 1],
    recoveriesFT: [0, 0.05], clearances: [1.2, 2.4], aerials: [1, 2],
    aerialRate: [0.82, 0.92], shots: [0, 0], xgQuality: [0, 0], xaRate: [0, 0.03],
  },
  CB: {
    passesAtt: [52, 68], completion: [0.86, 0.93], fwdShare: [0.24, 0.34],
    progressive: [4.5, 7.5], passesFT: [2.5, 4.5], lineBreaking: [1.8, 3.4],
    carries: [7, 11], progCarries: [0.7, 1.8], carriesFT: [0.1, 0.5],
    dribbles: [0.15, 0.5], dribbleRate: [0.5, 0.7], touches: [48, 62],
    turnovers: [1.2, 2.6], buReceptions: [6, 10], buTurnovers: [0.3, 0.9],
    tackles: [1.3, 2.3], interceptions: [1.1, 2.1], recoveries: [4.5, 7],
    recoveriesFT: [0.08, 0.3], clearances: [2.8, 4.6], aerials: [2.8, 4.4],
    aerialRate: [0.55, 0.68], shots: [0.08, 0.25], xgQuality: [0.04, 0.07],
    xaRate: [0.03, 0.09],
  },
  LB: {
    passesAtt: [38, 52], completion: [0.8, 0.88], fwdShare: [0.3, 0.42],
    progressive: [3.5, 6], passesFT: [2, 4], lineBreaking: [1.2, 2.6],
    carries: [9, 14], progCarries: [1.5, 3], carriesFT: [0.5, 1.4],
    dribbles: [1, 2.4], dribbleRate: [0.5, 0.65], touches: [45, 60],
    turnovers: [1.8, 3.2], buReceptions: [5, 8], buTurnovers: [0.5, 1.2],
    tackles: [1.8, 3], interceptions: [1.2, 2.2], recoveries: [4, 6.5],
    recoveriesFT: [0.2, 0.6], clearances: [1.4, 2.6], aerials: [1.4, 2.6],
    aerialRate: [0.48, 0.6], shots: [0.15, 0.4], xgQuality: [0.05, 0.08],
    xaRate: [0.05, 0.13],
  },
  RB: {
    passesAtt: [38, 52], completion: [0.8, 0.88], fwdShare: [0.3, 0.42],
    progressive: [3.5, 6], passesFT: [2, 4], lineBreaking: [1.2, 2.6],
    carries: [9, 14], progCarries: [1.5, 3], carriesFT: [0.5, 1.4],
    dribbles: [1, 2.4], dribbleRate: [0.5, 0.65], touches: [45, 60],
    turnovers: [1.8, 3.2], buReceptions: [5, 8], buTurnovers: [0.5, 1.2],
    tackles: [1.8, 3], interceptions: [1.2, 2.2], recoveries: [4, 6.5],
    recoveriesFT: [0.2, 0.6], clearances: [1.4, 2.6], aerials: [1.4, 2.6],
    aerialRate: [0.48, 0.6], shots: [0.15, 0.4], xgQuality: [0.05, 0.08],
    xaRate: [0.05, 0.13],
  },
  WB: {
    passesAtt: [30, 42], completion: [0.76, 0.86], fwdShare: [0.34, 0.46],
    progressive: [4, 6.5], passesFT: [2, 4], lineBreaking: [1.2, 2.6],
    carries: [11, 17], progCarries: [2, 3.6], carriesFT: [0.8, 2],
    dribbles: [1.6, 3.2], dribbleRate: [0.5, 0.65], touches: [44, 58],
    turnovers: [2.2, 3.6], buReceptions: [4, 7], buTurnovers: [0.6, 1.4],
    tackles: [1.9, 3.1], interceptions: [1.2, 2.2], recoveries: [4, 6.5],
    recoveriesFT: [0.25, 0.6], clearances: [1.2, 2.4], aerials: [1.2, 2.4],
    aerialRate: [0.46, 0.58], shots: [0.2, 0.5], xgQuality: [0.05, 0.08],
    xaRate: [0.07, 0.16],
  },
  DM: {
    passesAtt: [48, 64], completion: [0.85, 0.92], fwdShare: [0.26, 0.36],
    progressive: [5, 8], passesFT: [3, 5], lineBreaking: [2, 3.5],
    carries: [8, 12], progCarries: [0.8, 1.8], carriesFT: [0.3, 0.8],
    dribbles: [0.5, 1.4], dribbleRate: [0.55, 0.7], touches: [52, 68],
    turnovers: [1.5, 2.8], buReceptions: [7, 11], buTurnovers: [0.4, 1],
    tackles: [2.2, 3.4], interceptions: [1.6, 2.6], recoveries: [5.5, 8],
    recoveriesFT: [0.15, 0.4], clearances: [1, 2], aerials: [1.6, 2.8],
    aerialRate: [0.5, 0.62], shots: [0.12, 0.3], xgQuality: [0.05, 0.07],
    xaRate: [0.04, 0.1],
  },
  CM: {
    passesAtt: [40, 56], completion: [0.82, 0.9], fwdShare: [0.3, 0.42],
    progressive: [4.5, 7.5], passesFT: [3, 5.5], lineBreaking: [2, 3.6],
    carries: [8, 13], progCarries: [1.4, 2.8], carriesFT: [0.6, 1.5],
    dribbles: [1, 2.2], dribbleRate: [0.55, 0.7], touches: [48, 64],
    turnovers: [1.8, 3.2], buReceptions: [5.5, 9], buTurnovers: [0.5, 1.2],
    tackles: [1.6, 2.8], interceptions: [1.2, 2.2], recoveries: [4.5, 7],
    recoveriesFT: [0.2, 0.55], clearances: [0.5, 1.2], aerials: [1.2, 2.4],
    aerialRate: [0.46, 0.58], shots: [0.3, 0.7], xgQuality: [0.06, 0.09],
    xaRate: [0.08, 0.16],
  },
  LMF: {
    passesAtt: [28, 40], completion: [0.77, 0.86], fwdShare: [0.34, 0.46],
    progressive: [3.5, 6], passesFT: [2.5, 4.5], lineBreaking: [1.6, 3],
    carries: [8, 13], progCarries: [1.6, 3.2], carriesFT: [0.8, 1.8],
    dribbles: [1.8, 3.4], dribbleRate: [0.52, 0.68], touches: [40, 54],
    turnovers: [2.2, 3.6], buReceptions: [4, 7], buTurnovers: [0.6, 1.3],
    tackles: [1.6, 2.8], interceptions: [1, 2], recoveries: [3.8, 6.2],
    recoveriesFT: [0.25, 0.6], clearances: [0.6, 1.4], aerials: [1.2, 2.4],
    aerialRate: [0.46, 0.58], shots: [0.6, 1.4], xgQuality: [0.07, 0.11],
    xaRate: [0.1, 0.2],
  },
  RMF: {
    passesAtt: [28, 40], completion: [0.77, 0.86], fwdShare: [0.34, 0.46],
    progressive: [3.5, 6], passesFT: [2.5, 4.5], lineBreaking: [1.6, 3],
    carries: [8, 13], progCarries: [1.6, 3.2], carriesFT: [0.8, 1.8],
    dribbles: [1.8, 3.4], dribbleRate: [0.52, 0.68], touches: [40, 54],
    turnovers: [2.2, 3.6], buReceptions: [4, 7], buTurnovers: [0.6, 1.3],
    tackles: [1.6, 2.8], interceptions: [1, 2], recoveries: [3.8, 6.2],
    recoveriesFT: [0.25, 0.6], clearances: [0.6, 1.4], aerials: [1.2, 2.4],
    aerialRate: [0.46, 0.58], shots: [0.6, 1.4], xgQuality: [0.07, 0.11],
    xaRate: [0.1, 0.2],
  },
  AM: {
    passesAtt: [30, 42], completion: [0.78, 0.87], fwdShare: [0.34, 0.46],
    progressive: [4, 6.5], passesFT: [3.5, 6], lineBreaking: [2.2, 3.8],
    carries: [9, 14], progCarries: [1.8, 3.4], carriesFT: [1, 2.2],
    dribbles: [2, 3.6], dribbleRate: [0.58, 0.72], touches: [42, 56],
    turnovers: [2.4, 3.8], buReceptions: [3, 5.5], buTurnovers: [0.7, 1.5],
    tackles: [0.8, 1.8], interceptions: [0.5, 1.2], recoveries: [2.5, 4.2],
    recoveriesFT: [0.35, 0.75], clearances: [0.1, 0.4], aerials: [0.8, 1.8],
    aerialRate: [0.42, 0.55], shots: [1.2, 2.4], xgQuality: [0.09, 0.13],
    xaRate: [0.14, 0.26],
  },
  LW: {
    passesAtt: [24, 34], completion: [0.74, 0.84], fwdShare: [0.36, 0.48],
    progressive: [3.5, 6], passesFT: [3, 5.5], lineBreaking: [1.8, 3.2],
    carries: [10, 16], progCarries: [2.2, 4], carriesFT: [1.4, 2.8],
    dribbles: [3.2, 5.6], dribbleRate: [0.5, 0.66], touches: [38, 50],
    turnovers: [2.6, 4], buReceptions: [1.8, 3.4], buTurnovers: [0.7, 1.5],
    tackles: [0.9, 1.9], interceptions: [0.5, 1.1], recoveries: [2.2, 3.6],
    recoveriesFT: [0.3, 0.65], clearances: [0.1, 0.3], aerials: [0.9, 1.9],
    aerialRate: [0.4, 0.52], shots: [1.4, 2.8], xgQuality: [0.1, 0.15],
    xaRate: [0.13, 0.25],
  },
  RW: {
    passesAtt: [24, 34], completion: [0.74, 0.84], fwdShare: [0.36, 0.48],
    progressive: [3.5, 6], passesFT: [3, 5.5], lineBreaking: [1.8, 3.2],
    carries: [10, 16], progCarries: [2.2, 4], carriesFT: [1.4, 2.8],
    dribbles: [3.2, 5.6], dribbleRate: [0.5, 0.66], touches: [38, 50],
    turnovers: [2.6, 4], buReceptions: [1.8, 3.4], buTurnovers: [0.7, 1.5],
    tackles: [0.9, 1.9], interceptions: [0.5, 1.1], recoveries: [2.2, 3.6],
    recoveriesFT: [0.3, 0.65], clearances: [0.1, 0.3], aerials: [0.9, 1.9],
    aerialRate: [0.4, 0.52], shots: [1.4, 2.8], xgQuality: [0.1, 0.15],
    xaRate: [0.13, 0.25],
  },
  SS: {
    passesAtt: [20, 30], completion: [0.75, 0.84], fwdShare: [0.36, 0.48],
    progressive: [3, 5.5], passesFT: [2.5, 4.5], lineBreaking: [1.6, 3],
    carries: [7, 12], progCarries: [1.6, 3.2], carriesFT: [1.2, 2.4],
    dribbles: [2, 3.8], dribbleRate: [0.56, 0.7], touches: [32, 44],
    turnovers: [2.4, 3.8], buReceptions: [2, 4], buTurnovers: [0.6, 1.3],
    tackles: [0.7, 1.6], interceptions: [0.4, 1], recoveries: [2, 3.4],
    recoveriesFT: [0.3, 0.65], clearances: [0.05, 0.2], aerials: [1.4, 2.8],
    aerialRate: [0.44, 0.56], shots: [2, 3.6], xgQuality: [0.11, 0.16],
    xaRate: [0.11, 0.2],
  },
  CF: {
    passesAtt: [16, 24], completion: [0.68, 0.8], fwdShare: [0.38, 0.5],
    progressive: [1.8, 3.6], passesFT: [2, 3.8], lineBreaking: [1, 2.2],
    carries: [5, 9], progCarries: [1, 2.2], carriesFT: [0.8, 1.8],
    dribbles: [1, 2.2], dribbleRate: [0.48, 0.62], touches: [26, 36],
    turnovers: [2.2, 3.4], buReceptions: [2.4, 4.2], buTurnovers: [0.5, 1.1],
    tackles: [0.5, 1.2], interceptions: [0.2, 0.6], recoveries: [1.6, 2.8],
    recoveriesFT: [0.25, 0.55], clearances: [0.05, 0.2], aerials: [3.4, 5.6],
    aerialRate: [0.52, 0.66], shots: [2.4, 4], xgQuality: [0.13, 0.18],
    xaRate: [0.07, 0.13],
  },
  ST: {
    passesAtt: [16, 24], completion: [0.7, 0.82], fwdShare: [0.36, 0.5],
    progressive: [2, 4], passesFT: [2.2, 4.2], lineBreaking: [1.2, 2.4],
    carries: [6, 10], progCarries: [1.2, 2.4], carriesFT: [1, 2],
    dribbles: [1.2, 2.4], dribbleRate: [0.52, 0.66], touches: [26, 36],
    turnovers: [2.2, 3.4], buReceptions: [1.2, 2.4], buTurnovers: [0.5, 1.1],
    tackles: [0.5, 1.2], interceptions: [0.2, 0.7], recoveries: [1.6, 2.8],
    recoveriesFT: [0.25, 0.55], clearances: [0.05, 0.2], aerials: [2.2, 4],
    aerialRate: [0.45, 0.58], shots: [2.6, 4.4], xgQuality: [0.13, 0.19],
    xaRate: [0.07, 0.14],
  },
}

/** Team-style multipliers applied to per-90 rates. */
export const STYLE_MODS: Record<
  TeamStyle,
  Partial<Record<keyof PositionTemplate | 'turnoversTotal', number>>
> = {
  'Possession-oriented': {
    passesAtt: 1.15, completion: 1.01, progressive: 1.1, carries: 1.08,
    turnovers: 0.95, recoveriesFT: 0.95, clearances: 0.9, touches: 1.12,
  },
  Direct: {
    passesAtt: 0.82, progressive: 1.05, fwdShare: 1.18, carries: 0.92,
    clearances: 1.15, dribbles: 0.92, passesFT: 0.95,
  },
  Counterattacking: {
    passesAtt: 0.9, progCarries: 1.12, carriesFT: 1.15, dribbles: 1.1,
    turnovers: 1.05, recoveries: 1.05,
  },
  'High-pressing': {
    recoveriesFT: 1.3, tackles: 1.12, interceptions: 1.12, turnovers: 1.05,
    passesAtt: 0.95, progressive: 1.05,
  },
}

/** Base touch-map zones by position: [x, y, spreadX, spreadY]. */
export const TOUCH_ZONES: Record<Position, [number, number, number, number]> = {
  GK: [6, 50, 2, 6],
  CB: [18, 32, 6, 8],
  LB: [22, 16, 8, 7],
  RB: [22, 84, 8, 7],
  WB: [30, 16, 9, 8],
  DM: [34, 50, 7, 10],
  CM: [46, 50, 9, 16],
  LMF: [40, 16, 10, 9],
  RMF: [40, 84, 10, 9],
  AM: [62, 50, 9, 18],
  LW: [66, 20, 10, 9],
  RW: [66, 80, 10, 9],
  SS: [70, 50, 8, 12],
  CF: [74, 50, 8, 12],
  ST: [76, 50, 9, 14],
}

/* ------------------------------------------------------------------ */
/* Season calendar                                                     */
/* ------------------------------------------------------------------ */

export const SEASON_LABEL = '2026/27'
export const SEASON_START = '2026-08-08'
/** League matchdays simulated in the demo snapshot. */
export const ROUNDS_PLAYED = 8
