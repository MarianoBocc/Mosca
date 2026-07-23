import  { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Card } from '../store/gameStore';
import { socket } from '../services/socket';
import { CardView } from './CardView';

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

  const me = gameState.players.find(p => p.id === myId);
  const myIndex = gameState.players.findIndex(p => p.id === myId);
  const isMyTurn = gameState.turnIndex === myIndex;
  const isDealer = gameState.dealerIndex === myIndex;

  if (!me) {
      return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <h2 style={{ color: 'var(--danger)' }}>Error: Jugador no encontrado</h2>
              <p style={{ color: 'var(--text-muted)' }}>La conexión se reinició o tu ID cambió.</p>
              <button className="btn" onClick={() => window.location.reload()}>Volver al Lobby</button>
          </div>
      );
  }

  // Acciones
  const handleCardClick = (index: number) => {
    if (!isMyTurn) return;

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
      socket.emit('discard_cards', { roomId: gameState.roomId, cardIndexes: selectedCards });
      setSelectedCards([]);
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

  return (
    <div className="game-table-container">
      {renuncioMsg && (
        <div style={{
            background: renuncioMsg.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            textAlign: 'center',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            marginBottom: 8
        }}>
            {renuncioMsg.message}
        </div>
      )}
      <div className="game-header glass-panel">
        <div style={{ display: 'flex', gap: 20 }}>
            <div>Sala: <strong>{gameState.roomId}</strong></div>
            <div style={{ color: 'var(--accent)' }}>{getStatusText()}</div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
            <div>Puntos: <strong>{me.points}</strong></div>
            {gameState.trumpSuit && (
                <div>Triunfo: <strong style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{gameState.trumpSuit}</strong></div>
            )}
        </div>
      </div>

      <div className="table-area">
        <div className="opponents-container">
            {gameState.players.map((p, idx) => {
                const active = gameState.turnIndex === idx;
                const isMe = p.id === myId;
                const displayName = isMe ? 'Yo' : p.name;
                const dealerMark = p.id === gameState.players[gameState.dealerIndex].id ? '(R)' : '';
                return (
                    <div key={p.id} className="opponent-panel" style={{
                        border: active ? '2px solid var(--success)' : (isMe ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)'),
                        opacity: ['DISCARD', 'PLAYING'].includes(gameState.status) && !p.isPlayingRound ? 0.5 : 1
                    }}>
                        <div style={{ fontWeight: 'bold', color: isMe ? 'var(--accent)' : 'inherit' }}>{displayName} {dealerMark}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Puntos: {p.points} | Bazas: {p.tricksWon}</div>
                        <div style={{ fontSize: '0.8rem' }}>Cartas: {p.hand.length} {p.consecutivePasses > 0 ? `| Pases: ${p.consecutivePasses}` : ''}</div>
                        {['DISCARD', 'PLAYING'].includes(gameState.status) && (
                            <div style={{ fontSize: '0.8rem', color: p.isPlayingRound ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                                {p.isPlayingRound ? 'JUGANDO' : 'PASÓ'}
                            </div>
                        )}
                        {!isMe && ['PLAYING', 'ROUND_END'].includes(gameState.status) && p.isPlayingRound && (
                            <button 
                                className="btn" 
                                style={{ 
                                    marginTop: 8, 
                                    padding: '4px 8px', 
                                    fontSize: '0.7rem', 
                                    background: 'var(--danger)',
                                    boxShadow: 'none',
                                    borderRadius: '4px',
                                    width: '100%',
                                    whiteSpace: 'nowrap'
                                }}
                                onClick={() => socket.emit('denounce_renuncio', { roomId: gameState.roomId, infractorId: p.id })}
                            >
                                ¿Renuncio? 🚫
                            </button>
                        )}
                    </div>
                )
            })}
        </div>

        <div className="center-table">
          {gameState.currentTrick.map((tc, idx) => {
             const player = gameState.players.find(p => p.id === tc.playerId);
             return (
                 <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                     <CardView card={tc.card} />
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{player?.name}</span>
                 </div>
             )
          })}
        </div>
      </div>

      <div className="hand-area glass-panel" style={{
          border: isMyTurn ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)'
      }}>
        
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
               // Si es nulo es porque está oculto (por ej. dealer seleccionando triunfo)
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
    </div>
  );
};

// Styles replaced by App.css classNames
