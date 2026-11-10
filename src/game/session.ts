import { config } from '../config';
import { bestKey, boardFor, defaultOptions, RULES_VERSION, type GameOptions, type BoardKey } from './options';
import type { Mode } from '../platform/types';
import { makeDeck, type Question, type QuestionBank, type Random } from './questions';

export interface Session {
  id: string;
  mode: Mode;
  options: GameOptions;
  bestKey: string;
  boardKey: BoardKey | null;
  bankVersion: string;
  rulesVersion: string;
  deck: Question[];
  index: number;
  score: number;
  mistakes: number;
  phase: 'question' | 'feedback' | 'finished';
  selected: string | null;
  correct: boolean | null;
}
let sequence = 0;
export function newSession(bank: QuestionBank, optionsOrMode: GameOptions | Mode, random?: Random): Session {
  const options = Object.freeze({ ...(typeof optionsOrMode === 'string' ? defaultOptions(optionsOrMode) : optionsOrMode) }) as GameOptions;
  const mode = options.mode;
  const deck = makeDeck(bank, options, random);
  return { id: `${Date.now()}-${++sequence}`, mode, options, bestKey: bestKey(options), boardKey: boardFor(options), bankVersion: bank.version, rulesVersion: RULES_VERSION, deck, index: 0, score: 0, mistakes: 0, phase: deck.length ? 'question' : 'finished', selected: null, correct: null };
}
export function answer(session: Session, questionId: string, choice: string): boolean {
  const q = session.deck[session.index];
  if (session.phase !== 'question' || !q || q.id !== questionId || !q.choices.includes(choice)) return false;
  session.selected = choice;
  session.correct = choice === q.id;
  session.score += session.correct ? 1 : 0;
  session.mistakes += session.correct ? 0 : 1;
  session.phase = 'feedback';
  return true;
}
export function advance(session: Session): boolean {
  if (session.phase !== 'feedback') return false;
  if (session.mistakes >= config.maxMistakes || session.index + 1 >= session.deck.length) {
    session.phase = 'finished';
  } else {
    session.index++;
    session.selected = null;
    session.correct = null;
    session.phase = 'question';
  }
  return true;
}
