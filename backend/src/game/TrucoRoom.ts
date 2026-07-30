import { Deck, Card, Suit } from './Deck';

export type TrucoGameStatus = 
  | 'WAITING' 
  | 'PLAYING' 
  | 'ENVIDO_DECLARATION' 
  | 'ROUND_END' 
  | 'GAME_END';

export interface TrucoPlayer {
  id: string;
  name: string;
  points: number; // Puntos totales (malas + buenas)
  hand: Card[];
  playedCards: Card[]; // Cartas jugadas en esta mano
  connected: boolean;
  team: 'A' | 'B';
  
  // Envido
  declaredEnvidoPoints: number | null; // Canto ingresado
  envidoShown: boolean; // Si mostró sus cartas ocultas al final
}

export interface TrucoTrick {
  playerId: string;
  card: Card;
}

export interface BazaResult {
  winnerPlayerId: string | 'parda';
  winnerTeam: 'A' | 'B' | 'parda';
}

export class TrucoRoom {
  id: string;
  isPrivate: boolean = false;
  status: TrucoGameStatus = 'WAITING';
  players: TrucoPlayer[] = [];
  deck: Deck = new Deck();
  gameType: 'TRUCO' = 'TRUCO';
  mode: '1v1' | '2v2' | '3v3' = '1v1';
  maxPlayers = 2;
  minPlayers = 2;
  pointValue: number = 0;
  spectators: { id: string; name: string }[] = [];

  dealerIndex: number = 0;
  turnIndex: number = 0;
  manoIndex: number = 0;

  // Truco State
  currentTrick: TrucoTrick[] = [];
  bazas: BazaResult[] = []; // Resultados de las bazas (máximo 3)
  trucoBetState: {
    status: 'NONE' | 'CALLED' | 'ACCEPTED' | 'DECLINED';
    currentStake: number; // 2 (Truco), 3 (Retruco), 4 (Vale Cuatro)
    lastCallerTeam: 'A' | 'B' | null;
  } = { status: 'NONE', currentStake: 1, lastCallerTeam: null };

  // Envido State
  envidoBetState: {
    status: 'NONE' | 'CALLED' | 'ACCEPTED' | 'DECLINED';
    history: ('envido' | 'real_envido' | 'falta_envido')[];
    currentStake: number;
    lastCallerId: string | null;
    challengedPlayerId: string | null; // A quién se le cantó
    canCall: boolean; // Solo en primera ronda
  } = { status: 'NONE', history: [], currentStake: 0, lastCallerId: null, challengedPlayerId: null, canCall: true };

  // Verification State
  envidoWinnerPlayerId: string | null = null;
  envidoVerificationTimer: any = null;
  envidoVerificationSecondsLeft: number = 0;
  envidoVerificationStatus: 'IDLE' | 'PENDING_SHOW' | 'VERIFIED' | 'CLAIMED' | 'EXPIRED' = 'IDLE';

  // 3v3 Special Rules
  puntaMode: boolean = false;
  puntaDuelos: {
    dueloIndex: number; // 0, 1, 2
    dueloPlayerIds: [string, string]; // P0 vs P3, P1 vs P4, etc.
    active: boolean;
  } | null = null;

  onStateChange?: () => void;

  constructor(id: string, isPrivate: boolean = false) {
    this.id = id;
    this.isPrivate = isPrivate;
  }

  setMode(mode: '1v1' | '2v2' | '3v3'): void {
    if (this.status !== 'WAITING') throw new Error("No se puede cambiar el modo con el juego empezado");
    this.mode = mode;
    if (mode === '1v1') {
      this.maxPlayers = 2;
      this.minPlayers = 2;
    } else if (mode === '2v2') {
      this.maxPlayers = 4;
      this.minPlayers = 4;
    } else {
      this.maxPlayers = 6;
      this.minPlayers = 6;
    }
  }

  addPlayer(id: string, name: string): void {
    if (this.status !== 'WAITING') throw new Error("El juego ya ha comenzado");
    if (this.players.length >= this.maxPlayers) throw new Error("La sala está llena");
    if (this.players.some(p => p.id === id)) throw new Error("Jugador ya en la sala");

    // Asignar equipo alternadamente
    // A, B, A, B, A, B
    const team = this.players.length % 2 === 0 ? 'A' : 'B';

    this.players.push({
      id,
      name,
      points: 0,
      hand: [],
      playedCards: [],
      connected: true,
      team,
      declaredEnvidoPoints: null,
      envidoShown: false
    });
  }

