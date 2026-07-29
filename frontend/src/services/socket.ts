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
socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    const store = useGameStore.getState();
    const savedName = store.playerName || localStorage.getItem('mosca_playerName');
    
    if (savedName) {
        socket.emit('set_name', savedName);
        
        // Si estábamos en una sala, re-unirse automáticamente
        const savedRoomId = sessionStorage.getItem('mosca_roomId');
        const savedGameType = sessionStorage.getItem('mosca_gameType');
        if (savedRoomId && savedGameType) {
            console.log(`Re-uniéndose automáticamente a la sala ${savedRoomId} (${savedGameType})`);
            socket.emit('join_room', { 
                roomId: savedRoomId, 
                playerName: savedName, 
                gameType: savedGameType 
            });
        }
    }
});

socket.on('game_state', (state) => {
    if (state && state.roomId) {
        sessionStorage.setItem('mosca_roomId', state.roomId);
        if (state.gameType) {
            sessionStorage.setItem('mosca_gameType', state.gameType);
        }
    }
    useGameStore.getState().setGameState(state);
});

socket.on('global_state', (state) => {
    useGameStore.getState().setGlobalState(state.onlineUsers, state.availableRooms);
});

socket.on('error_message', (msg) => {
    useGameStore.getState().setError(msg);
});

