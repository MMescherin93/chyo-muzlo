/**
 * Синхронизация через локальный WebSocket-релей (server/index.mjs).
 *
 * Хост — авторитет: держит GameEngine и рассылает снимок состояния.
 * Гости шлют «намерения» (join / track / vote). Всё внутри одной Wi-Fi сети.
 */

import { GameEngine, newId, type Room } from '@muzlo/shared';
import { toRoomView, type RoomView } from './room-view';

export function getOrCreateUid(): string {
  let uid = sessionStorage.getItem('muzlo_uid');
  if (!uid) {
    uid = newId();
    sessionStorage.setItem('muzlo_uid', uid);
  }
  return uid;
}

function socketUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function openSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(socketUrl());
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Не удалось подключиться к комнате'));
    }, 8000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Ошибка соединения с комнатой'));
    };
  });
}

// ---------------------------------------------------------------------------
// Хост
// ---------------------------------------------------------------------------

export class HostController {
  private processedTracks = new Set<string>();
  private codeValue = '';

  constructor(
    private engine: GameEngine,
    private ws: WebSocket,
    code: string,
  ) {
    this.codeValue = code;
    this.ws.onmessage = (ev: MessageEvent) => this.onMessage(ev);
  }

  static async create(
    durationMinutes: number,
    onView: (v: RoomView) => void,
  ): Promise<HostController> {
    let ws: WebSocket | null = null;

    const engine = new GameEngine({
      onState: (room: Room) => {
        onView(toRoomView(room));
        if (ws) {
          ws.send(JSON.stringify({ t: 'state', room: room.code, data: toRoomView(room) }));
        }
      },
      onRoundStart: () => {
        /* раунды переключает хост кнопками */
      },
      onVoteOpen: () => {
        /* результат показывает хост кнопкой */
      },
      onReveal: () => {
        /* следующий трек запускает хост кнопкой */
      },
      onFinish: () => {
        /* финальный state уходит через onState */
      },
    });

    const room = engine.createRoom(durationMinutes);
    ws = await openSocket();
    ws.send(JSON.stringify({ t: 'host', room: room.code }));

    const controller = new HostController(engine, ws, room.code);
    // Сразу публикуем состояние (на случай, если гость подключится раньше).
    ws.send(JSON.stringify({ t: 'state', room: room.code, data: toRoomView(room) }));
    return controller;
  }

  private onMessage(ev: MessageEvent) {
    let msg: { t?: string; data?: any };
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
    } catch {
      return;
    }
    if (msg.t !== 'intent' || !msg.data) return;
    const d = msg.data;

    if (d.kind === 'join') {
      this.engine.join(d.nickname, d.playerId);
    } else if (d.kind === 'track') {
      if (this.processedTracks.has(d.clientTrackId)) return;
      this.processedTracks.add(d.clientTrackId);
      this.engine.submitTrack(d.playerId, d.text);
    } else if (d.kind === 'vote') {
      this.engine.castVote(d.playerId, d.votedForId);
    }
  }

  start() {
    this.engine.start();
  }

  /** Хост меняет длительность партии до старта. */
  setDuration(minutes: number) {
    this.engine.setDuration(minutes);
  }

  /** Хост: показать результат голосования. */
  revealNow() {
    this.engine.reveal();
  }

  /** Хост: следующий трек (или финал, если треки кончились). */
  nextRound() {
    this.engine.nextRound();
  }

  /** Хост завершает сессию для всех. */
  endGame() {
    this.engine.endGame();
  }

  destroy() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Гость
// ---------------------------------------------------------------------------

export class GuestSync {
  readonly uid = getOrCreateUid();
  private codeValue: string;

  constructor(private ws: WebSocket, code: string) {
    this.codeValue = code;
  }

  static async create(
    code: string,
    onState: (v: RoomView) => void,
    onHostGone?: () => void,
  ): Promise<GuestSync> {
    const ws = await openSocket();
    const g = new GuestSync(ws, code);
    ws.onmessage = (ev: MessageEvent) => {
      let msg: { t?: string; data?: RoomView };
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      if (msg.t === 'state' && msg.data) onState(msg.data);
      else if (msg.t === 'host-gone') onHostGone?.();
    };
    ws.send(JSON.stringify({ t: 'guest', room: code }));
    return g;
  }

  private intent(data: unknown) {
    this.ws.send(JSON.stringify({ t: 'intent', data }));
  }

  join(nickname: string) {
    this.intent({ kind: 'join', playerId: this.uid, nickname });
  }

  submitTrack(text: string) {
    this.intent({ kind: 'track', playerId: this.uid, clientTrackId: newId(), text });
  }

  castVote(votedForId: string) {
    this.intent({ kind: 'vote', playerId: this.uid, votedForId });
  }

  destroy() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}
