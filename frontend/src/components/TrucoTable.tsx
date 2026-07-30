import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../services/socket';
import { CardView } from './CardView';
import { Award, LogOut } from 'lucide-react';

export const TrucoTable = () => {
  const gameState = useGameStore(state => state.gameState);
  const error = useGameStore(state => state.error);

  const [envidoPointsInput, setEnvidoPointsInput] = useState<string>('');

  if (!gameState) return null;

  const me = gameState.players.find(p => p.id === socket.id);
  if (!me) return <div style={{ padding: 40, textAlign: 'center' }}>No estás en esta sala de Truco</div>;

  // Encontrar índices clave
  const myIndex = gameState.players.findIndex(p => p.id === socket.id);
  const isMyTurn = gameState.turnIndex === myIndex;
  const activePlayer = gameState.players[gameState.turnIndex];

  // Calcular puntos por equipos
  // Buscamos un representante de cada equipo para obtener el puntaje
  const repA = gameState.players.find(p => p.team === 'A');
  const repB = gameState.players.find(p => p.team === 'B');

  const scoreA = repA ? { malas: repA.malas || 0, buenas: repA.buenas || 0 } : { malas: 0, buenas: 0 };
  const scoreB = repB ? { malas: repB.malas || 0, buenas: repB.buenas || 0 } : { malas: 0, buenas: 0 };

  const handlePlayCard = (cardIndex: number) => {
    if (!isMyTurn) return;
    socket.emit('play_card', { roomId: gameState.roomId, cardIndex });
  };

  const handleLeave = () => {
    sessionStorage.removeItem('mosca_roomId');
    sessionStorage.removeItem('mosca_gameType');
    window.location.href = '/';
  };

  // Acciones de Envido
  const handleCantarEnvido = (callType: 'envido' | 'real_envido' | 'falta_envido') => {
    socket.emit('cantar_envido', { roomId: gameState.roomId, callType });
  };

  const handleResponderEnvido = (response: 'quiero' | 'no_quiero') => {
    socket.emit('responder_envido', { roomId: gameState.roomId, response });
  };

  const handleDeclararEnvido = () => {
    const pts = parseInt(envidoPointsInput, 10);
    if (isNaN(pts) || pts < 0 || pts > 33) {
      alert("Canto inválido (debe estar entre 0 y 33)");
      return;
    }
    socket.emit('declarar_envido', { roomId: gameState.roomId, points: pts });
    setEnvidoPointsInput('');
  };

  // Acciones de Truco
  const handleCantarTruco = (call: 'truco' | 'retruco' | 'vale_cuatro') => {
    socket.emit('cantar_truco', { roomId: gameState.roomId, call });
  };

  const handleResponderTruco = (response: 'quiero' | 'no_quiero') => {
    socket.emit('responder_truco', { roomId: gameState.roomId, response });
  };

  const handleIrseAlMazo = () => {
    socket.emit('irse_al_mazo', { roomId: gameState.roomId });
  };

  // Verificación de Envido
  const handleMostrarPuntos = () => {
    socket.emit('mostrar_puntos_envido', { roomId: gameState.roomId });
  };

  const handleReclamarPuntos = () => {
    socket.emit('reclamar_puntos_envido', { roomId: gameState.roomId });
  };

  const handleNextRound = () => {
    socket.emit('next_round', gameState.roomId);
  };

  // Ordenar los jugadores para sentarlos alrededor de la mesa circular
  // Empezando por mí en la parte inferior, y siguiendo en sentido horario
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

  const mePlayer = gameState.players.find(p => p.id === socket.id);
  const myPlayedCount = mePlayer?.playedCards?.length || 0;
  const bazasCount = gameState.bazas?.length || 0;

  // Distancia del jugador actual al manoIndex
  const activePlayerIds = gameState.players.map(p => p.id);
  const myPosIdx = activePlayerIds.indexOf(socket.id || '');
  const distance = (myPosIdx - gameState.manoIndex + gameState.players.length) % gameState.players.length;
  const isLastTwo = distance >= gameState.players.length - 2;

  const canCallEnvido = gameState.status === 'PLAYING' && 
                        gameState.envidoBetState?.status === 'NONE' &&
                        bazasCount === 0 &&
                        myPlayedCount === 0 &&
                        (gameState.mode === '1v1' || isLastTwo);
  const showEnvidoRespond = gameState.envidoBetState?.status === 'CALLED' && gameState.envidoBetState.challengedPlayerId === socket.id;

  // Truco Bet options
  const showTrucoRespond = gameState.trucoBetState?.status === 'CALLED' && 
    gameState.players.find(p => p.id === socket.id)?.team !== gameState.trucoBetState.lastCallerTeam;

  const currentTrucoStake = gameState.trucoBetState?.currentStake || 1;
  const isEnvidoPending = gameState.envidoBetState?.status === 'CALLED';
  const isTrucoPending = gameState.trucoBetState?.status === 'CALLED';

  // Determinar ganadores de Envido provisorios
  const envidoWinner = gameState.envidoWinnerPlayerId ? gameState.players.find(p => p.id === gameState.envidoWinnerPlayerId) : null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sala Truco: <span style={{ color: 'var(--success)' }}>{gameState.roomId}</span></h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Modo {gameState.mode} {gameState.puntaMode ? ' (Mano de Punta 1v1)' : ' (Mano Redonda)'}</span>
        </div>
        <button className="btn" style={styles.leaveBtn} onClick={handleLeave}>
          <LogOut size={16} /> Salir
        </button>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Grid Central */}
      <div style={styles.mainGrid}>
        
        {/* Lado Izquierdo: Tablero y Mesa */}
        <div style={styles.tableArea}>
          <div className="glass-panel" style={styles.mesa}>
            
            {/* Jugadores alrededor de la mesa */}
            {seatedPlayers.map(({ player, seatIndex }) => {
              const isDealer = gameState.players[gameState.dealerIndex].id === player.id;
              const isMano = gameState.players[gameState.manoIndex].id === player.id;
              const isPlayerTurn = activePlayer?.id === player.id;
              const isPuntaActive = gameState.puntaMode && gameState.puntaDuelos?.dueloPlayerIds.includes(player.id);
              const isSelf = player.id === socket.id;

              // Asignar clases de posición según cantidad de jugadores
              let posStyle = {};
              const total = seatedPlayers.length;
              if (total === 2) {
                posStyle = seatIndex === 0 ? styles.posBottom : styles.posTop;
              } else if (total === 4) {
                if (seatIndex === 0) posStyle = styles.posBottom;
                if (seatIndex === 1) posStyle = styles.posLeft;
                if (seatIndex === 2) posStyle = styles.posTop;
                if (seatIndex === 3) posStyle = styles.posRight;
              } else {
                // 6 jugadores
                if (seatIndex === 0) posStyle = styles.posBottom;
                if (seatIndex === 1) posStyle = styles.posBottomLeft;
                if (seatIndex === 2) posStyle = styles.posTopLeft;
                if (seatIndex === 3) posStyle = styles.posTop;
                if (seatIndex === 4) posStyle = styles.posTopRight;
                if (seatIndex === 5) posStyle = styles.posBottomRight;
              }

               // Calcular desvío de cartas jugadas hacia el centro de la mesa
              let playedCardsStyle: React.CSSProperties = {
                position: 'absolute',
                display: 'flex',
                gap: '0px',
                transform: 'scale(0.65)',
                transformOrigin: 'center',
                background: 'rgba(0,0,0,0.3)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px dashed rgba(255,255,255,0.1)'
              };

              if (total === 2) {
                if (seatIndex === 0) {
                  playedCardsStyle = { ...playedCardsStyle, bottom: '110%', left: '50%', transform: 'translateX(-50%) scale(0.65)' };
                } else {
                  playedCardsStyle = { ...playedCardsStyle, top: '110%', left: '50%', transform: 'translateX(-50%) scale(0.65)' };
                }
              } else {
                if (posStyle === styles.posBottom || posStyle === styles.posBottomLeft || posStyle === styles.posBottomRight) {
                  playedCardsStyle = { ...playedCardsStyle, bottom: '115%', left: '50%', transform: 'translateX(-50%) scale(0.65)' };
                } else if (posStyle === styles.posTop || posStyle === styles.posTopLeft || posStyle === styles.posTopRight) {
                  playedCardsStyle = { ...playedCardsStyle, top: '115%', left: '50%', transform: 'translateX(-50%) scale(0.65)' };
                } else if (posStyle === styles.posLeft) {
                  playedCardsStyle = { ...playedCardsStyle, left: '115%', top: '50%', transform: 'translateY(-50%) scale(0.65)' };
                } else if (posStyle === styles.posRight) {
                  playedCardsStyle = { ...playedCardsStyle, right: '115%', top: '50%', transform: 'translateY(-50%) scale(0.65)' };
                }
              }

              return (
                <div key={player.id} style={{ ...styles.playerSeat, ...posStyle }}>
                  <div style={{
                    ...styles.playerBadge,
                    borderColor: isPlayerTurn ? 'var(--success)' : (player.team === 'A' ? 'var(--accent)' : 'var(--danger)'),
                    background: isPlayerTurn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                    opacity: player.connected ? 1 : 0.5,
                    boxShadow: isPlayerTurn ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                    position: 'relative'
                  }}>
                    {player.declaredEnvidoPoints !== null && (
                      <div style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(245, 158, 11, 0.95)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                        border: '1px solid #f59e0b',
                        whiteSpace: 'nowrap',
                        zIndex: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>📢</span>
                        <span>{player.declaredEnvidoPoints} pts</span>
                      </div>
                    )}
                    <span style={styles.playerName}>
                      {player.name} {isSelf && '(Tú)'}
                    </span>
                    <div style={styles.playerMeta}>
                      <span style={{ color: player.team === 'A' ? 'var(--accent)' : '#ef4444' }}>Eq {player.team}</span>
                      {isDealer && <span style={styles.dealerTag}>D</span>}
                      {isMano && <span style={styles.manoTag}>M</span>}
                    </div>
                    {gameState.puntaMode && (
                      <span style={{ fontSize: '0.7rem', color: isPuntaActive ? 'var(--success)' : 'var(--text-muted)' }}>
                        {isPuntaActive ? '⚔️ Duelo Activo' : 'Espera duelo'}
                      </span>
                    )}
                  </div>

                   {/* Historial de cartas jugadas y reveladas de la mano en la mesa */}
                  {(((player.playedCards || []).length > 0) || (player.hand && player.hand.some(c => c !== null))) && (
                    <div style={playedCardsStyle}>
                      {/* Cartas jugadas */}
                      {(player.playedCards || []).map((card, cIdx) => (
                        <div key={`played-${cIdx}`} style={{ marginLeft: cIdx > 0 ? '-55px' : '0px', zIndex: cIdx, position: 'relative' }}>
                          <CardView card={card} />
                        </div>
                      ))}
                      {/* Cartas reveladas de la mano (no nulas) */}
                      {player.hand.map((card, hIdx) => {
                        if (!card) return null;
                        if (player.id === socket.id) return null; // No mostrar nuestras propias cartas de la mano en la mesa
                        const totalPlayed = (player.playedCards || []).length;
                        const totalIdx = totalPlayed + hIdx;
                        return (
                          <div key={`hand-${hIdx}`} style={{ marginLeft: totalIdx > 0 ? '-55px' : '0px', zIndex: totalIdx, position: 'relative', opacity: 0.85 }}>
                            <CardView card={card} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Centro de la mesa: Mensajes de estado */}
            <div style={styles.centroMesa}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: 8 }}>
                {gameState.status === 'ENVIDO_DECLARATION' ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>Declarando Envido...</span>
                ) : gameState.envidoBetState?.status === 'CALLED' ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>¡Envido Cantado!</span>
                ) : gameState.trucoBetState?.status === 'CALLED' ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>¡Truco Cantado!</span>
                ) : (
                  <span>Mesa de Truco</span>
                )}
              </div>
            </div>


          </div>
        </div>

        {/* Lado Derecho: Puntajes, Estado de Apuestas y Acciones */}
        <div style={styles.sidebar}>
          
          {/* Marcador de Puntos (Malas y Buenas) */}
          <div className="glass-panel" style={styles.scorePanel}>
            <h3 style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>Tablero de Puntos</h3>
            <div style={styles.teamsScore}>
              {/* Equipo A */}
              <div style={styles.teamScoreCol}>
                <span style={{ fontWeight: 800, color: 'var(--accent)' }}>EQUIPO A</span>
                <div style={styles.scoreBox}>
                  <div>Malas: <span style={styles.scoreNum}>{scoreA.malas}</span></div>
                  <div>Buenas: <span style={styles.scoreNum}>{scoreA.buenas}</span></div>
                </div>
              </div>

              {/* Equipo B */}
              <div style={styles.teamScoreCol}>
                <span style={{ fontWeight: 800, color: '#ef4444' }}>EQUIPO B</span>
                <div style={styles.scoreBox}>
                  <div>Malas: <span style={styles.scoreNum}>{scoreB.malas}</span></div>
                  <div>Buenas: <span style={styles.scoreNum}>{scoreB.buenas}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Estado de Apuestas Activas */}
          <div className="glass-panel" style={styles.betStatusPanel}>
            <h3 style={{ marginBottom: 8, fontSize: '1.1rem', fontWeight: 600 }}>Estado de la Mano</h3>
            
            <div style={styles.statusRow}>
              <span>Apuesta Truco:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                {currentTrucoStake === 1 ? 'Sin Truco' : currentTrucoStake === 2 ? 'Truco (2 pts)' : currentTrucoStake === 3 ? 'Retruco (3 pts)' : 'Vale Cuatro (4 pts)'}
              </span>
            </div>

            {gameState.envidoBetState && (
              <div style={styles.statusRow}>
                <span>Apuesta Envido:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                  {gameState.envidoBetState.status === 'NONE' ? 'No cantado' : `${gameState.envidoBetState.status} (${gameState.envidoBetState.currentStake >= 100 ? 'Falta Envido' : `${gameState.envidoBetState.currentStake} pts`})`}
                </span>
              </div>
            )}

            {/* Bazas de Truco ganadas */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Historial de Bazas:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map((num) => {
                  const baza = gameState.bazas?.[num - 1];
                  let label = 'Parda';
                  let color = '#94a3b8';
                  if (baza) {
                    if (baza.winnerTeam === 'A') {
                      label = 'Eq A';
                      color = 'var(--accent)';
                    } else if (baza.winnerTeam === 'B') {
                      label = 'Eq B';
                      color = 'var(--danger)';
                    }
                  } else {
                    label = '-';
                  }

                  return (
                    <div key={num} style={{ ...styles.bazaTag, background: color }}>
                      Baza {num}: {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panel de Decisiones y Controles */}
          <div className="glass-panel" style={styles.actionsPanel}>
            <h3 style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 600 }}>Tus Acciones</h3>

            {gameState.status === 'ENVIDO_DECLARATION' && (
              <div style={styles.envidoDeclForm}>
                <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>¡Canta tus puntos de Envido!</span>
                {me.declaredEnvidoPoints === null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="number"
                        placeholder="Tus puntos (0-33)"
                        className="input-field"
                        value={envidoPointsInput}
                        onChange={e => setEnvidoPointsInput(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px' }}
                      />
                      <button className="btn" style={{ padding: '8px 16px', background: 'var(--success)' }} onClick={handleDeclararEnvido}>Cantar</button>
                    </div>
                    {gameState.players.some(p => p.team !== me.team && p.declaredEnvidoPoints !== null) && (
                      <button 
                        className="btn" 
                        style={{ width: '100%', background: 'var(--danger)', padding: '10px' }} 
                        onClick={() => socket.emit('son_buenas', { roomId: gameState.roomId })}
                      >
                        Son Buenas
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>Ya cantaste: {me.declaredEnvidoPoints} puntos.</p>
                )}
              </div>
            )}

            {/* Respuestas a Apuestas */}
            {showEnvidoRespond && (
              <div style={styles.actionBlock}>
                <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: 8 }}>¡Te cantaron Envido! Responder:</div>
                <div style={styles.btnRow}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => handleResponderEnvido('quiero')}>Quiero</button>
                  <button className="btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => handleResponderEnvido('no_quiero')}>No Quiero</button>
                </div>
                <div style={{ ...styles.btnRow, marginTop: 8 }}>
                  {gameState.envidoBetState?.history.filter(h => h === 'envido').length === 1 && (
                    <button 
                      className="btn" 
                      style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff' }} 
                      onClick={() => handleCantarEnvido('envido')}
                    >
                      Envido (+2)
                    </button>
                  )}
                  <button 
                    className="btn" 
                    style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff' }} 
                    onClick={() => handleCantarEnvido('real_envido')}
                    disabled={gameState.envidoBetState?.history.includes('real_envido') || gameState.envidoBetState?.history.includes('falta_envido')}
                  >
                    Real Envido (+3)
                  </button>
                  <button 
                    className="btn" 
                    style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff' }} 
                    onClick={() => handleCantarEnvido('falta_envido')}
                    disabled={gameState.envidoBetState?.history.includes('falta_envido')}
                  >
                    Falta Envido
                  </button>
                </div>
              </div>
            )}

            {showTrucoRespond && (
              <div style={styles.actionBlock}>
                <div style={{ color: 'var(--success)', fontWeight: 'bold', marginBottom: 8 }}>¡Te cantaron Truco! Responder:</div>
                <div style={styles.btnRow}>
                  <button className="btn" style={{ flex: 1, background: 'var(--success)' }} onClick={() => handleResponderTruco('quiero')}>Quiero</button>
                  <button className="btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => handleResponderTruco('no_quiero')}>No Quiero</button>
                </div>
                <div style={{ ...styles.btnRow, marginTop: 8 }}>
                  {currentTrucoStake === 2 && (
                    <button className="btn" style={{ flex: 1, background: 'var(--accent)' }} onClick={() => handleResponderTruco('quiero_retruco' as any)}>Quiero Retruco</button>
                  )}
                  {currentTrucoStake === 3 && (
                    <button className="btn" style={{ flex: 1, background: 'var(--accent)' }} onClick={() => handleResponderTruco('quiero_vale_cuatro' as any)}>Quiero Vale Cuatro</button>
                  )}
                </div>
                <button 
                  className="btn" 
                  style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger)', color: '#fca5a5', marginTop: 10 }} 
                  onClick={handleIrseAlMazo}
                >
                  Irse al Mazo 🏳️
                </button>
              </div>
            )}

            {/* Botón de Cantar Truco y Envido en tu turno regular */}
            {isMyTurn && !isEnvidoPending && !isTrucoPending && gameState.status === 'PLAYING' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {canCallEnvido && (
                  <div style={styles.cantosGroup}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Cantar Envido:</div>
                    <div style={styles.btnRow}>
                      <button className="btn" style={{ flex: 1, padding: '8px' }} onClick={() => handleCantarEnvido('envido')}>Envido</button>
                      <button className="btn" style={{ flex: 1, padding: '8px' }} onClick={() => handleCantarEnvido('real_envido')}>Real Envido</button>
                      <button className="btn" style={{ flex: 1, padding: '8px' }} onClick={() => handleCantarEnvido('falta_envido')}>Falta Envido</button>
                    </div>
                  </div>
                )}

                <div style={styles.cantosGroup}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Cantar Truco:</div>
                  <div style={styles.btnRow}>
                    {currentTrucoStake === 1 && gameState.trucoBetState?.status === 'NONE' && (
                      <button className="btn" style={{ flex: 1, background: 'var(--success)' }} onClick={() => handleCantarTruco('truco')}>Truco</button>
                    )}
                    {currentTrucoStake === 2 && gameState.trucoBetState?.status === 'ACCEPTED' && me.team !== gameState.trucoBetState?.lastCallerTeam && (
                      <button className="btn" style={{ flex: 1, background: 'var(--success)' }} onClick={() => handleCantarTruco('retruco')}>Retruco</button>
                    )}
                    {currentTrucoStake === 3 && gameState.trucoBetState?.status === 'ACCEPTED' && me.team !== gameState.trucoBetState?.lastCallerTeam && (
                      <button className="btn" style={{ flex: 1, background: 'var(--success)' }} onClick={() => handleCantarTruco('vale_cuatro')}>Vale Cuatro</button>
                    )}
                  </div>
                </div>

                <button 
                  className="btn" 
                  style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger)', color: '#fca5a5', marginTop: 4 }} 
                  onClick={handleIrseAlMazo}
                >
                  Irse al Mazo 🏳️
                </button>
              </div>
            )}

            {/* Fase de Verificación y Reclamo de Envido */}
            {gameState.envidoWinnerPlayerId && (
              <div style={styles.verificationCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: 'var(--success)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={18} />
                    Envido de {envidoWinner?.name} ({envidoWinner?.declaredEnvidoPoints} pts)
                  </div>
                </div>

                {/* Botón de Reclamo siempre visible para el oponente a menos que ya esté verificado */}
                {me.team !== envidoWinner?.team && 
                 gameState.envidoVerificationStatus !== 'VERIFIED' && 
                 gameState.envidoVerificationStatus !== 'CLAIMED' && (
                  <button 
                    className="btn" 
                    style={{ width: '100%', background: 'var(--danger)', marginBottom: 12, fontSize: '0.85rem' }} 
                    onClick={handleReclamarPuntos}
                  >
                    Exigir Contraste / Reclamar Puntos
                  </button>
                )}
                
                {gameState.envidoVerificationStatus === 'PENDING_SHOW' && (
                  <div>
                    {gameState.envidoWinnerPlayerId === socket.id ? (
                      <div>
                        <p style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--text-muted)' }}>
                          Tus cartas del envido no están jugadas en mesa. ¡Muéstralas en menos de 5 segundos!
                        </p>
                        <button className="btn" style={{ width: '100%', background: 'var(--success)' }} onClick={handleMostrarPuntos}>
                          Mostrar Puntos ({gameState.envidoVerificationSecondsLeft}s)
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Esperando que {envidoWinner?.name} muestre sus cartas ({gameState.envidoVerificationSecondsLeft}s)...
                      </p>
                    )}
                  </div>
                )}

                {gameState.envidoVerificationStatus === 'EXPIRED' && (
                  <div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--danger)', marginBottom: 4 }}>
                      ¡El tiempo expiró y no mostró los puntos!
                    </p>
                  </div>
                )}

                {gameState.envidoVerificationStatus === 'CLAIMED' && (
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--danger)', fontWeight: 'bold' }}>
                      ⚠️ Puntos reclamados o canto incorrecto. Puntos para el oponente.
                    </span>
                  </div>
                )}

                {gameState.envidoVerificationStatus === 'VERIFIED' && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>
                    ✓ Puntos verificados exitosamente.
                  </div>
                )}
              </div>
            )}

            {/* Pantalla de Fin de Ronda */}
            {gameState.status === 'ROUND_END' && (
              <div style={styles.endRoundCard}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--success)' }}>Mano Finalizada</div>
                <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={handleNextRound}>
                  Siguiente Mano
                </button>
              </div>
            )}

            {/* Pantalla de Fin de Juego */}
            {gameState.status === 'GAME_END' && (
              <div style={styles.endGameCard}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent)', marginBottom: 8 }}>¡Partida Terminada!</div>
                <div style={{ fontSize: '1.1rem', marginBottom: 16 }}>
                  Ganador: {scoreA.malas + scoreA.buenas >= (gameState.mode === '1v1' ? 18 : gameState.mode === '2v2' ? 24 : 30) ? 'EQUIPO A' : 'EQUIPO B'}
                </div>
                <button className="btn" style={{ width: '100%' }} onClick={handleLeave}>
                  Volver al Lobby
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Footer / Tu Mano de Cartas */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isMyTurn ? 'var(--success)' : 'var(--text-muted)' }}>
              {isMyTurn ? '¡Es tu turno!' : `Turno de ${activePlayer?.name}`}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Tu Equipo: {me.team}</span>
          </div>

          <div style={styles.handCardsContainer}>
            {me.hand && me.hand.map((card, index) => (
              <CardView 
                key={index} 
                card={card || undefined} 
                onClick={isMyTurn ? () => handlePlayCard(index) : undefined}
                disabled={!isMyTurn}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0f172a',
    color: '#fff',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(10px)',
    height: '64px'
  },
  leaveBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid var(--danger)',
    color: '#fca5a5',
    padding: '8px 16px',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.2)',
    borderBottom: '1px solid var(--danger)',
    color: '#fca5a5',
    padding: '8px',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: 'semibold'
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    height: 'calc(100vh - 184px)', // 64px header + 120px footer
    overflow: 'hidden'
  },
  tableArea: {
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  mesa: {
    width: '100%',
    maxWidth: 700,
    height: '100%',
    maxHeight: 500,
    borderRadius: 200, // Hace que la mesa sea ovalada
    border: '6px solid #1e293b',
    background: 'radial-gradient(circle, #0f5132 0%, #06371e 100%)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 10px 40px rgba(0,0,0,0.6), 0 20px 50px rgba(0,0,0,0.5)'
  },
  centroMesa: {
    width: '60%',
    height: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '100px',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px dashed rgba(255, 255, 255, 0.1)'
  },
  trickGrid: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  trickCardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6
  },
  trickCardOwner: {
    fontSize: '0.75rem',
    color: '#cbd5e1',
    background: 'rgba(0,0,0,0.6)',
    padding: '2px 8px',
    borderRadius: 10
  },
  sidebar: {
    padding: 16,
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(15, 23, 42, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto'
  },
  scorePanel: {
    padding: 16
  },
  teamsScore: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16
  },
  teamScoreCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  scoreBox: {
    background: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    width: '100%',
    textAlign: 'center',
    fontSize: '0.85rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  scoreNum: {
    fontWeight: 'bold',
    fontSize: '1rem',
    color: '#fff'
  },
  betStatusPanel: {
    padding: 16
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    marginBottom: 6
  },
  bazaTag: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: 4,
    fontSize: '0.75rem',
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'semibold'
  },
  actionsPanel: {
    padding: 16,
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  envidoDeclForm: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8
  },
  actionBlock: {
    background: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8
  },
  btnRow: {
    display: 'flex',
    gap: 8
  },
  cantosGroup: {
    background: 'rgba(0,0,0,0.15)',
    padding: 10,
    borderRadius: 8
  },
  verificationCard: {
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    padding: 12,
    borderRadius: 12,
    marginTop: 12
  },
  endRoundCard: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid var(--success)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    textAlign: 'center'
  },
  endGameCard: {
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid var(--accent)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    textAlign: 'center'
  },
  footer: {
    height: '120px',
    background: 'rgba(15, 23, 42, 0.9)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px'
  },
  footerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 900,
    width: '100%',
    gap: 32
  },
  handCardsContainer: {
    display: 'flex',
    gap: 12
  },

  // Posicionamiento de asientos circular
  playerSeat: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: 10
  },
  playerBadge: {
    background: 'rgba(30, 41, 59, 0.8)',
    border: '2px solid transparent',
    padding: '8px 12px',
    borderRadius: 12,
    color: '#fff',
    minWidth: '100px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  playerMeta: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  dealerTag: {
    background: 'var(--accent)',
    color: '#000',
    padding: '0 4px',
    borderRadius: 4,
    fontWeight: 'bold',
    fontSize: '0.7rem'
  },
  manoTag: {
    background: 'var(--success)',
    color: '#fff',
    padding: '0 4px',
    borderRadius: 4,
    fontWeight: 'bold',
    fontSize: '0.7rem'
  },

  // Coordenadas absolutas de asientos
  posBottom: { bottom: '5%', left: '50%' },
  posTop: { top: '5%', left: '50%' },
  posLeft: { top: '50%', left: '10%' },
  posRight: { top: '50%', right: '10%' },

  // Para 6 jugadores
  posBottomLeft: { bottom: '15%', left: '20%' },
  posBottomRight: { bottom: '15%', right: '20%' },
  posTopLeft: { top: '15%', left: '20%' },
  posTopRight: { top: '15%', right: '20%' }
};
