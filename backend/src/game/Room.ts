import { Deck, Card, Suit } from './Deck';
import { saveGameHistory } from './historyDb';

export type GameStatus = 'WAITING' | 'DEALING' | 'TRUMP_SELECTION' | 'ENTERING_ROUND' | 'DISCARD' | 'PLAYING' | 'ROUND_END' | 'GAME_END';

export interface Player {
  id: string; // Socket ID
  name: string;
  points: number; // Comienza en 15, baja a 0
  hand: Card[];
  tricksWon: number;
  hasDiscarded: boolean;
  connected: boolean;
  consecutivePasses: number; // Límite 2
  isPlayingRound: boolean; // Si decidió entrar a la mano
  hasRenunciado: boolean; // Si cometió un renuncio en la mano actual
  cardsDiscardedCount?: number;
  wonTricks?: Card[][];
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export class Room {
  id: string;
  isPrivate: boolean = false;
  status: GameStatus = 'WAITING';
  players: Player[] = [];
  deck: Deck = new Deck();
  onStateChange?: () => void;
  pointValue: number = 0;
  spectators: { id: string; name: string }[] = [];
  
  dealerIndex: number = 0;
  turnIndex: number = 0; // De quién es el turno
  manoIndex: number = 0; // El jugador a la derecha del repartidor (sentido antihorario)
  
  trumpSuit: Suit | null = null;
  trumpCard: Card | null = null;
  leadSuit: Suit | null = null; // Pinta de salida en la ronda actual
  currentTrick: TrickCard[] = [];
  
  maxPlayers = 5; // El juego es de 4 o 5 participantes
  minPlayers = 4;

  constructor(id: string, isPrivate: boolean = false) {
    this.id = id;
    this.isPrivate = isPrivate;
  }

  // ==== Fase: Espera ====
  addPlayer(id: string, name: string): void {
    if (this.status !== 'WAITING') throw new Error("El juego ya ha comenzado");
    if (this.players.length >= this.maxPlayers) throw new Error("La sala está llena");
    if (this.players.some(p => p.id === id)) throw new Error("Jugador ya en la sala");
    
    this.players.push({
      id,
      name,
      points: 15,
      hand: [],
      tricksWon: 0,
      hasDiscarded: false,
      connected: true,
      consecutivePasses: 0,
      isPlayingRound: false,
      hasRenunciado: false,
      cardsDiscardedCount: 0,
      wonTricks: []
    });
  }

  removePlayer(id: string): void {
    this.players = this.players.filter(p => p.id !== id);
    if (this.players.length < this.minPlayers && this.status !== 'WAITING') {
       this.status = 'WAITING'; // Reset si alguien sale en medio (Simplificado por ahora)
    }
  }

  startGame(): void {
    if (this.players.length < this.minPlayers) throw new Error("Faltan jugadores");
    // Seleccionar dealer al azar la primera vez
    this.dealerIndex = Math.floor(Math.random() * this.players.length);
    this.startRound();
  }

  // ==== Fase: Repartir ====
  startRound(): void {
    this.deck = new Deck(); // Crea mazo y lo baraja aleatoriamente
    
    // Repartir 5 cartas a cada jugador
    this.players.forEach(p => {
      p.hand = this.deck.drawCards(5);
      p.tricksWon = 0;
      p.hasDiscarded = false;
      p.isPlayingRound = false; // Reset
      p.hasRenunciado = false;
      p.cardsDiscardedCount = 0;
      p.wonTricks = [];
    });
    
    this.trumpSuit = null;
    this.trumpCard = null;
    this.leadSuit = null;
    this.currentTrick = [];
    
    // Sentido antihorario: el siguiente es el dealer - 1
    this.manoIndex = this.getNextPlayerIndex(this.dealerIndex);
    
    this.status = 'TRUMP_SELECTION';
    this.turnIndex = this.dealerIndex; // El dealer selecciona el triunfo
  }

  // Utilidad para avanzar en sentido antihorario (en un array normal, si 0 es a las 12, 1 a las 9, etc)
  // Depende de cómo sentemos a los jugadores. Si index 0,1,2,3 es sentido horario, antihorario es -1
  // Asumamos que el orden en el array es el orden en la mesa (horario).
  // Sentido antihorario sería: indice - 1
  private getNextPlayerIndex(currentIndex: number): number {
    let next = currentIndex - 1;
    if (next < 0) next = this.players.length - 1;
    return next;
  }

  // ==== Fase: Selección de Triunfo ====
  setTrump(playerId: string, cardIndex: number): void {
    if (this.status !== 'TRUMP_SELECTION') throw new Error("No es fase de selección de triunfo");
    if (this.players[this.turnIndex].id !== playerId) throw new Error("No es tu turno");
    
    const player = this.players[this.turnIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) throw new Error("Índice de carta inválido");

    this.trumpCard = player.hand[cardIndex];
    this.trumpSuit = this.trumpCard.suit;

    // Regla del As: Si es 1, todos están obligados a jugar
    if (this.trumpCard.number === 1) {
        this.players.forEach(p => {
            p.isPlayingRound = true;
            p.consecutivePasses = 0;
        });
        this.status = 'DISCARD';
        this.turnIndex = this.manoIndex;
    } else {
        this.status = 'ENTERING_ROUND';
        this.turnIndex = this.manoIndex;
    }
  }

  // ==== Fase: Entrar o Pasar ====
  enterRound(playerId: string, enter: boolean): void {
    if (this.status !== 'ENTERING_ROUND') throw new Error("No es fase de apuestas");
    if (this.players[this.turnIndex].id !== playerId) throw new Error("No es tu turno");

    const player = this.players[this.turnIndex];
    const isDealer = this.turnIndex === this.dealerIndex;

    if (enter) {
        player.isPlayingRound = true;
        player.consecutivePasses = 0;
    } else {
        // Validaciones para no poder pasar
        if (isDealer) throw new Error("El repartidor no puede pasar");
        if (player.consecutivePasses >= 2) throw new Error("No puedes pasar más de 2 veces seguidas");
        
        // Regla: si todos pasaron antes que tú y tú eres el último antes del dealer, debes ir
        // (es decir, sólo falta que hable el dealer, o sea nextPlayer == dealerIndex)
        const nextPlayerIdx = this.getNextPlayerIndex(this.turnIndex); // Sentido de juego (antihorario)
        if (nextPlayerIdx === this.dealerIndex) {
            const anyoneEntered = this.players.some(p => p.id !== player.id && p.id !== this.players[this.dealerIndex].id && p.isPlayingRound);
            if (!anyoneEntered) {
                throw new Error("Eres el último, estás obligado a entrar porque todos pasaron");
            }
        }

        player.isPlayingRound = false;
        player.consecutivePasses++;
        player.points++; // Penalización inmediata

        // Devolver cartas al mazo
        this.deck.cards.push(...player.hand);
        player.hand = [];
    }

    // Avanzar turno (antihorario)
    const nextIndex = this.getNextPlayerIndex(this.turnIndex);
    
    // Si dimos la vuelta hasta el dealer, el dealer auto-entra y pasamos a descartar
    if (nextIndex === this.dealerIndex) {
        const dealer = this.players[this.dealerIndex];
        dealer.isPlayingRound = true;
        dealer.consecutivePasses = 0;
        
        this.status = 'DISCARD';
        // El primer turno de descarte es para el primer jugador que entró, partiendo desde el mano
        this.turnIndex = this.getFirstActivePlayerIndex(this.manoIndex);
    } else {
        this.turnIndex = nextIndex;
    }
  }

  private getFirstActivePlayerIndex(startIndex: number): number {
      let idx = startIndex;
      for (let i = 0; i < this.players.length; i++) {
          if (this.players[idx].isPlayingRound) return idx;
          idx = this.getNextPlayerIndex(idx);
      }
      return startIndex; // Fallback
  }

  // ==== Fase: Descarte ====
  discardCards(playerId: string, cardIndexes: number[]): void {
    if (this.status !== 'DISCARD') throw new Error("No es fase de descarte");
    if (this.players[this.turnIndex].id !== playerId) throw new Error("No es tu turno de descartar");
    
    const player = this.players[this.turnIndex];
    if (player.hasDiscarded) throw new Error("Ya te descartaste");

    const isDealer = this.turnIndex === this.dealerIndex;
    const maxDiscard = isDealer ? 4 : 3;

    if (cardIndexes.length > maxDiscard) throw new Error(`Puedes descartar máximo ${maxDiscard} cartas`);

    // Eliminar duplicados y ordenar descendente para splice seguro
    const toRemove = [...new Set(cardIndexes)].sort((a, b) => b - a);
    
    for (const index of toRemove) {
        if (index >= 0 && index < player.hand.length) {
            player.hand.splice(index, 1);
        }
    }

    // Robar nuevas cartas
    const newCards = this.deck.drawCards(toRemove.length);
    player.hand.push(...newCards);
    player.hasDiscarded = true;
    player.cardsDiscardedCount = toRemove.length;

    // Avanzar turno al siguiente jugador ACTIVO (antihorario)
    this.turnIndex = this.getFirstActivePlayerIndex(this.getNextPlayerIndex(this.turnIndex));

    // Si dimos la vuelta completa y volvimos al primero que tira, pasamos a JUGAR
    if (this.turnIndex === this.getFirstActivePlayerIndex(this.manoIndex)) {
        this.status = 'PLAYING';
    }
  }

  // ==== Fase: Juego ====
  playCard(playerId: string, cardIndex: number): void {
    if (this.status !== 'PLAYING') throw new Error("No es fase de juego");
    if (this.players[this.turnIndex].id !== playerId) throw new Error("No es tu turno");

    const activePlayersCount = this.players.filter(p => p.isPlayingRound).length;
    if (this.currentTrick.length >= activePlayersCount) {
        throw new Error("Esperando que se limpie la baza anterior");
    }

    const player = this.players[this.turnIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) throw new Error("Carta inválida");

    const cardToPlay = player.hand[cardIndex];

    // Regla: Obligatorio seguir el palo (pinta) - Si no la sigue teniendo, comete renuncio
    if (this.currentTrick.length > 0) {
        if (!this.leadSuit) this.leadSuit = this.currentTrick[0].card.suit;
        
        const hasLeadSuit = player.hand.some(c => c.suit === this.leadSuit);
        if (hasLeadSuit && cardToPlay.suit !== this.leadSuit) {
            player.hasRenunciado = true; // Se comete renuncio silenciosamente
        }
    } else {
        this.leadSuit = cardToPlay.suit;
    }

    // TODO: La validación del "Renuncio" se hace aparte o por denuncia, permitimos jugar la carta.

    player.hand.splice(cardIndex, 1);
    this.currentTrick.push({ playerId, card: cardToPlay });

    // ¿Terminó la baza? (Solo cuentan los que juegan)
    if (this.currentTrick.length === activePlayersCount) {
        setTimeout(() => {
            this.evaluateTrick();
            if (this.onStateChange) this.onStateChange();
        }, 3000);
    } else {
        this.turnIndex = this.getFirstActivePlayerIndex(this.getNextPlayerIndex(this.turnIndex));
    }
  }

  private evaluateTrick(): void {
    let winningTrickCard = this.currentTrick[0];

    for (let i = 1; i < this.currentTrick.length; i++) {
        const tc = this.currentTrick[i];
        
        const isTrump = tc.card.suit === this.trumpSuit;
        const winningIsTrump = winningTrickCard.card.suit === this.trumpSuit;

        if (isTrump && !winningIsTrump) {
            winningTrickCard = tc;
        } else if (isTrump && winningIsTrump) {
            if (tc.card.weight > winningTrickCard.card.weight) winningTrickCard = tc;
        } else if (!isTrump && !winningIsTrump) {
            // Si la pinta es igual a la leadSuit y tiene mayor peso
            if (tc.card.suit === this.leadSuit && tc.card.weight > winningTrickCard.card.weight) {
                winningTrickCard = tc;
            }
        }
    }

    const winnerId = winningTrickCard.playerId;
    const winnerPlayer = this.players.find(p => p.id === winnerId);
    if (winnerPlayer) {
        winnerPlayer.tricksWon++;
        if (!winnerPlayer.wonTricks) winnerPlayer.wonTricks = [];
        winnerPlayer.wonTricks.push(this.currentTrick.map(tc => tc.card));
    }

    // El ganador sale en la siguiente baza
    this.turnIndex = this.players.findIndex(p => p.id === winnerId);
    this.currentTrick = [];
    this.leadSuit = null;

    // ¿Terminó la ronda (mano vacía para los que juegan)?
    const firstActive = this.players.find(p => p.isPlayingRound);
    if (firstActive && firstActive.hand.length === 0) {
        this.endRound();
    }
  }

  private saveHistory(): void {
    saveGameHistory({
      roomId: this.id,
      gameType: 'MOSCA',
      pointValue: this.pointValue,
      players: this.players.map(p => ({ name: p.name, points: p.points })),
      timestamp: new Date().toISOString()
    });
  }

  private endRound(): void {
    // Solo se evalúan los puntos de los que entraron a jugar
    this.players.filter(p => p.isPlayingRound).forEach(p => {
        if (p.tricksWon > 0) {
            p.points -= p.tricksWon;
        } else {
            p.points += 5; // Sanción por no llevarse ninguna baza
        }
    });

    const hasWinner = this.players.some(p => p.points <= 0);
    if (hasWinner) {
        this.status = 'GAME_END';
        this.saveHistory();
    } else {
        this.status = 'ROUND_END'; // Pausa pequeña antes de la próxima
        // El siguiente dealer es el mano actual (antihorario)
        this.dealerIndex = this.getNextPlayerIndex(this.dealerIndex);
    }
  }

  denounceRenuncio(denuncianteId: string, infractorId: string): { success: boolean; message: string } {
    if (!['PLAYING', 'ROUND_END'].includes(this.status)) {
        throw new Error("Solo puedes denunciar un renuncio durante el juego o al finalizar la ronda");
    }

    const denunciante = this.players.find(p => p.id === denuncianteId);
    const infractor = this.players.find(p => p.id === infractorId);

    if (!denunciante || !infractor) throw new Error("Jugadores no encontrados");
    if (denuncianteId === infractorId) throw new Error("No te puedes denunciar a ti mismo");

    if (infractor.hasRenunciado) {
        // Penalización al infractor: +5 puntos
        infractor.points += 5;

        // Puntos a favor (tricksWon) quedan sin efecto para el infractor y se asignan al denunciante
        const tricksWonByInfractor = infractor.tricksWon;
        const wonTricksByInfractor = infractor.wonTricks || [];
        infractor.tricksWon = 0;
        infractor.wonTricks = [];

        // Restamos esa cantidad de puntos al denunciante
        denunciante.points -= tricksWonByInfractor;
        if (!denunciante.wonTricks) denunciante.wonTricks = [];
        denunciante.wonTricks.push(...wonTricksByInfractor);

        // Limpiar flag
        infractor.hasRenunciado = false;

        // Verificar fin del juego
        const hasWinner = this.players.some(p => p.points <= 0);
        if (hasWinner) {
            this.status = 'GAME_END';
            this.saveHistory();
        }

        return {
            success: true,
            message: `¡Denuncia correcta! ${denunciante.name} denunció a ${infractor.name}. ${infractor.name} recibe +5 puntos de castigo y sus ${tricksWonByInfractor} bazas ganadas se le restan a ${denunciante.name}.`
        };
    } else {
        // Falsa denuncia: sin penalización para el denunciante (conforme comentarios)
        return {
            success: false,
            message: `¡Denuncia falsa! ${denunciante.name} acusó a ${infractor.name} de renuncio pero no cometió infracción.`
        };
    }
  }
}
