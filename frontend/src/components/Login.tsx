import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../services/socket';

export const Login = () => {
  const [nameInput, setNameInput] = useState('');
  const setPlayerName = useGameStore(state => state.setPlayerName);
  const error = useGameStore(state => state.error);

  useEffect(() => {
      // Intenta recuperar el nombre guardado
      const savedName = localStorage.getItem('mosca_playerName');
      if (savedName) setNameInput(savedName);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    
    const finalName = nameInput.trim();
    localStorage.setItem('mosca_playerName', finalName);
    setPlayerName(finalName);
    
    // Conectar si no lo está y emitir nombre
    if (!socket.connected) {
        socket.connect();
    }
    socket.emit('set_name', finalName);

    // Si viene de un enlace de invitación ?room=SALAX
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        socket.emit('join_room', { roomId: roomFromUrl.toUpperCase(), playerName: finalName });
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <h1 style={{ textAlign: 'center', marginBottom: 24, color: 'var(--accent)', fontSize: '2.5rem' }}>MOSCA</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24 }}>Ingresa tu apodo para jugar</p>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <input 
              className="input-field" 
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Ej: Jugador 1"
              maxLength={15}
              autoFocus
              style={{ textAlign: 'center', fontSize: '1.2rem', padding: '16px' }}
            />
          </div>
          <button type="submit" className="btn" style={{ marginTop: 8, padding: '16px', fontSize: '1.1rem' }}>
            Entrar
          </button>
        </form>
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
    padding: 20
  },
  panel: {
    width: '100%',
    maxWidth: 400,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid var(--danger)',
    color: '#fca5a5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: '0.9rem',
    textAlign: 'center'
  }
};
