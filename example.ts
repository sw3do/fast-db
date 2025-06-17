import Database, { DatabaseOptions, SnapshotOptions } from './index';

// Basic usage with TypeScript
const db = new Database('myapp.db');

// Type-safe operations
db.set('user.name', 'John Doe');
db.set('user.age', 25);
db.set('user.active', true);

// Type inference works
const userName: string = db.get('user.name', 'Anonymous');
const userAge: number = db.get('user.age', 0);

// Array operations with type safety
db.push('users.tags', 'admin');
db.push('users.tags', 'developer');

const tags: string[] = JSON.parse(db.get('users.tags', '[]'));
console.log('User tags:', tags);

// Math operations
db.set('score', 100);
db.add('score', 50);
const newScore: number = db.multiply('score', 2);
console.log('New score:', newScore);

// Configuration with types
const options: DatabaseOptions = {
  autoSync: true,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  snapshots: {
    enabled: true,
    interval: 60 * 60 * 1000, // 1 hour
    path: './backups/'
  }
};

const configuredDb = new Database('configured.db', options);

// Export/Import with typed objects
interface UserProfile {
  name: string;
  email: string;
  age: number;
  preferences: {
    theme: string;
    notifications: boolean;
  };
}

const userData: UserProfile = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 30,
  preferences: {
    theme: 'dark',
    notifications: true
  }
};

// Import nested data
configuredDb.import({
  'user.profile': userData,
  'user.settings.language': 'en',
  'user.settings.timezone': 'UTC'
});

// Type-safe stats
const stats = configuredDb.stats();
console.log(`Database has ${stats.totalKeys} keys`);
console.log(`Total size: ${stats.totalSize} bytes`);

// Backup with error handling
try {
  const success = configuredDb.backup('backup.json');
  if (success) {
    console.log('Backup created successfully');
  }
} catch (error) {
  console.error('Backup failed:', error.message);
}

// Generic helper functions
function getTypedValue<T>(db: Database, key: string, defaultValue: T): T {
  return db.get(key, defaultValue);
}

function setTypedValue<T>(db: Database, key: string, value: T): Database {
  return db.set(key, value);
}

// Usage with generics
const theme = getTypedValue(db, 'settings.theme', 'light');
setTypedValue(db, 'settings.lastLogin', new Date().toISOString());

// Advanced usage with interfaces
interface GameData {
  player: {
    id: string;
    name: string;
    level: number;
    experience: number;
    inventory: string[];
  };
  game: {
    currentLevel: number;
    score: number;
    achievements: string[];
  };
}

class GameDatabase {
  private db: Database;

  constructor(filename: string) {
    this.db = new Database(filename);
  }

  savePlayer(playerId: string, data: GameData['player']): void {
    this.db.set(`players.${playerId}.name`, data.name);
    this.db.set(`players.${playerId}.level`, data.level);
    this.db.set(`players.${playerId}.experience`, data.experience);
    this.db.set(`players.${playerId}.inventory`, JSON.stringify(data.inventory));
  }

  getPlayer(playerId: string): GameData['player'] | null {
    if (!this.db.has(`players.${playerId}.name`)) {
      return null;
    }

    return {
      id: playerId,
      name: this.db.get(`players.${playerId}.name`),
      level: parseInt(this.db.get(`players.${playerId}.level`, '1')),
      experience: parseInt(this.db.get(`players.${playerId}.experience`, '0')),
      inventory: JSON.parse(this.db.get(`players.${playerId}.inventory`, '[]'))
    };
  }

  addExperience(playerId: string, amount: number): number {
    return this.db.add(`players.${playerId}.experience`, amount);
  }

  addToInventory(playerId: string, item: string): number {
    return this.db.push(`players.${playerId}.inventory`, item);
  }

  getLeaderboard(limit: number = 10): Array<{ id: string; name: string; level: number }> {
    const allData = this.db.all();
    const players = allData
      .filter(item => item.key.endsWith('.name'))
      .map(item => {
        const playerId = item.key.split('.')[1];
        return {
          id: playerId,
          name: item.value,
          level: parseInt(this.db.get(`players.${playerId}.level`, '1'))
        };
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, limit);

    return players;
  }
}

// Usage of typed game database
const gameDb = new GameDatabase('game.db');

gameDb.savePlayer('player1', {
  id: 'player1',
  name: 'Hero',
  level: 15,
  experience: 2500,
  inventory: ['sword', 'shield', 'potion']
});

const player = gameDb.getPlayer('player1');
if (player) {
  console.log(`Player ${player.name} is level ${player.level}`);
}

export { Database, DatabaseOptions, SnapshotOptions, GameDatabase }; 