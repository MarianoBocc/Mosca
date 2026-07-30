import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Card } from '../store/gameStore';
import { socket } from '../services/socket';
import { CardView } from './CardView';
import { Award, Eye } from 'lucide-react';

export const GameTable = () => {
  const gameState = useGameStore(state => state.gameState);
  const myId = socket.id;
  
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [renuncioMsg, setRenuncioMsg] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    socket.on('renuncio_alert', (data: { success: boolean; message: string }) => {
        setRenuncioMsg(data);
        const timer = setTimeout(() => {
            setRenuncioMsg(null);
        }, 6000);
        return () => clearTimeout(timer);
    });

    return () => {
        socket.off('renuncio_alert');
    };
  }, []);

  if (!gameState) return null;

  // Determinar si soy espectador
  const isSpectator = !gameState.players.some(p => p.id === myId);
  const me = isSpectator ? null : gameState.players.find(p => p.id === myId);
  const myIndex = isSpectator ? 0 : gameState.players.findIndex(p => p.id === myId);
  const isMyTurn = isSpectator ? false : gameState.turnIndex === myIndex;
  const isDealer = isSpectator ? false : gameState.dealerIndex === myIndex;

  // Acciones
  const handleCardClick = (index: number) => {
    if (isSpectator || !isMyTurn) return;

    if (gameState.status === 'TRUMP_SELECTION') {
        socket.emit('set_trump', { roomId: gameState.roomId, cardIndex: index });
    } 
    else if (gameState.status === 'DISCARD') {
        if (selectedCards.includes(index)) {
            setSelectedCards(prev => prev.filter(i => i !== index));
        } else {
            const maxDiscard = isDealer ? 4 : 3;
            if (selectedCards.length < maxDiscard) {
                setSelectedCards([...selectedCards, index]);
            }
        }
    }
    else if (gameState.status === 'PLAYING') {
        socket.emit('play_card', { roomId: gameState.roomId, cardIndex: index });
    }
  };

  const confirmDiscard = () => {
      if (isSpectator) return;
      socket.emit('discard_cards', { roomId: gameState.roomId, cardIndexes: selectedCards });
      setSelectedCards([]);
  };

  const handleLeave = () => {
      sessionStorage.removeItem('mosca_roomId');
      sessionStorage.removeItem('mosca_gameType');
      window.location.href = '/';
  };

  // UI Helpers
  const getStatusText = () => {
      if (gameState.status === 'DEALING') return 'Repartiendo...';
      if (gameState.status === 'TRUMP_SELECTION') {
          return isMyTurn ? 'Selecciona una carta (boca abajo) para que sea el Triunfo' : 'El repartidor está eligiendo el Triunfo...';
      }
      if (gameState.status === 'ENTERING_ROUND') {
          return isMyTurn ? '¿Entras a la mano o pasas?' : `Esperando a ${gameState.players[gameState.turnIndex].name} a que decida...`;
      }
      if (gameState.status === 'DISCARD') {
          return isMyTurn ? 'Selecciona qué cartas descartar' : `Esperando a que los demás descarten...`;
      }
      if (gameState.status === 'PLAYING') {
          return isMyTurn ? '¡Es tu turno de jugar!' : `Turno de ${gameState.players[gameState.turnIndex].name}`;
      }
      if (gameState.status === 'ROUND_END') return 'Fin de la mano, calculando puntos...';
      if (gameState.status === 'GAME_END') return '¡Juego terminado!';
      return gameState.status;
  };

  // Ordenar los jugadores para sentarlos alrededor de la mesa circular
  // Empezando por mí (o por el index 0 si soy espectador) en la parte inferior, y siguiendo en sentido horario
  const getSeatedPlayers = () => {
    const seated = [];
    const count = gameState.players.length;
    for (let i = 0; i < count; i++) {
      const idx = (myIndex + i) % count;
      seated.push({ player: gameState.players[idx], seatIndex: i });
    }
    return seated;
  };

  const seatedPlayers = getSeatedPlayers();

  const getPlayerSeatStyle = (seatIndex: number, total: number) => {
    if (total === 4) {
      if (seatIndex === 0) return styles.posBottom;
      if (seatIndex === 1) return styles.posLeft;
      if (seatIndex === 2) return styles.posTop;
      if (seatIndex === 3) return styles.posRight;
    } else if (total === 5) {
      if (seatIndex === 0) return styles.posBottom;
      if (seatIndex === 1) return styles.posBottomLeft;
      if (seatIndex === 2) return styles.posTopLeft;
      if (seatIndex === 3) return styles.posTopRight;
      if (seatIndex === 4) return styles.posBottomRight;
    } else {
      if (seatIndex === 0) return styles.posBottom;
      if (seatIndex === 1) return styles.posLeft;
      if (seatIndex === 2) return styles.posTop;
    }
    return {};
  };

  // Ordenar jugadores para la tabla de posiciones final (menor puntaje primero)
  const scoreboardPlayers = [...gameState.players].sort((a, b) => a.points - b.points);

  return (
    <div className="game-table-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {renuncioMsg && (
        <div style={{
            background: renuncioMsg.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            textAlign: 'center',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            marginBottom: 8,
            zIndex: 100
        }}>
            {renuncioMsg.message}
        </div>
      )}
      
      <div className="game-header glass-panel">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>Sala: <strong>{gameState.roomId}</strong></div>
            <div style={{ color: 'var(--accent)' }}>{getStatusText()}</div>
            {isSpectator && (
              <span style={{ 
                background: 'rgba(251, 191, 36, 0.2)', 
                color: '#fbbf24', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Eye size={14} /> Espectador
              </span>
            )}
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {!isSpectator && me && <div>Puntos: <strong>{me.points}</strong></div>}
            {gameState.trumpSuit && (
                <div>Triunfo: <strong style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{gameState.trumpSuit}</strong></div>
            )}
            {gameState.pointValue && gameState.pointValue > 0 ? (
                <div style={{ color: 'var(--success)' }}>Valor: <strong>${gameState.pointValue}</strong></div>
            ) : null}
            <button className="btn" style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }} onClick={handleLeave}>
              Salir
            </button>
        </div>
      </div>

      {/* Area de la mesa adaptada a Mosca con asientos estilo Truco */}
      <div style={styles.tableArea}>
        <div style={styles.mesa}>
          
          {/* Jugadores sentados en posiciones absolutas */}
          {seatedPlayers.map(({ player, seatIndex }) => {
            const playerRoomIdx = gameState.players.findIndex(p => p.id === player.id);
            const active = gameState.turnIndex === playerRoomIdx;
            const isMe = player.id === myId;
            const displayName = isMe ? 'Yo' : player.name;
            const isDealerPlayer = player.id === gameState.players[gameState.dealerIndex].id;
            const isManoPlayer = player.id === gameState.players[gameState.manoIndex].id;
            const posStyle = getPlayerSeatStyle(seatIndex, seatedPlayers.length);

            return (
              <div key={player.id} style={{ ...styles.playerSeat, ...posStyle }}>
                <div style={{
                  ...styles.playerBadge,
                  borderColor: active ? 'var(--success)' : (isMe ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
                  background: active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.9)',
                  opacity: ['DISCARD', 'PLAYING'].includes(gameState.status) && !player.isPlayingRound ? 0.5 : 1,
                  boxShadow: active ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                }}>
                  <div style={styles.playerName}>
                    {displayName} {isDealerPlayer && <span style={styles.dealerTag}>R</span>} {isManoPlayer && <span style={styles.manoTag}>M</span>}
                  </div>
                  <div style={styles.playerMeta}>
                    <span>Pts: {player.points}</span>
                    <span>Baz: {player.tricksWon}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cartas: {player.hand.length}
                  </div>

                  {player.hasDiscarded && player.cardsDiscardedCount !== undefined && player.cardsDiscardedCount > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 'bold', marginTop: 2 }}>
                      Cambió: {player.cardsDiscardedCount} 🃏
                    </div>
                  )}

                  {['DISCARD', 'PLAYING'].includes(gameState.status) && (
                    <div style={{ fontSize: '0.75rem', color: player.isPlayingRound ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', marginTop: 2 }}>
                      {player.isPlayingRound ? 'JUGANDO' : 'PASÓ'}
                    </div>
                  )}

                  {!isMe && !isSpectator && ['PLAYING', 'ROUND_END'].includes(gameState.status) && player.isPlayingRound && (
                    <button 
                      className="btn" 
                      style={styles.renuncioBtn}
                      onClick={() => socket.emit('denounce_renuncio', { roomId: gameState.roomId, infractorId: player.id })}
                    >
                      ¿Renuncio? 🚫
                    </button>
                  )}
                </div>

                {/* Pilas de bazas ganadas al costado del jugador */}
                {player.wonTricks && player.wonTricks.length > 0 && (
                  <div style={styles.wonTricksContainer}>
                    {player.wonTricks.map((trickCards, tIdx) => (
                      <div key={tIdx} style={{
                        position: 'relative',
                        width: 32 + (trickCards.length - 1) * 8,
                        height: 48,
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px dashed rgba(255,255,255,0.15)',
                        borderRadius: '4px'
                      }}>
                        {trickCards.map((card, cIdx) => (
                          <div key={cIdx} style={{
                            position: 'absolute',
                            left: cIdx * 8,
                            zIndex: cIdx,
                            transform: 'scale(0.32)',
                            transformOrigin: 'top left'
                          }}>
                            <CardView card={card} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Centro de la mesa con las cartas jugadas */}
          <div style={styles.centroMesa}>
            {gameState.currentTrick.map((tc, idx) => {
              const player = gameState.players.find(p => p.id === tc.playerId);
              return (
                <div key={idx} style={styles.centerTrickCard}>
                  <CardView card={tc.card} />
                  <span style={styles.centerTrickOwner}>{player?.name}</span>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Area de la mano propia / Panel de espectador */}
      <div className="hand-area glass-panel" style={{
          border: isMyTurn ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
          marginTop: 'auto'
      }}>
        
        {isSpectator ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Panel del Espectador</h3>
              <span style={{ color: 'var(--text-muted)' }}>Viendo la partida en vivo...</span>
            </div>
            {gameState.spectators && gameState.spectators.length > 0 && (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <strong>Espectadores en esta mesa:</strong> {gameState.spectators.map(s => s.name).join(', ')}
              </div>
            )}
          </div>
        ) : me ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>Tu Mano - {me.name} {isMyTurn && <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}> (Es tu turno)</span>}</h3>
                {gameState.status === 'DISCARD' && isMyTurn && (
                    <button 
                        className="btn" 
                        onClick={confirmDiscard}
                    >
                        Confirmar Descarte ({selectedCards.length})
                    </button>
                )}
                {gameState.status === 'ENTERING_ROUND' && isMyTurn && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn" onClick={() => socket.emit('enter_round', { roomId: gameState.roomId, enter: true })}>
                            Voy (Juego)
                        </button>
                        {!isDealer && me.consecutivePasses < 2 && (
                            <button className="btn" style={{ background: 'var(--danger)' }} onClick={() => socket.emit('enter_round', { roomId: gameState.roomId, enter: false })}>
                                Paso (+1)
                            </button>
                        )}
                    </div>
                )}
                {gameState.status === 'ROUND_END' && isDealer && (
                    <button className="btn" style={{ background: 'var(--success)' }} onClick={() => socket.emit('next_round', gameState.roomId)}>
                        Repartir Siguiente Mano
                    </button>
                )}
                {gameState.status === 'ROUND_END' && !isDealer && (
                    <span style={{ color: 'var(--text-muted)' }}>Esperando al repartidor...</span>
                )}
            </div>

            <div className="cards-container">
               {me.hand.map((card, idx) => {
                   if (!card) {
                       return <CardView key={idx} hidden={true} onClick={() => handleCardClick(idx)} disabled={!isMyTurn} />
                   }
                   
                   return (
                       <CardView 
                          key={idx} 
                          card={card as Card} 
                          onClick={() => handleCardClick(idx)}
                          selected={selectedCards.includes(idx)}
                          disabled={!isMyTurn || (['DISCARD', 'PLAYING'].includes(gameState.status) && !me.isPlayingRound)}
                       />
                   )
               })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal/Overlay de Scoreboard Final al terminar el juego */}
      {gameState.status === 'GAME_END' && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.scoreboardModal}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Award size={48} color="var(--accent)" />
            </div>
            <h2 style={{ textAlign: 'center', color: '#fff', marginBottom: 6 }}>¡Partida Terminada!</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20 }}>Tabla de Posiciones Finales</p>
            
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Puesto</th>
                  <th style={styles.th}>Jugador</th>
                  <th style={styles.th}>Puntos</th>
                  {gameState.pointValue && gameState.pointValue > 0 ? <th style={styles.th}>Saldo ($)</th> : null}
                </tr>
              </thead>
              <tbody>
                {scoreboardPlayers.map((player, sIdx) => {
                  const isWinner = sIdx === 0;
                  // En la mosca el ganador queda en 0 o menos. 
                  // Liquidación: los perdedores pagan (puntos_finales * valor_punto) y el ganador cobra.
                  const rawDebt = player.points * (gameState.pointValue || 0);
                  const isPlayerSelf = player.id === myId;
                  
                  return (
                    <tr key={player.id} style={{ 
                      background: isWinner ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      fontWeight: isWinner || isPlayerSelf ? 'bold' : 'normal',
                      borderBottom: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      <td style={styles.td}>
                        {sIdx + 1}° {isWinner ? '👑' : ''}
                      </td>
                      <td style={{ ...styles.td, color: isPlayerSelf ? 'var(--accent)' : '#fff' }}>
                        {player.name} {isPlayerSelf ? '(Tú)' : ''}
                      </td>
                      <td style={styles.td}>
                        {player.points} pts
                      </td>
                      {gameState.pointValue && gameState.pointValue > 0 ? (
                        <td style={{ ...styles.td, color: isWinner ? 'var(--success)' : 'var(--danger)' }}>
                          {isWinner ? (
                            `Recibe $${scoreboardPlayers.slice(1).reduce((acc, curr) => acc + curr.points * (gameState.pointValue || 0), 0)}`
                          ) : (
                            `Paga $${rawDebt}`
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn" style={{ flex: 1, background: 'var(--accent)' }} onClick={handleLeave}>
                Volver al Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tableArea: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '30px 0',
    flex: 1,
    minHeight: '440px',
  },
  mesa: {
    width: '90%',
    maxWidth: '720px',
    height: '400px',
    borderRadius: '200px',
    border: '6px solid #1e293b',
    background: 'radial-gradient(circle, #0f5132 0%, #06371e 100%)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 10px 40px rgba(0,0,0,0.6), 0 20px 50px rgba(0,0,0,0.5)',
  },
  centroMesa: {
    width: '60%',
    height: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '100px',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    gap: '12px',
  },
  playerSeat: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  playerBadge: {
    background: 'rgba(30, 41, 59, 0.9)',
    border: '2px solid transparent',
    padding: '8px 12px',
    borderRadius: '12px',
    color: '#fff',
    minWidth: '110px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  },
  playerMeta: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  dealerTag: {
    background: 'var(--accent)',
    color: '#000',
    padding: '0 4px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.65rem',
  },
  manoTag: {
    background: 'var(--success)',
    color: '#fff',
    padding: '0 4px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.65rem',
  },
  renuncioBtn: {
    marginTop: 4,
    padding: '3px 6px',
    fontSize: '0.65rem',
    background: 'var(--danger)',
    boxShadow: 'none',
    borderRadius: '4px',
    width: '100%',
    whiteSpace: 'nowrap',
  },
  wonTricksContainer: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '120px',
    marginTop: '4px',
  },
  centerTrickCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    transform: 'scale(0.8)',
  },
  centerTrickOwner: {
    fontSize: '0.7rem',
    color: '#cbd5e1',
    background: 'rgba(0,0,0,0.6)',
    padding: '2px 6px',
    borderRadius: '8px',
    whiteSpace: 'nowrap',
  },

  // Modal overlays y scoreboard styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15,23,42,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 16
  },
  scoreboardModal: {
    width: '100%',
    maxWidth: '480px',
    padding: '28px',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    background: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 12
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    borderBottom: '2px solid rgba(255,255,255,0.1)'
  },
  td: {
    padding: '12px 8px',
    fontSize: '0.9rem',
    color: '#e2e8f0'
  },

  // Posiciones relativas alrededor de la mesa
  posBottom: { bottom: '-5%', left: '50%' },
  posTop: { top: '-5%', left: '50%' },
  posLeft: { top: '50%', left: '0%' },
  posRight: { top: '50%', right: '-15%' },

  posBottomLeft: { bottom: '15%', left: '8%' },
  posTopLeft: { top: '15%', left: '8%' },
  posTopRight: { top: '15%', right: '-8%' },
  posBottomRight: { bottom: '15%', right: '-8%' },
};
