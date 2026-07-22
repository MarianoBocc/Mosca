import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../services/socket';
import { Copy, Check } from 'lucide-react';

export const Lobby = () => {
  const gameState = useGameStore(state => state.gameState);
  const [copied, setCopied] = useState(false);

  if (!gameState) return null;

  const handleStart = () => {
      socket.emit('start_game', gameState.roomId);
  };

  const handleLeave = () => {
      // Unirse a sala vacía para salir (o emitir un evento 'leave_room', pero recargar o desconectar es más simple por ahora)
      window.location.href = '/'; 
  };

  const copyInviteLink = () => {
      const url = `${window.location.origin}/?room=${gameState.roomId}`;
      navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2>Sala: <span style={{ color: 'var(--accent)' }}>{gameState.roomId}</span></h2>
            <button className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px' }} onClick={handleLeave}>
                Salir
            </button>
        </div>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Esperando jugadores...</p>
        
        <ul style={styles.playerList}>
          {gameState.players.map((p) => (
            <li key={p.id} style={styles.playerItem}>
              <span>{p.name} {p.id === socket.id ? '(Tú)' : ''}</span>
            </li>
          ))}
        </ul>
        
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button 
             className="btn" 
             onClick={copyInviteLink}
             style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)' }}
          >
             {copied ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
             {copied ? '¡Enlace copiado!' : 'Copiar enlace de invitación'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16 }}>{gameState.players.length} / {gameState.players[0] ? 5 : 5} jugadores</p>
            <button 
              className="btn" 
              onClick={handleStart}
              disabled={gameState.players.length < 4}
              style={{ width: '100%' }}
            >
              Comenzar Partida
            </button>
            {gameState.players.length < 4 && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>
                Se requieren al menos 4 jugadores
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%'
  },
  panel: {
    width: '100%',
    maxWidth: 400,
  },
  playerList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  playerItem: {
    background: 'rgba(0,0,0,0.2)',
    padding: '12px 16px',
    borderRadius: 8,
    borderLeft: '4px solid var(--accent)'
  }
};
