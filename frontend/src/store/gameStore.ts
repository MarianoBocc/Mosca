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
  hand: (Card | null)[];
  
  // Truco específicos
  team?: 'A' | 'B';
  playedCards?: Card[];
  declaredEnvidoPoints?: number | null;
  envidoShown?: boolean;
  malas?: number;
  buenas?: number;
}

export interface GameState {
  roomId: string;
  status: 'WAITING' | 'DEALING' | 'TRUMP_SELECTION' | 'ENTERING_ROUND' | 'DISCARD' | 'PLAYING' | 'ROUND_END' | 'GAME_END' | 'ENVIDO_DECLARATION';
  gameType?: 'MOSCA' | 'TRUCO';
  dealerIndex: number;
  turnIndex: number;
  manoIndex: number;
  
  // Mosca específicos
  trumpSuit?: string | null;
  trumpCard?: Card | null;
  leadSuit?: string | null;
  
  // Truco específicos
  mode?: '1v1' | '2v2' | '3v3';
  bazas?: { winnerPlayerId: string | 'parda'; winnerTeam: 'A' | 'B' | 'parda' }[];
  trucoBetState?: {
    status: 'NONE' | 'CALLED' | 'ACCEPTED' | 'DECLINED';
    currentStake: number;
    lastCallerTeam: 'A' | 'B' | null;
  };
  envidoBetState?: {
    status: 'NONE' | 'CALLED' | 'ACCEPTED' | 'DECLINED';
    history: ('envido' | 'real_envido' | 'falta_envido')[];
    currentStake: number;
    lastCallerId: string | null;
    challengedPlayerId: string | null;
    canCall: boolean;
  };
  envidoWinnerPlayerId?: string | null;
  envidoVerificationStatus?: 'IDLE' | 'PENDING_SHOW' | 'VERIFIED' | 'CLAIMED' | 'EXPIRED';
  envidoVerificationSecondsLeft?: number;
  puntaMode?: boolean;
  puntaDuelos?: {
    dueloIndex: number;
    dueloPlayerIds: [string, string];
    active: boolean;
  } | null;

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
  gameType?: 'MOSCA' | 'TRUCO';
}

interface StoreState {
  gameState: GameState | null;
  error: string | null;
  setGameState: (state: GameState | null) => void;
  setError: (error: string | null) => void;
  
  playerName: string;
  setPlayerName: (name: string) => void;

  selectedGame: 'MOSCA' | 'TRUCO' | null;
  setSelectedGame: (game: 'MOSCA' | 'TRUCO' | null) => void;
  
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

  selectedGame: null,
  setSelectedGame: (game) => set({ selectedGame: game }),

  onlineUsers: [],
  availableRooms: [],
  setGlobalState: (onlineUsers, availableRooms) => set({ onlineUsers, availableRooms }),
}));
