import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Room } from './game/Room';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Almacén de salas activas en memoria
const rooms: Map<string, Room> = new Map();

interface GlobalUser {
  id: string;
  name: string;
}
const globalUsers: Map<string, GlobalUser> = new Map();

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  const broadcastGlobalState = () => {
    const publicRooms = Array.from(rooms.values())
        .filter(r => !r.isPrivate && r.status === 'WAITING')
        .map(r => ({ id: r.id, playersCount: r.players.length, maxPlayers: r.maxPlayers }));
        
    const onlineUsers = Array.from(globalUsers.values());

    io.emit('global_state', {
        onlineUsers,
        availableRooms: publicRooms
    });
  };

  socket.on('set_name', (name: string) => {
      globalUsers.set(socket.id, { id: socket.id, name });
      broadcastGlobalState();
  });

  // Utilidad para enviar estado seguro
  const broadcastGameState = (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // A cada jugador le enviamos un estado donde solo ve sus propias cartas
    room.players.forEach(p => {
        const safeState = {
            roomId: room.id,
            status: room.status,
            dealerIndex: room.dealerIndex,
            turnIndex: room.turnIndex,
            manoIndex: room.manoIndex,
            trumpSuit: room.trumpSuit,
            trumpCard: room.trumpCard,
            leadSuit: room.leadSuit,
            currentTrick: room.currentTrick,
            players: room.players.map(player => {
                const isDealer = room.players[room.dealerIndex].id === player.id;
                const hideOwnHand = room.status === 'TRUMP_SELECTION' && isDealer && p.id === player.id;
                
                let handToSend;
                if (player.id !== p.id) {
                    handToSend = new Array(player.hand.length).fill(null);
                } else if (hideOwnHand) {
                    handToSend = new Array(player.hand.length).fill(null);
                } else {
                    handToSend = player.hand;
                }

                return {
                    id: player.id,
                    name: player.name,
                    points: player.points,
                    tricksWon: player.tricksWon,
                    hasDiscarded: player.hasDiscarded,
                    connected: player.connected,
                    consecutivePasses: player.consecutivePasses,
                    isPlayingRound: player.isPlayingRound,
                    hand: handToSend
                };
            })
        };
        io.to(p.id).emit('game_state', safeState);
    });
  };

  socket.on('create_room', ({ roomId, playerName, isPrivate }) => {
    if (rooms.has(roomId)) {
        socket.emit('error_message', 'La sala ya existe');
        return;
    }
    const room = new Room(roomId, isPrivate);
    rooms.set(roomId, room);
    
    try {
        room.addPlayer(socket.id, playerName);
        socket.join(roomId);
        broadcastGameState(roomId);
        broadcastGlobalState();
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    let room = rooms.get(roomId);
    if (!room) {
        // Fallback for direct joins to non-existent rooms (treat as public)
        room = new Room(roomId, false);
        rooms.set(roomId, room);
        broadcastGlobalState();
    }

    try {
        // Permite reconexión: si hay un jugador con el mismo nombre desconectado, tomar su lugar
        const existingPlayer = room.players.find(p => p.name === playerName && !p.connected);
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.connected = true;
        } else {
            room.addPlayer(socket.id, playerName);
        }
        
        socket.join(roomId);
        broadcastGameState(roomId);
        broadcastGlobalState(); // Update players count in lobby
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('start_game', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        room.startGame();
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('next_round', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        if (room.status !== 'ROUND_END') throw new Error("La mano actual no ha terminado");
        room.startRound();
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('set_trump', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        room.setTrump(socket.id, cardIndex);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('enter_round', ({ roomId, enter }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        room.enterRound(socket.id, enter);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('discard_cards', ({ roomId, cardIndexes }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        room.discardCards(socket.id, cardIndexes);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('play_card', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        room.playCard(socket.id, cardIndex);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('denounce_renuncio', ({ roomId, infractorId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    try {
        const result = room.denounceRenuncio(socket.id, infractorId);
        io.to(roomId).emit('renuncio_alert', {
            success: result.success,
            message: result.message
        });
        broadcastGameState(roomId);
        broadcastGlobalState();
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    globalUsers.delete(socket.id);
    broadcastGlobalState();
    
    // TODO: Manejar desconexión real (reconexión, pausar juego, etc)
    // Por ahora lo marcaremos como disconnected en sus salas
    rooms.forEach(room => {
        const p = room.players.find(player => player.id === socket.id);
        if (p) {
            p.connected = false;
            broadcastGameState(room.id);
        }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de Socket.io escuchando en el puerto ${PORT}`);
});
