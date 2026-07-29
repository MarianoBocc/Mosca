import React from 'react';
import { useGameStore } from '../store/gameStore';

export const GameSelect = () => {
  const setSelectedGame = useGameStore(state => state.setSelectedGame);

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <h1 style={styles.title}>Selecciona tu Juego</h1>
        <p style={styles.subtitle}>Elige una modalidad para entrar al lobby de juego</p>

        <div style={styles.cardsContainer}>
          {/* Card Mosca */}
          <div 
            onClick={() => setSelectedGame('MOSCA')} 
            style={{ ...styles.card, backgroundImage: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0.4) 100%)' }}
            className="glass-panel game-card"
          >
            <div style={styles.badge}>Tradicional</div>
            <h2 style={{ ...styles.cardTitle, color: 'var(--accent)' }}>MOSCA</h2>
            <p style={styles.cardDesc}>
              Juego de descarte y bazas de 4 a 5 jugadores. Elige bien cuándo entrar a la ronda y ten cuidado con el renuncio.
            </p>
            <button className="btn" style={{ width: '100%', marginTop: 'auto' }}>Jugar Mosca</button>
          </div>

          {/* Card Truco */}
          <div 
            onClick={() => setSelectedGame('TRUCO')} 
            style={{ ...styles.card, backgroundImage: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.4) 100%)' }}
            className="glass-panel game-card"
          >
            <div style={{ ...styles.badge, backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', color: 'var(--success)' }}>Famoso</div>
            <h2 style={{ ...styles.cardTitle, color: 'var(--success)' }}>TRUCO</h2>
            <p style={styles.cardDesc}>
              El clásico juego de cartas argentino. Canta Envido, miente con el Truco y derrota a tus oponentes mano a mano, en parejas o de a 6.
            </p>
            <button className="btn" style={{ width: '100%', marginTop: 'auto', background: 'var(--success)', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}>Jugar Truco</button>
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
    padding: 24,
    minHeight: '100vh',
  },
  wrapper: {
    maxWidth: 900,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 800,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: '-0.05em',
    background: 'linear-gradient(to right, #f8fafc, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'var(--text-muted)',
    marginBottom: 48,
    textAlign: 'center',
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 32,
    borderRadius: 20,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: 380,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  badge: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: '4px 12px',
    borderRadius: 100,
    fontSize: '0.8rem',
    fontWeight: 600,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
  },
  cardTitle: {
    fontSize: '2.2rem',
    fontWeight: 800,
    marginBottom: 16,
    letterSpacing: '-0.02em',
    marginTop: 10,
  },
  cardDesc: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    marginBottom: 24,
  }
};
