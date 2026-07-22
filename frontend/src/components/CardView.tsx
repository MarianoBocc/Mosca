import React from 'react';
import type { Card } from '../store/gameStore';
import { CircleDot, Wine, Swords, Club } from 'lucide-react';

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

const suitConfig = {
  oro: { icon: CircleDot, color: '#fbbf24', label: 'Oro' },
  copa: { icon: Wine, color: '#ef4444', label: 'Copa' },
  espada: { icon: Swords, color: '#3b82f6', label: 'Espada' },
  basto: { icon: Club, color: '#10b981', label: 'Basto' },
};

export const CardView: React.FC<CardViewProps> = ({ 
  card, 
  hidden = false, 
  onClick, 
  selected = false,
  disabled = false
}) => {
  if (hidden || !card) {
    return (
      <div 
        className="card-view hidden-card"
        style={{ cursor: onClick && !disabled ? 'pointer' : 'default' }}
        onClick={!disabled ? onClick : undefined}
      >
        <div style={styles.cardBackPattern}></div>
      </div>
    );
  }

  const config = suitConfig[card.suit];
  const Icon = config.icon;

  return (
    <div 
      className="card-view"
      style={{
        borderColor: selected ? 'var(--accent)' : 'transparent',
        transform: selected ? 'translateY(-10px)' : 'none',
        opacity: disabled ? 0.6 : 1,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        boxShadow: selected ? '0 10px 25px rgba(56, 189, 248, 0.4)' : '0 4px 15px rgba(0,0,0,0.5)'
      }}
      onClick={!disabled ? onClick : undefined}
    >
      {/* Top Left */}
      <div style={{ ...styles.corner, ...styles.topLeft, color: config.color }}>
        <span style={styles.number}>{card.number}</span>
        <Icon size={16} />
      </div>

      {/* Center Icon */}
      <div style={{ ...styles.center, color: config.color }}>
        <Icon size={48} strokeWidth={1.5} />
      </div>

      {/* Bottom Right */}
      <div style={{ ...styles.corner, ...styles.bottomRight, color: config.color }}>
        <span style={styles.number}>{card.number}</span>
        <Icon size={16} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  cardBackPattern: {
    width: '70%',
    height: '80%',
    border: '2px dashed rgba(255,255,255,0.2)',
    borderRadius: 6
  },

  corner: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLeft: {
    top: 6,
    left: 6,
  },
  bottomRight: {
    bottom: 6,
    right: 6,
    transform: 'rotate(180deg)'
  },
  number: {
    fontWeight: 800,
    fontSize: '1.2rem',
    lineHeight: 1
  },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
};