  removePlayer(id: string): void {
    this.players = this.players.filter(p => p.id !== id);
    if (this.players.length < this.minPlayers && this.status !== 'WAITING') {
      this.status = 'WAITING';
      this.resetMatch();
    }
  }

  resetMatch(): void {
    this.players.forEach(p => {
      p.points = 0;
      p.hand = [];
      p.playedCards = [];
      p.declaredEnvidoPoints = null;
      p.envidoShown = false;
    });
    this.status = 'WAITING';
    this.puntaMode = false;
    this.puntaDuelos = null;
    this.clearVerificationTimer();
  }

  startGame(): void {
    if (this.players.length < this.minPlayers) throw new Error("Faltan jugadores");
    // Ordenar posiciones de los jugadores para que los equipos estén alternados
    // P0 (A), P1 (B), P2 (A), P3 (B), etc.
    const teamA = this.players.filter(p => p.team === 'A');
    const teamB = this.players.filter(p => p.team === 'B');
    const ordered: TrucoPlayer[] = [];
    for (let i = 0; i < Math.max(teamA.length, teamB.length); i++) {
      if (teamA[i]) ordered.push(teamA[i]);
      if (teamB[i]) ordered.push(teamB[i]);
    }
    this.players = ordered;

    this.dealerIndex = Math.floor(Math.random() * this.players.length);
    this.startRound();
  }

  startRound(): void {
    this.deck = new Deck(); // 40 cartas barajadas
    
    // Repartir 3 cartas a cada uno
    this.players.forEach(p => {
      p.hand = this.deck.drawCards(3);
      p.playedCards = [];
      p.declaredEnvidoPoints = null;
      p.envidoShown = false;
    });

    this.currentTrick = [];
    this.bazas = [];
    this.trucoBetState = { status: 'NONE', currentStake: 1, lastCallerTeam: null };
    this.envidoBetState = { status: 'NONE', history: [], currentStake: 0, lastCallerId: null, challengedPlayerId: null, canCall: true };
    this.envidoWinnerPlayerId = null;
    this.envidoVerificationStatus = 'IDLE';
    this.clearVerificationTimer();

    // Determinar si la mano es Punta o Redonda (3v3)
    if (this.mode === '3v3') {
      const hasTeamAt5Malas = this.getTeamPoints('A').total >= 5 || this.getTeamPoints('B').total >= 5;
      const bothBelow10Buenas = this.getTeamPoints('A').total < 25 && this.getTeamPoints('B').total < 25;
      
      if (hasTeamAt5Malas && bothBelow10Buenas) {
        this.puntaMode = !this.puntaMode;
      } else {
        this.puntaMode = false;
      }

      if (this.puntaMode) {
        // En Punta se juegan 3 mini-partidos 1v1 secuenciales:
        // P0 vs P3, P1 vs P4, P2 vs P5 (teniendo en cuenta que se cruzan)
        this.puntaDuelos = {
          dueloIndex: 0,
          dueloPlayerIds: [this.players[0].id, this.players[3].id],
          active: true
        };
        this.status = 'PLAYING';
        this.manoIndex = 0;
        this.turnIndex = 0;
      } else {
        this.puntaDuelos = null;
        this.status = 'PLAYING';
        this.manoIndex = this.getNextPlayerIndex(this.dealerIndex);
        this.turnIndex = this.manoIndex;
      }
    } else {
      this.status = 'PLAYING';
      this.manoIndex = this.getNextPlayerIndex(this.dealerIndex);
      this.turnIndex = this.manoIndex;
    }
  }

  getNextPlayerIndex(current: number): number {
    return (current + 1) % this.players.length;
  }

  // ==== Lógica del Envido ====
  
