import { create } from 'zustand';

export interface Card {
  suit: 'oro' | 'copa' | 'espada' | 'basto';
  number: number;
  weight: number;
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface PlayerState {
  id: string;
  name: string;
  points: number;
  tricksWon: number;
  hasDiscarded: boolean;
  connected: boolean;
  consecutivePasses: number;
  isPlayingRound: boolean;
  hand: (Card | null)[]; // Cartas o null si son ocultas
}

export interface GameState {
  roomId: string;
  status: 'WAITING' | 'DEALING' | 'TRUMP_SELECTION' | 'ENTERING_ROUND' | 'DISCARD' | 'PLAYING' | 'ROUND_END' | 'GAME_END';
  dealerIndex: number;
  turnIndex: number;
  manoIndex: number;
  trumpSuit: string | null;
  trumpCard: Card | null;
  leadSuit: string | null;
  currentTrick: TrickCard[];
  players: PlayerState[];
}

export interface GlobalUser {
  id: string;
  name: string;
}

export interface PublicRoom {
  id: string;
  playersCount: number;
  maxPlayers: number;
}

interface StoreState {
  gameState: GameState | null;
  error: string | null;
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null) => void;
  // Local user info
  playerName: string;
  setPlayerName: (name: string) => void;
  
  // Global Lobby State
  onlineUsers: GlobalUser[];
  availableRooms: PublicRoom[];
  setGlobalState: (users: GlobalUser[], rooms: PublicRoom[]) => void;
}

export const useGameStore = create<StoreState>((set) => ({
  gameState: null,
  error: null,
  setGameState: (state) => set({ gameState: state, error: null }),
  setError: (error) => set({ error }),
  
  playerName: '',
  setPlayerName: (name) => set({ playerName: name }),

  onlineUsers: [],
  availableRooms: [],
  setGlobalState: (onlineUsers, availableRooms) => set({ onlineUsers, availableRooms }),
}));
