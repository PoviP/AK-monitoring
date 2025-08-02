export interface Character {
  _id?: string;
  name: string;
  class: string;
  realm: string;
  faction: 'Alliance' | 'Horde';
  itemLevel: number;
  tags: string[]; // Player tags for grouping
  keys: MythicKey[];
  weeklyStats: WeeklyStats;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MythicKey {
  _id?: string;
  dungeon: string;
  level: number;
  affix: string;
  completed: boolean;
  weekly: boolean; // Is this a weekly key
  createdAt?: Date;
}

export interface WeeklyStats {
  keysCompleted: number;
  highestKey: number;
  totalKeys: number;
  lastUpdated: Date;
}

export interface CharacterFilters {
  tags?: string[];
  class?: string;
  realm?: string;
  faction?: string;
  minItemLevel?: number;
  maxItemLevel?: number;
  hasKeys?: boolean;
}

export interface CharacterSummary {
  totalCharacters: number;
  totalKeys: number;
  averageItemLevel: number;
  keysByDungeon: { [dungeon: string]: number };
  keysByLevel: { [level: string]: number };
} 