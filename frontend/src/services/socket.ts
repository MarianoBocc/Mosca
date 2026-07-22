import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

// URL del backend: dinámico para soportar desarrollo local y producción
const URL = import.meta.env.VITE_BACKEND_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : `http://${window.location.hostname}:3001`);

export const socket: Socket = io(URL, {
  autoConnect: false, // Conectaremos manualmente al entrar
});

// Listener general
socket.on('game_state', (state) => {
    useGameStore.getState().setGameState(state);
});

socket.on('global_state', (state) => {
    useGameStore.getState().setGlobalState(state.onlineUsers, state.availableRooms);
});

socket.on('error_message', (msg) => {
    useGameStore.getState().setError(msg);
});
