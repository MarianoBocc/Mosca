import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../services/socket';
import { Users, Lock, Unlock, Play } from 'lucide-react';

export const GlobalLobby = () => {
  const onlineUsers = useGameStore(state => state.onlineUsers);
  const availableRooms = useGameStore(state => state.availableRooms);
  const playerName = useGameStore(state => state.playerName);
  const error = useGameStore(state => state.error);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleJoin = (roomId: string) => {
      socket.emit('join_room', { roomId, playerName });
  };

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoomId.trim()) return;
      socket.emit('create_room', { 
          roomId: newRoomId.trim().toUpperCase(), 
          playerName, 
          isPrivate 
      });
      setShowCreateModal(false);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
          <h2>¡Hola, <span style={{color: 'var(--accent)'}}>{playerName}</span>!</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}>
              <Users size={18} /> {onlineUsers.length} en línea
          </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
          <div style={styles.section} className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3>Partidas Públicas</h3>
                  <button className="btn" onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px' }}>
                      Crear Sala
                  </button>
              </div>

              {availableRooms.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay partidas públicas esperando. ¡Crea una!</p>
              ) : (
                  <div style={styles.roomList}>
                      {availableRooms.map(room => (
                          <div key={room.id} style={styles.roomCard}>
                              <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Sala: {room.id}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Jugadores: {room.playersCount} / {room.maxPlayers}</div>
                              </div>
                              <button 
                                  className="btn" 
                                  onClick={() => handleJoin(room.id)}
                                  disabled={room.playersCount >= room.maxPlayers}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}
                              >
                                  <Play size={16} /> Unirse
                              </button>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <div style={styles.section} className="glass-panel">
              <h3>Unirse a sala privada</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>Si tienes el código de una sala privada, ingrésalo aquí.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                      className="input-field" 
                      placeholder="Código de Sala" 
                      id="privateRoomInput"
                      style={{ textTransform: 'uppercase' }}
                  />
                  <button className="btn" onClick={() => {
                      const val = (document.getElementById('privateRoomInput') as HTMLInputElement).value;
                      if(val) handleJoin(val.toUpperCase());
                  }}>Entrar</button>
              </div>
          </div>
      </div>

      {showCreateModal && (
          <div style={styles.modalOverlay}>
              <div className="glass-panel" style={styles.modal}>
                  <h3 style={{ marginBottom: 20 }}>Crear Nueva Sala</h3>
                  <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                          <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>Código de la sala</label>
                          <input 
                              className="input-field" 
                              value={newRoomId} 
                              onChange={e => setNewRoomId(e.target.value)}
                              placeholder="Ej: MESA1"
                              maxLength={8}
                              style={{ textTransform: 'uppercase' }}
                              required
                          />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input 
                              type="checkbox" 
                              id="isPrivate" 
                              checked={isPrivate} 
                              onChange={e => setIsPrivate(e.target.checked)} 
                              style={{ width: 18, height: 18 }}
                          />
                          <label htmlFor="isPrivate" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                              {isPrivate ? <Lock size={16} color="var(--danger)" /> : <Unlock size={16} color="var(--success)" />}
                              Hacer sala privada (oculta del lobby)
                          </label>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                          <button type="button" className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={() => setShowCreateModal(false)}>
                              Cancelar
                          </button>
                          <button type="submit" className="btn" style={{ flex: 1 }}>
                              Crear
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    maxWidth: 800,
    margin: '0 auto',
    width: '100%',
  },
  header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      padding: '0 8px'
  },
  content: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
  },
  section: {
      padding: 20,
  },
  roomList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
  },
  roomCard: {
      background: 'rgba(0,0,0,0.2)',
      padding: 16,
      borderRadius: 12,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderLeft: '4px solid var(--accent)'
  },
  error: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid var(--danger)',
    color: '#fca5a5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center'
  },
  modalOverlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 20
  },
  modal: {
      width: '100%',
      maxWidth: 400,
      padding: 24
  }
};