  static calculateEnvidoPoints(hand: Card[]): number {
    const suitsMap: Record<string, Card[]> = {};
    hand.forEach(c => {
      if (!suitsMap[c.suit]) suitsMap[c.suit] = [];
      suitsMap[c.suit].push(c);
    });

    let maxEnvido = 0;

    for (const suit in suitsMap) {
      const cards = suitsMap[suit];
      if (cards.length >= 2) {
        const getVal = (num: number) => (num >= 10 ? 0 : num);
        const sorted = cards.map(c => getVal(c.number)).sort((a, b) => b - a);
        const points = 20 + sorted[0] + sorted[1];
        if (points > maxEnvido) maxEnvido = points;
      }
    }

    if (maxEnvido === 0) {
      const getVal = (num: number) => (num >= 10 ? 0 : num);
      const vals = hand.map(c => getVal(c.number));
      maxEnvido = Math.max(...vals, 0);
    }

    return maxEnvido;
  }

  cantarEnvido(playerId: string, callType: 'envido' | 'real_envido' | 'falta_envido'): void {
    if (this.status !== 'PLAYING') throw new Error("No se puede cantar Envido en este momento");
    
    const caller = this.getPlayer(playerId);

    // Si ya fue cantado, verificar que sea el desafiado el que responde/canta
    if (this.envidoBetState.status === 'CALLED') {
      if (playerId !== this.envidoBetState.challengedPlayerId) {
        throw new Error("No es tu turno de responder al Envido");
      }
    } else {
      // Primer canto: solo en la primera baza y si el jugador no ha jugado ninguna carta aún
      if (this.bazas.length > 0) throw new Error("El Envido solo se puede cantar en la primera baza");
      if (caller.playedCards.length > 0) throw new Error("No puedes cantar Envido si ya jugaste una carta");
      
      // Regla de 4 y 6 jugadores (primer canto)
      if (this.mode !== '1v1') {
        const activePlayerIds = this.players.map(p => p.id);
        const callerIndex = activePlayerIds.indexOf(playerId);
        const distance = (callerIndex - this.manoIndex + this.players.length) % this.players.length;
        const lastTwoIndexStart = this.players.length - 2;
        if (distance < lastTwoIndexStart) {
          throw new Error("Solo los últimos dos jugadores en actuar en la primera ronda pueden cantar Envido");
        }
      }
    }

    let addedStake = 0;
    if (callType === 'envido') {
      addedStake = 2;
    } else if (callType === 'real_envido') {
      addedStake = 3;
    } else if (callType === 'falta_envido') {
      addedStake = 100;
    }

    this.envidoBetState.status = 'CALLED';
    this.envidoBetState.history.push(callType);
    this.envidoBetState.currentStake += addedStake;
    this.envidoBetState.lastCallerId = playerId;
    this.envidoBetState.challengedPlayerId = this.getNextOpponentId(playerId);
  }

  responderEnvido(playerId: string, response: 'quiero' | 'no_quiero'): void {
    if (this.envidoBetState.status !== 'CALLED') throw new Error("No hay un Envido cantado esperando respuesta");
    
    const responder = this.getPlayer(playerId);
    
    if (response === 'quiero') {
      this.envidoBetState.status = 'ACCEPTED';
      this.status = 'ENVIDO_DECLARATION';
    } else {
      this.envidoBetState.status = 'DECLINED';
      let pointsToAward = 1;
      const history = this.envidoBetState.history;
      if (history.length > 1) {
        const lastCall = history[history.length - 1];
        const lastCost = lastCall === 'envido' ? 2 : lastCall === 'real_envido' ? 3 : 100;
        pointsToAward = Math.max(1, this.envidoBetState.currentStake - lastCost);
      }
      
      const winnerTeam = responder.team === 'A' ? 'B' : 'A';
      this.awardPoints(winnerTeam, pointsToAward);
      this.status = 'PLAYING';
    }
  }

  declararPuntosEnvido(playerId: string, points: number): void {
    if (this.status !== 'ENVIDO_DECLARATION') throw new Error("No estamos en la fase de declaración de Envido");
    const player = this.getPlayer(playerId);
    player.declaredEnvidoPoints = points;

    const allDeclared = this.players.every(p => p.declaredEnvidoPoints !== null);
    if (allDeclared) {
      this.resolveEnvidoWinner();
    }
  }


