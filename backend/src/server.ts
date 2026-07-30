import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Room } from './game/Room';
import { TrucoRoom } from './game/TrucoRoom';

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
const rooms: Map<string, Room | TrucoRoom> = new Map();

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
        .map(r => ({ 
            id: r.id, 
            playersCount: r.players.length, 
            maxPlayers: r.maxPlayers,
            gameType: 'gameType' in r ? r.gameType : 'MOSCA'
        }));
        
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

    if ('gameType' in room && room.gameType === 'TRUCO') {
      const trucoRoom = room as TrucoRoom;
      trucoRoom.players.forEach(p => {
        const safeState = {
          roomId: trucoRoom.id,
          status: trucoRoom.status,
          gameType: 'TRUCO',
          mode: trucoRoom.mode,
          dealerIndex: trucoRoom.dealerIndex,
          turnIndex: trucoRoom.turnIndex,
          manoIndex: trucoRoom.manoIndex,
          currentTrick: trucoRoom.currentTrick,
          bazas: trucoRoom.bazas,
          trucoBetState: trucoRoom.trucoBetState,
          envidoBetState: trucoRoom.envidoBetState,
          envidoWinnerPlayerId: trucoRoom.envidoWinnerPlayerId,
          envidoVerificationStatus: trucoRoom.envidoVerificationStatus,
          envidoVerificationSecondsLeft: trucoRoom.envidoVerificationSecondsLeft,
          puntaMode: trucoRoom.puntaMode,
          puntaDuelos: trucoRoom.puntaDuelos,
          pointValue: trucoRoom.pointValue || 0,
          spectators: (trucoRoom.spectators || []).map(s => ({ id: s.id, name: s.name })),
          players: trucoRoom.players.map(player => {
            const isSelf = player.id === p.id;
            const showHandToAll = player.envidoShown || 
                                  (trucoRoom.envidoWinnerPlayerId === player.id && 
                                   (trucoRoom.envidoVerificationStatus === 'VERIFIED' || 
                                    trucoRoom.envidoVerificationStatus === 'CLAIMED'));
            let handToSend = (isSelf || showHandToAll) ? player.hand : new Array(player.hand.length).fill(null);
            
            const teamPoints = trucoRoom.getTeamPoints(player.team);

            return {
              id: player.id,
              name: player.name,
              points: player.points,
              team: player.team,
              hand: handToSend,
              playedCards: player.playedCards,
              connected: player.connected,
              declaredEnvidoPoints: player.declaredEnvidoPoints,
              envidoShown: player.envidoShown,
              malas: teamPoints.malas,
              buenas: teamPoints.buenas
            };
          })
        };
        io.to(p.id).emit('game_state', safeState);
      });

      // Broadcast a espectadores
      if (trucoRoom.spectators) {
        trucoRoom.spectators.forEach(spec => {
          const safeState = {
            roomId: trucoRoom.id,
            status: trucoRoom.status,
            gameType: 'TRUCO',
            mode: trucoRoom.mode,
            dealerIndex: trucoRoom.dealerIndex,
            turnIndex: trucoRoom.turnIndex,
            manoIndex: trucoRoom.manoIndex,
            currentTrick: trucoRoom.currentTrick,
            bazas: trucoRoom.bazas,
            trucoBetState: trucoRoom.trucoBetState,
            envidoBetState: trucoRoom.envidoBetState,
            envidoWinnerPlayerId: trucoRoom.envidoWinnerPlayerId,
            envidoVerificationStatus: trucoRoom.envidoVerificationStatus,
            envidoVerificationSecondsLeft: trucoRoom.envidoVerificationSecondsLeft,
            puntaMode: trucoRoom.puntaMode,
            puntaDuelos: trucoRoom.puntaDuelos,
            pointValue: trucoRoom.pointValue || 0,
            spectators: trucoRoom.spectators.map(s => ({ id: s.id, name: s.name })),
            players: trucoRoom.players.map(player => {
              const handToSend = new Array(player.hand.length).fill(null);
              const teamPoints = trucoRoom.getTeamPoints(player.team);

              return {
                id: player.id,
                name: player.name,
                points: player.points,
                team: player.team,
                hand: handToSend,
                playedCards: player.playedCards,
                connected: player.connected,
                declaredEnvidoPoints: player.declaredEnvidoPoints,
                envidoShown: player.envidoShown,
                malas: teamPoints.malas,
                buenas: teamPoints.buenas
              };
            })
          };
          io.to(spec.id).emit('game_state', safeState);
        });
      }
    } else {
      const moscaRoom = room as Room;
      moscaRoom.players.forEach(p => {
        const safeState = {
            roomId: moscaRoom.id,
            status: moscaRoom.status,
            gameType: 'MOSCA',
            dealerIndex: moscaRoom.dealerIndex,
            turnIndex: moscaRoom.turnIndex,
            manoIndex: moscaRoom.manoIndex,
            trumpSuit: moscaRoom.trumpSuit,
            trumpCard: moscaRoom.trumpCard,
            leadSuit: moscaRoom.leadSuit,
            currentTrick: moscaRoom.currentTrick,
            pointValue: moscaRoom.pointValue || 0,
            spectators: (moscaRoom.spectators || []).map(s => ({ id: s.id, name: s.name })),
            players: moscaRoom.players.map(player => {
                const isDealer = moscaRoom.players[moscaRoom.dealerIndex].id === player.id;
                const hideOwnHand = moscaRoom.status === 'TRUMP_SELECTION' && isDealer && p.id === player.id;
                
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
                    hand: handToSend,
                    cardsDiscardedCount: player.cardsDiscardedCount,
                    wonTricks: player.wonTricks || []
                };
            })
        };
        io.to(p.id).emit('game_state', safeState);
      });

      // Broadcast a espectadores
      if (moscaRoom.spectators) {
        moscaRoom.spectators.forEach(spec => {
          const safeState = {
              roomId: moscaRoom.id,
              status: moscaRoom.status,
              gameType: 'MOSCA',
              dealerIndex: moscaRoom.dealerIndex,
              turnIndex: moscaRoom.turnIndex,
              manoIndex: moscaRoom.manoIndex,
              trumpSuit: moscaRoom.trumpSuit,
              trumpCard: moscaRoom.trumpCard,
              leadSuit: moscaRoom.leadSuit,
              currentTrick: moscaRoom.currentTrick,
              pointValue: moscaRoom.pointValue || 0,
              spectators: moscaRoom.spectators.map(s => ({ id: s.id, name: s.name })),
              players: moscaRoom.players.map(player => {
                  const handToSend = new Array(player.hand.length).fill(null);

                  return {
                      id: player.id,
                      name: player.name,
                      points: player.points,
                      tricksWon: player.tricksWon,
                      hasDiscarded: player.hasDiscarded,
                      connected: player.connected,
                      consecutivePasses: player.consecutivePasses,
                      isPlayingRound: player.isPlayingRound,
                      hand: handToSend,
                      cardsDiscardedCount: player.cardsDiscardedCount,
                      wonTricks: player.wonTricks || []
                  };
              })
          };
          io.to(spec.id).emit('game_state', safeState);
        });
      }
    }
  };

  socket.on('create_room', ({ roomId, playerName, isPrivate, gameType, trucoMode, pointValue }) => {
    if (rooms.has(roomId)) {
        socket.emit('error_message', 'La sala ya existe');
        return;
    }
    
    let room;
    if (gameType === 'TRUCO') {
      const tr = new TrucoRoom(roomId, isPrivate);
      tr.setMode(trucoMode || '1v1');
      tr.pointValue = pointValue || 0;
      tr.onStateChange = () => broadcastGameState(roomId);
      room = tr;
    } else {
      const mr = new Room(roomId, isPrivate);
      mr.pointValue = pointValue || 0;
      mr.onStateChange = () => broadcastGameState(roomId);
      room = mr;
    }
    
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

  socket.on('join_room', ({ roomId, playerName, gameType }) => {
    let room = rooms.get(roomId);
    if (!room) {
        if (gameType === 'TRUCO') {
          const tr = new TrucoRoom(roomId, false);
          tr.onStateChange = () => broadcastGameState(roomId);
          room = tr;
        } else {
          const mr = new Room(roomId, false);
          mr.onStateChange = () => broadcastGameState(roomId);
          room = mr;
        }
        rooms.set(roomId, room);
        broadcastGlobalState();
    }

    try {
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.connected = true;
        } else if (room.status !== 'WAITING' || room.players.length >= room.maxPlayers) {
            // Join as spectator
            if (!room.spectators) room.spectators = [];
            const existingSpectatorIdx = room.spectators.findIndex(s => s.name === playerName);
            if (existingSpectatorIdx >= 0) {
                room.spectators[existingSpectatorIdx].id = socket.id;
            } else {
                room.spectators.push({ id: socket.id, name: playerName });
            }
        } else {
            room.addPlayer(socket.id, playerName);
        }
        
        socket.join(roomId);
        broadcastGameState(roomId);
        broadcastGlobalState();
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

  // ==== Acciones Mosca ====
  socket.on('set_trump', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room || !('setTrump' in room)) return;
    try {
        (room as Room).setTrump(socket.id, cardIndex);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('enter_round', ({ roomId, enter }) => {
    const room = rooms.get(roomId);
    if (!room || !('enterRound' in room)) return;
    try {
        (room as Room).enterRound(socket.id, enter);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('discard_cards', ({ roomId, cardIndexes }) => {
    const room = rooms.get(roomId);
    if (!room || !('discardCards' in room)) return;
    try {
        (room as Room).discardCards(socket.id, cardIndexes);
        broadcastGameState(roomId);
    } catch (e: any) {
        socket.emit('error_message', e.message);
    }
  });

  socket.on('denounce_renuncio', ({ roomId, infractorId }) => {
    const room = rooms.get(roomId);
    if (!room || !('denounceRenuncio' in room)) return;
    try {
        const result = (room as Room).denounceRenuncio(socket.id, infractorId);
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

  // ==== Acciones Compartidas o Truco ====
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

  // Truco específicos
  socket.on('cantar_envido', ({ roomId, callType }) => {
    const room = rooms.get(roomId);
    if (!room || !('cantarEnvido' in room)) return;
    try {
      (room as TrucoRoom).cantarEnvido(socket.id, callType);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('responder_envido', ({ roomId, response }) => {
    const room = rooms.get(roomId);
    if (!room || !('responderEnvido' in room)) return;
    try {
      (room as TrucoRoom).responderEnvido(socket.id, response);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('declarar_envido', ({ roomId, points }) => {
    const room = rooms.get(roomId);
    if (!room || !('declararPuntosEnvido' in room)) return;
    try {
      (room as TrucoRoom).declararPuntosEnvido(socket.id, points);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('son_buenas', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !('declararPuntosEnvido' in room)) return;
    try {
      (room as TrucoRoom).declararPuntosEnvido(socket.id, 0); // "Son buenas" equivale a declarar 0 puntos y pasar al siguiente
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('cantar_truco', ({ roomId, call }) => {
    const room = rooms.get(roomId);
    if (!room || !('cantarTruco' in room)) return;
    try {
      (room as TrucoRoom).cantarTruco(socket.id, call);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('responder_truco', ({ roomId, response }) => {
    const room = rooms.get(roomId);
    if (!room || !('responderTruco' in room)) return;
    try {
      (room as TrucoRoom).responderTruco(socket.id, response);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('irse_al_mazo', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !('irseAlMazo' in room)) return;
    try {
      (room as TrucoRoom).irseAlMazo(socket.id);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('mostrar_puntos_envido', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !('mostrarPuntosEnvido' in room)) return;
    try {
      (room as TrucoRoom).mostrarPuntosEnvido(socket.id);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('reclamar_puntos_envido', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !('reclamarPuntosEnvido' in room)) return;
    try {
      (room as TrucoRoom).reclamarPuntosEnvido(socket.id);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    globalUsers.delete(socket.id);
    broadcastGlobalState();
    
    rooms.forEach(room => {
        const p = room.players.find(player => player.id === socket.id);
        if (p) {
            p.connected = false;
            broadcastGameState(room.id);
        }
        if (room.spectators) {
            const initialLen = room.spectators.length;
            room.spectators = room.spectators.filter(s => s.id !== socket.id);
            if (room.spectators.length !== initialLen) {
                broadcastGameState(room.id);
            }
        }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de Socket.io escuchando en el puerto ${PORT}`);
});
