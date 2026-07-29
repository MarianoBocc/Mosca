import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../services/socket';
import { Copy, Check } from 'lucide-react';

export const Lobby = () => {
  const gameState = useGameStore(state => state.gameState);
  const [copied, setCopied] = useState(false);

  if (!gameState) return null;

  const isTruco = gameState.gameType === 'TRUCO';
  
  let minPlayers = 4;
  let maxPlayers = 5;

  if (isTruco) {
    if (gameState.mode === '1v1') {
      minPlayers = 2;
      maxPlayers = 2;
    } else if (gameState.mode === '2v2') {
      minPlayers = 4;
      maxPlayers = 4;
    } else {
      minPlayers = 6;
      maxPlayers = 6;
    }
  }

  const handleStart = () => {
      socket.emit('start_game', gameState.roomId);
  };

  const handleLeave = () => {
      sessionStorage.removeItem('mosca_roomId');
      sessionStorage.removeItem('mosca_gameType');
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
            <h2>Sala: <span style={{ color: isTruco ? 'var(--success)' : 'var(--accent)' }}>{gameState.roomId}</span></h2>
            <button className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px' }} onClick={handleLeave}>
                Salir
            </button>
        </div>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          {isTruco ? `Modo Truco: ${gameState.mode}` : 'Modo Mosca'} - Esperando jugadores...
        </p>
        
        <ul style={styles.playerList}>
          {gameState.players.map((p, idx) => {
            const teamInfo = isTruco ? ` - Equipo ${idx % 2 === 0 ? 'A' : 'B'}` : '';
            return (
              <li key={p.id} style={{ ...styles.playerItem, borderLeft: `4px solid ${isTruco ? (idx % 2 === 0 ? 'var(--success)' : 'var(--danger)') : 'var(--accent)'}` }}>
                <span>{p.name} {p.id === socket.id ? '(Tú)' : ''}{teamInfo}</span>
              </li>
            );
          })}
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
            <p style={{ marginBottom: 16 }}>{gameState.players.length} / {maxPlayers} jugadores</p>
            <button 
              className="btn" 
              onClick={handleStart}
              disabled={isTruco ? gameState.players.length !== maxPlayers : gameState.players.length < minPlayers}
              style={{ width: '100%', background: isTruco ? 'var(--success)' : 'var(--accent)' }}
            >
              Comenzar Partida
            </button>
            {((isTruco && gameState.players.length !== maxPlayers) || (!isTruco && gameState.players.length < minPlayers)) && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>
                Se requieren exactamente {maxPlayers} jugadores para iniciar en este modo.
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
  }
};
