export type Suit = 'oro' | 'copa' | 'espada' | 'basto';
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  number: CardNumber;
  weight: number; // Mayor peso = mayor valor
}

// 1, 3, 12, 11, 10, 7, 6, 5, 4, 2
const valueToWeight: Record<CardNumber, number> = {
  1: 10,
  3: 9,
  12: 8,
  11: 7,
  10: 6,
  7: 5,
  6: 4,
  5: 3,
  4: 2,
  2: 1
};

export class Deck {
  cards: Card[];

  constructor() {
    this.cards = this.createDeck();
    this.shuffle();
  }

  private createDeck(): Card[] {
    const suits: Suit[] = ['oro', 'copa', 'espada', 'basto'];
    const numbers: CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const number of numbers) {
        deck.push({
          suit,
          number,
          weight: valueToWeight[number]
        });
      }
    }
    return deck;
  }

  // Mezclar mazo (Fisher-Yates)
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // Extraer N cartas desde el "tope" (inicio) del array
  public drawCards(count: number): Card[] {
    if (this.cards.length < count) {
      throw new Error("No hay suficientes cartas en el mazo");
    }
    return this.cards.splice(0, count);
  }
}
