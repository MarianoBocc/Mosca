import fs from 'fs';
import path from 'path';

export interface GameHistoryEntry {
  roomId: string;
  gameType: 'MOSCA' | 'TRUCO';
  pointValue: number;
  players: {
    name: string;
    points: number;
  }[];
  timestamp: string;
}

const HISTORY_FILE = path.join(__dirname, '../../history.json');

export const saveGameHistory = (entry: GameHistoryEntry) => {
  try {
    let history: GameHistoryEntry[] = [];
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      try {
        history = JSON.parse(data);
      } catch (e) {
        history = [];
      }
    }
    history.push(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log("Game history saved successfully.");
  } catch (error) {
    console.error("Error saving game history:", error);
  }
};

export const getGameHistory = (): GameHistoryEntry[] => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading game history:", error);
  }
  return [];
};
