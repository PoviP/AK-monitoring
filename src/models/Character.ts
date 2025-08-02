import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
  name: string;
  class: string;
  realm: string;
  faction: 'Alliance' | 'Horde';
  itemLevel: number;
  tags: string[];
  keys: Array<{
    dungeon: string;
    level: number;
    affix: string;
    completed: boolean;
    weekly: boolean;
    createdAt: Date;
  }>;
  weeklyStats: {
    keysCompleted: number;
    highestKey: number;
    totalKeys: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MythicKeySchema = new Schema({
  dungeon: { type: String, required: true },
  level: { type: Number, required: true },
  affix: { type: String, required: true },
  completed: { type: Boolean, default: false },
  weekly: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const WeeklyStatsSchema = new Schema({
  keysCompleted: { type: Number, default: 0 },
  highestKey: { type: Number, default: 0 },
  totalKeys: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  class: { type: String, required: true },
  realm: { type: String, required: true },
  faction: { type: String, enum: ['Alliance', 'Horde'], required: true },
  itemLevel: { type: Number, required: true },
  tags: [{ type: String }],
  keys: [MythicKeySchema],
  weeklyStats: { type: WeeklyStatsSchema, default: () => ({}) }
}, {
  timestamps: true
});

// Create compound index for efficient queries
CharacterSchema.index({ realm: 1, name: 1 });
CharacterSchema.index({ tags: 1 });
CharacterSchema.index({ class: 1 });
CharacterSchema.index({ faction: 1 });

export default mongoose.models.Character || mongoose.model<ICharacter>('Character', CharacterSchema); 