  private resolveEnvidoWinner(): void {
    let bestPlayer = this.players[0];
    for (let i = 1; i < this.players.length; i++) {
      const p = this.players[i];
      const pPoints = p.declaredEnvidoPoints || 0;
      const bestPoints = bestPlayer.declaredEnvidoPoints || 0;

      if (pPoints > bestPoints) {
        bestPlayer = p;
      } else if (pPoints === bestPoints) {
        const distP = (i - this.manoIndex + this.players.length) % this.players.length;
        const bestIdx = this.players.indexOf(bestPlayer);
        const distBest = (bestIdx - this.manoIndex + this.players.length) % this.players.length;
        if (distP < distBest) {
          bestPlayer = p;
        }
      }
    }

    this.envidoWinnerPlayerId = bestPlayer.id;
    this.status = 'PLAYING';
  }

  // ==== Lógica del Truco ====

  cantarTruco(playerId: string, call: 'truco' | 'retruco' | 'vale_cuatro'): void {
    if (this.status !== 'PLAYING') throw new Error("No se puede cantar Truco ahora");
    if (this.trucoBetState.status === 'CALLED') throw new Error("Ya hay un canto de Truco pendiente");
    
    const caller = this.getPlayer(playerId);
    
    if (this.trucoBetState.status === 'NONE') {
      if (call !== 'truco') throw new Error("Primero debes cantar Truco");
      this.trucoBetState = {
        status: 'CALLED',
        currentStake: 2,
        lastCallerTeam: caller.team
      };
    } else if (this.trucoBetState.status === 'ACCEPTED') {
      if (caller.team === this.trucoBetState.lastCallerTeam) {
        throw new Error("Tu equipo no puede cantar el siguiente nivel de Truco");
      }
      if (call === 'retruco' && this.trucoBetState.currentStake === 2) {
        this.trucoBetState = {
          status: 'CALLED',
          currentStake: 3,
          lastCallerTeam: caller.team
        };
      } else if (call === 'vale_cuatro' && this.trucoBetState.currentStake === 3) {
        this.trucoBetState = {
          status: 'CALLED',
          currentStake: 4,
          lastCallerTeam: caller.team
        };
      } else {
        throw new Error("Canto de Truco inválido para el estado actual");
      }
    }
  }

  responderTruco(playerId: string, response: 'quiero' | 'no_quiero' | 'quiero_retruco' | 'quiero_vale_cuatro'): void {
    if (this.trucoBetState.status !== 'CALLED') throw new Error("No hay un Truco cantado esperando respuesta");
    const responder = this.getPlayer(playerId);
    
    if (response === 'quiero') {
      this.trucoBetState.status = 'ACCEPTED';
    } else if (response === 'no_quiero') {
      this.trucoBetState.status = 'DECLINED';
      const winnerTeam = responder.team === 'A' ? 'B' : 'A';
      const pointsToAward = this.trucoBetState.currentStake - 1;
      this.awardPoints(winnerTeam, Math.max(1, pointsToAward));
      this.startVerificationPhase();
    } else if (response === 'quiero_retruco') {
      if (this.trucoBetState.currentStake !== 2) throw new Error("Solo puedes cantar Retruco ante un Truco");
      this.trucoBetState = {
        status: 'CALLED',
        currentStake: 3,
        lastCallerTeam: responder.team
      };
    } else if (response === 'quiero_vale_cuatro') {
      if (this.trucoBetState.currentStake !== 3) throw new Error("Solo puedes cantar Vale Cuatro ante un Retruco");
      this.trucoBetState = {
        status: 'CALLED',
        currentStake: 4,
        lastCallerTeam: responder.team
      };
    }
  }

  // ==== Irse al mazo (Abandonar ronda) ====
  irseAlMazo(playerId: string): void {
    if (this.status !== 'PLAYING' && this.status !== 'ENVIDO_DECLARATION') {
      throw new Error("No puedes irte al mazo en este estado del juego");
    }

    const player = this.getPlayer(playerId);
    const opponentTeam = player.team === 'A' ? 'B' : 'A';

    let pointsToAward = 1;
    if (this.trucoBetState.status === 'CALLED') {
      pointsToAward = Math.max(1, this.trucoBetState.currentStake - 1);
    } else {
      pointsToAward = this.trucoBetState.currentStake;
    }

    // Otorgar puntos correspondientes al equipo rival
    this.awardPoints(opponentTeam, pointsToAward);

    // Ir a la fase de verificación por si ganaron el Envido y deben mostrar puntos
    this.startVerificationPhase();
  }

