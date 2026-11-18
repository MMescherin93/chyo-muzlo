/**
 * GameEngine — чистый игровой движок без транспорта (не знает ни про Socket.io,
 * ни про Firebase). Выполняется на устройстве ХОСТА (авторитетное состояние),
 * а все изменения комнаты хост транслирует гостям через `emit`.
 *
 * Таймеры держит хост (см. host-app): движок только продвигает фазы по вызову:
 *   start() ──(таймер 15–30с)──► openVoting() ──(таймер 15с)──► reveal()
 *   ──(таймер 15с)──► nextRound() ──► ...
 */

import type { Player, Room, RoundState, RoomPhase, SubmittedTrack } from './types';
import { calculateRound } from './scoring';
import { generateComment, type CommentContext } from './comments';
import { parseShareInput, type ParsedLink } from './links';

/** Портативный случайный id (работает в Node, браузере и React Native/Hermes). */
export function newId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Случайный 4-значный код комнаты. */
function makeCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const AVATARS = ['🎧', '🤘', '🎤', '🕺', '💃', '🔥', '👽', '🤖'];

export interface GameEvents {
  /** Снапшот комнаты изменился — хост шлёт гостям. */
  onState(room: Room): void;
  /** Начался раунд: хост должен загрузить трек в WebView и запустить таймер. */
  onRoundStart(round: RoundState): void;
  /** Открыто голосование. */
  onVoteOpen(round: RoundState): void;
  /** Итог раунда готов. */
  onReveal(round: RoundState): void;
  /** Партия завершена. */
  onFinish(room: Room): void;
}

export class GameEngine {
  private room!: Room;
  private events: GameEvents;

  constructor(events: GameEvents) {
    this.events = events;
  }

  get state(): Room {
    return this.room;
  }

  /** Хост создаёт комнату. */
  createRoom(hostNickname: string, durationMinutes: number): Room {
    const host: Player = {
      id: newId(),
      nickname: hostNickname,
      isHost: true,
      score: 0,
      avatar: '👑',
    };
    this.room = {
      code: makeCode(),
      hostId: host.id,
      phase: 'lobby',
      players: [host],
      tracks: [],
      rounds: [],
      currentRound: -1,
      durationMinutes,
      createdAt: Date.now(),
    };
    this.emit();
    return this.room;
  }

  /** Гость подключается. Возвращает его id. Идемпотентно по id. */
  join(nickname: string, id?: string): string {
    if (id) {
      const existing = this.room.players.find((p) => p.id === id);
      if (existing) {
        if (existing.nickname !== nickname) {
          existing.nickname = nickname;
          this.emit();
        }
        return id;
      }
    }
    const playerId = id ?? newId();
    const player: Player = {
      id: playerId,
      nickname,
      isHost: false,
      score: 0,
      avatar: AVATARS[this.room.players.length % AVATARS.length],
    };
    this.room.players.push(player);
    this.emit();
    return playerId;
  }

  /**
   * Игрок отправляет ссылку на трек. Возвращает false, если это не ссылка
   * на трек (плейлисты/альбомы в MVP не принимаем).
   */
  submitTrack(playerId: string, shareText: string): boolean {
    const input = parseShareInput(shareText);
    if (!input) return false;

    const parsed: ParsedLink = { type: 'track', trackId: extractTrackId(input.url) };
    const submitted: SubmittedTrack = {
      id: newId(),
      trackId: parsed.trackId,
      albumId: parsed.albumId,
      url: input.url,
      title: input.title,
      artist: input.artist,
      submittedBy: playerId,
    };
    this.room.tracks.push(submitted);
    this.emit();
    return true;
  }

  /** Хост запускает партию (отбирает треки по длительности и начинает раунд). */
  start(): void {
    if (this.room.phase === 'finished') return;
    const target = Math.round(this.room.durationMinutes);
    this.room.tracks = shuffle(this.room.tracks).slice(0, target);
    this.room.currentRound = 0;
    this.startRound();
  }

  private startRound(): void {
    const track = this.room.tracks[this.room.currentRound];
    if (!track) {
      this.finish();
      return;
    }

    // Все отправители этого же трека = авторы (дубликаты ссылок).
    const authorIds = this.room.tracks
      .filter((t) => t.trackId === track.trackId)
      .map((t) => t.submittedBy);

    const round: RoundState = {
      index: this.room.currentRound,
      track,
      authorIds,
      votes: {},
    };
    this.room.rounds.push(round);
    this.room.phase = 'playing';

    this.events.onRoundStart(round);
    this.emit();
  }

  /** Хост вызывает по истечении таймера прослушивания. */
  openVoting(): void {
    if (this.room.phase === 'finished') return;
    this.room.phase = 'voting';
    const round = this.currentRoundState();
    if (!round) return;
    this.events.onVoteOpen(round);
    this.emit();
  }

  /** Голосовать можно во время прослушивания и в фазе голосования. */
  castVote(playerId: string, votedForId: string): void {
    const round = this.currentRoundState();
    if (!round) return;
    if (this.room.phase !== 'playing' && this.room.phase !== 'voting') return;
    round.votes[playerId] = votedForId;
    this.emit();
  }

  /** Хост вызывает по истечении таймера голосования. */
  reveal(): void {
    if (this.room.phase === 'finished') return;
    const round = this.currentRoundState();
    if (!round) return;

    this.room.phase = 'reveal';
    const playerIds = this.room.players.map((p) => p.id);
    const votes: Record<string, string | null> = {};
    for (const p of playerIds) votes[p] = round.votes[p] ?? null;

    const { scores, breakdown } = calculateRound({
      authors: round.authorIds,
      votes,
      players: playerIds,
    });

    for (const p of this.room.players) p.score += scores[p.id] ?? 0;

    const nameOf = (id: string) =>
      this.room.players.find((p) => p.id === id)?.nickname ?? '?';

    const ctx: CommentContext = {
      trackTitle: round.track.title ?? 'этот трек',
      artist: round.track.artist ?? 'неизвестный исполнитель',
      authorNames: round.authorIds.map(nameOf),
      nonAuthorCorrectNames: breakdown.nonAuthorCorrect.map(nameOf),
      correctGuesserNames: breakdown.correctGuessers.map(nameOf),
      totalPlayers: this.room.players.length,
      votesForAuthor: breakdown.correctGuessers.length,
    };

    round.reveal = { comment: generateComment(ctx), scores };
    this.events.onReveal(round);
    this.emit();
  }

  /** Хост вызывает по истечении таймера показа итогов. */
  nextRound(): void {
    if (this.room.phase === 'finished') return;
    this.room.currentRound += 1;
    this.startRound();
  }

  /** Хост завершает сессию для всех: финальный экран у всех игроков. */
  endGame(): void {
    if (this.room.phase === 'finished') return;
    this.finish();
  }

  private finish(): void {
    this.room.phase = 'finished';
    this.events.onFinish(this.room);
    this.emit();
  }

  private currentRoundState(): RoundState | undefined {
    return this.room.rounds[this.room.currentRound];
  }

  private emit(): void {
    this.events.onState(this.room);
  }
}

/** Достаёт trackId из уже распарсенной ссылки (совместимость с parseShareInput). */
function extractTrackId(url: string): string {
  const m = url.match(/\/track\/(\d+)/);
  if (m) return m[1];
  throw new Error('Не удалось извлечь trackId из ссылки: ' + url);
}

/** Итоговая таблица (по убыванию очков) — для экрана финала. */
export function finalStandings(room: Room) {
  return room.players
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }));
}