  // ==== Jugar Cartas ====

  playCard(playerId: string, cardIndex: number): void {
    if (this.status !== 'PLAYING') throw new Error("El juego no está activo");
    if (this.envidoBetState.status === 'CALLED' || this.trucoBetState.status === 'CALLED') {
      throw new Error("Debes responder a la apuesta pendiente primero");
    }

    if (playerId !== this.players[this.turnIndex].id) {
      throw new Error("No es tu turno de jugar");
    }

    const player = this.getPlayer(playerId);
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      throw new Error("Índice de carta inválido");
    }

    const card = player.hand[cardIndex];
    player.playedCards.push(card);
    player.hand.splice(cardIndex, 1);

    this.currentTrick.push({ playerId, card });



    let requiredPlays = this.players.length;
    if (this.puntaMode && this.puntaDuelos) {
      requiredPlays = 2;
    }

    if (this.currentTrick.length === requiredPlays) {
      this.resolveBaza();
    } else {
      if (this.puntaMode && this.puntaDuelos) {
        const [p1, p2] = this.puntaDuelos.dueloPlayerIds;
        this.turnIndex = this.players.findIndex(p => p.id === (playerId === p1 ? p2 : p1));
      } else {
        this.turnIndex = this.getNextPlayerIndex(this.turnIndex);
      }
    }
  }

  private resolveBaza(): void {
    let bestPlay = this.currentTrick[0];
    let isParda = false;

    for (let i = 1; i < this.currentTrick.length; i++) {
      const play = this.currentTrick[i];
      const weightBest = TrucoRoom.getTrucoWeight(bestPlay.card);
      const weightPlay = TrucoRoom.getTrucoWeight(play.card);

      if (weightPlay > weightBest) {
        bestPlay = play;
        isParda = false;
      } else if (weightPlay === weightBest) {
        isParda = true;
      }
    }

    const winnerPlayer = isParda ? null : this.getPlayer(bestPlay.playerId);
    const winnerTeam = isParda ? 'parda' : winnerPlayer!.team;

    this.bazas.push({
      winnerPlayerId: isParda ? 'parda' : bestPlay.playerId,
      winnerTeam: winnerTeam
    });

    this.currentTrick = [];

    const roundWinner = this.evaluateTrucoWinner();
    if (roundWinner) {
      this.awardPoints(roundWinner, this.trucoBetState.currentStake);
      this.startVerificationPhase();
    } else {
      if (isParda) {
        this.turnIndex = this.manoIndex;
      } else {
        this.turnIndex = this.players.findIndex(p => p.id === bestPlay.playerId);
      }
    }
  }

  private evaluateTrucoWinner(): 'A' | 'B' | null {
    if (this.bazas.length === 0) return null;

    const countWins = (team: 'A' | 'B') => this.bazas.filter(b => b.winnerTeam === team).length;
    const winsA = countWins('A');
    const winsB = countWins('B');

    if (winsA >= 2) return 'A';
    if (winsB >= 2) return 'B';

    if (this.bazas.length === 1) {
      return null;
    }

    if (this.bazas[0].winnerTeam === 'parda') {
      if (this.bazas.length === 2) {
        if (this.bazas[1].winnerTeam === 'A') return 'A';
        if (this.bazas[1].winnerTeam === 'B') return 'B';
      }
      if (this.bazas.length === 3) {
        if (this.bazas[2].winnerTeam === 'A') return 'A';
        if (this.bazas[2].winnerTeam === 'B') return 'B';
        if (this.bazas[2].winnerTeam === 'parda') {
          return this.players[this.manoIndex].team;
        }
      }
    }

    if (this.bazas[1] && this.bazas[1].winnerTeam === 'parda') {
      return this.bazas[0].winnerTeam as 'A' | 'B';
    }

    if (this.bazas[2] && this.bazas[2].winnerTeam === 'parda') {
      return this.bazas[0].winnerTeam as 'A' | 'B';
    }

    if (this.bazas.length === 3) {
      if (winsA > winsB) return 'A';
      if (winsB > winsA) return 'B';
    }

    return null;
  }

  // ==== Fase de Verificación de Envido ====

  private startVerificationPhase(): void {
    if (this.envidoBetState.status !== 'ACCEPTED' || !this.envidoWinnerPlayerId) {
      this.endHand();
      return;
    }

    const winner = this.getPlayer(this.envidoWinnerPlayerId);
    
    const actualSum = TrucoRoom.calculateEnvidoPoints([...winner.playedCards, ...winner.hand]);
    const playedSum = TrucoRoom.calculateEnvidoPoints(winner.playedCards);
    
    // Si las cartas jugadas en mesa ya suman el envido real Y coincide con lo declarado (no mintió), se verifica directo
    if (playedSum === actualSum && winner.declaredEnvidoPoints === actualSum) {
      this.envidoVerificationStatus = 'VERIFIED';
      this.awardEnvidoPointsToWinner();
      this.endHand();
    } else {
      this.envidoVerificationStatus = 'PENDING_SHOW';
      this.envidoVerificationSecondsLeft = 5;
      
      this.envidoVerificationTimer = setInterval(() => {
        this.envidoVerificationSecondsLeft -= 1;
        if (this.envidoVerificationSecondsLeft <= 0) {
          this.clearVerificationTimer();
          // Si expiran los 5s de mostrar, el oponente tiene 3s para reclamar
          this.startClaimWindow('EXPIRED');
        }
        this.onStateChange?.();
      }, 1000);
    }
  }

  private startClaimWindow(status: 'EXPIRED' | 'CLAIMED'): void {
    this.envidoVerificationStatus = status;
    this.envidoVerificationSecondsLeft = 3; // 3 segundos para el reclamo
    
    this.envidoVerificationTimer = setInterval(() => {
      this.envidoVerificationSecondsLeft -= 1;
      if (this.envidoVerificationSecondsLeft <= 0) {
        this.clearVerificationTimer();
        // Si no reclaman a tiempo (3 segundos), el ganador se lleva los puntos por defecto
        this.envidoVerificationStatus = 'VERIFIED';
        this.awardEnvidoPointsToWinner();
        this.endHand();
      }
      this.onStateChange?.();
    }, 1000);
  }

  mostrarPuntosEnvido(playerId: string): void {
    if (this.envidoVerificationStatus !== 'PENDING_SHOW') throw new Error("No está activa la verificación de Envido");
    if (playerId !== this.envidoWinnerPlayerId) throw new Error("Solo el ganador del Envido puede mostrar sus puntos");

    const winner = this.getPlayer(playerId);
    winner.envidoShown = true;
    this.clearVerificationTimer();

    const actualPoints = TrucoRoom.calculateEnvidoPoints([...winner.playedCards, ...winner.hand]);
    if (winner.declaredEnvidoPoints === actualPoints) {
      this.envidoVerificationStatus = 'VERIFIED';
      this.awardEnvidoPointsToWinner();
      this.endHand();
    } else {
      // Si el canto está mal, el oponente tiene 3s para reclamar
      this.startClaimWindow('CLAIMED');
    }
  }

  reclamarPuntosEnvido(playerId: string): void {
    const claimant = this.getPlayer(playerId);
    const winner = this.getPlayer(this.envidoWinnerPlayerId!);
    
    if (claimant.team === winner.team) throw new Error("No puedes reclamar contra tu propio equipo");

    if (this.envidoVerificationStatus === 'EXPIRED') {
      this.clearVerificationTimer();
      const points = this.getEnvidoPointsStake();
      this.awardPoints(claimant.team, points);
      this.envidoVerificationStatus = 'CLAIMED';
      this.endHand();
    } else if (this.envidoVerificationStatus === 'CLAIMED' || this.envidoVerificationStatus === 'PENDING_SHOW') {
      const actualPoints = TrucoRoom.calculateEnvidoPoints([...winner.playedCards, ...winner.hand]);
      if (winner.declaredEnvidoPoints !== actualPoints) {
        this.clearVerificationTimer();
        const points = this.getEnvidoPointsStake();
        this.awardPoints(claimant.team, points);
        this.envidoVerificationStatus = 'CLAIMED';
        this.endHand();
      } else {
        throw new Error("El canto del ganador es correcto, no puedes reclamar");
      }
    } else {
      throw new Error("No hay reclamo disponible en este momento");
    }
  }

  private awardEnvidoPointsToWinner(): void {
    const winner = this.getPlayer(this.envidoWinnerPlayerId!);
    const points = this.getEnvidoPointsStake();
    this.awardPoints(winner.team, points);
  }

  private getEnvidoPointsStake(): number {
    const history = this.envidoBetState.history;
    const isFalta = history.includes('falta_envido');
    if (isFalta) {
      const pointsA = this.getTeamPoints('A').total;
      const pointsB = this.getTeamPoints('B').total;
      const maxTarget = this.mode === '1v1' ? 18 : this.mode === '2v2' ? 24 : 30;
      const leadingPoints = Math.max(pointsA, pointsB);
      return Math.max(1, maxTarget - leadingPoints);
    }
    return this.envidoBetState.currentStake;
  }

  private clearVerificationTimer(): void {
    if (this.envidoVerificationTimer) {
      clearInterval(this.envidoVerificationTimer);
      this.envidoVerificationTimer = null;
    }
  }

  private awardPoints(team: 'A' | 'B', qty: number): void {
    this.players.forEach(p => {
      if (p.team === team) {
        p.points += qty;
      }
    });

    const maxPoints = this.mode === '1v1' ? 18 : this.mode === '2v2' ? 24 : 30;
    if (this.getTeamPoints('A').total >= maxPoints || this.getTeamPoints('B').total >= maxPoints) {
      this.status = 'GAME_END';
    }
  }

  private endHand(): void {
    this.clearVerificationTimer();
    
    if (this.status === 'GAME_END') return;

    if (this.puntaMode && this.puntaDuelos) {
      const nextIdx = this.puntaDuelos.dueloIndex + 1;
      if (nextIdx < 3) {
        this.puntaDuelos.dueloIndex = nextIdx;
        if (nextIdx === 1) {
          this.puntaDuelos.dueloPlayerIds = [this.players[1].id, this.players[4].id];
        } else {
          this.puntaDuelos.dueloPlayerIds = [this.players[2].id, this.players[5].id];
        }
        this.startRound();
      } else {
        this.puntaMode = false;
        this.puntaDuelos = null;
        this.dealerIndex = this.getNextPlayerIndex(this.dealerIndex);
        this.status = 'ROUND_END';
      }
    } else {
      this.dealerIndex = this.getNextPlayerIndex(this.dealerIndex);
      this.status = 'ROUND_END';
    }
  }

  getPlayer(id: string): TrucoPlayer {
    const p = this.players.find(x => x.id === id);
    if (!p) throw new Error("Jugador no encontrado");
    return p;
  }

  getNextOpponentId(playerId: string): string {
    const player = this.getPlayer(playerId);
    let idx = this.players.indexOf(player);
    for (let i = 1; i < this.players.length; i++) {
      const nextP = this.players[(idx + i) % this.players.length];
      if (nextP.team !== player.team) {
        return nextP.id;
      }
    }
    return player.id;
  }

  getTeamPoints(team: 'A' | 'B'): { total: number; malas: number; buenas: number } {
    const rep = this.players.find(p => p.team === team);
    const total = rep ? rep.points : 0;
    const limitMalas = this.mode === '1v1' ? 9 : this.mode === '2v2' ? 12 : 15;
    
    let malas = Math.min(total, limitMalas);
    let buenas = Math.max(0, total - limitMalas);

    return { total, malas, buenas };
  }

  static getTrucoWeight(card: Card): number {
    const { number, suit } = card;
    if (number === 1 && suit === 'espada') return 14;
    if (number === 1 && suit === 'basto') return 13;
    if (number === 7 && suit === 'espada') return 12;
    if (number === 7 && suit === 'oro') return 11;
    if (number === 3) return 10;
    if (number === 2) return 9;
    if (number === 1 && (suit === 'oro' || suit === 'copa')) return 8;
    if (number === 12) return 7;
    if (number === 11) return 6;
    if (number === 10) return 5;
    if (number === 7 && (suit === 'copa' || suit === 'basto')) return 4;
    if (number === 6) return 3;
    if (number === 5) return 2;
    if (number === 4) return 1;
    return 0;
  }
}
