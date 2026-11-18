/**
 * Синхронизация через публичные MQTT-брокеры (без аккаунтов и ключей).
 *
 * Устойчивость: ХОСТ подключается ко всем брокерам сразу и транслирует
 * состояние во все; ГОСТЬ подключается к первому доступному. Так игроки
 * встречаются, даже если у кого-то один брокер недоступен.
 *
 * Топики (на комнату {code}):
 *   muzlo/{code}/state  — снимок комнаты (retained)
 *   muzlo/{code}/join   — { playerId, nickname }
 *   muzlo/{code}/track  — { playerId, clientTrackId, text }
 *   muzlo/{code}/vote   — { playerId, votedForId }
 */

import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import { GameEngine, newId, pickExcerptLengthSeconds, type Room } from '@muzlo/shared';
import { toRoomView, type RoomView } from './room-view';

export const BROKERS = [
  'wss://test.mosquitto.org:8081',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const VOTE_MS = 15_000;
const REVEAL_MS = 15_000;
const CONNECT_TIMEOUT_MS = 6_000;

const topic = (code: string, suffix: string) => `muzlo/${code}/${suffix}`;

export function getOrCreateUid(): string {
  let uid = localStorage.getItem('muzlo_uid');
  if (!uid) {
    uid = newId();
    localStorage.setItem('muzlo_uid', uid);
  }
  return uid;
}

function connectOne(url: string): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, {
      clientId: 'muzlo-' + Math.random().toString(16).slice(2),
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: CONNECT_TIMEOUT_MS,
      keepalive: 30,
    });
    const timer = setTimeout(() => {
      try { client.end(true); } catch { /* ignore */ }
      reject(new Error('timeout ' + url));
    }, CONNECT_TIMEOUT_MS + 1000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('error', (e) => {
      clearTimeout(timer);
      try { client.end(true); } catch { /* ignore */ }
      reject(e);
    });
  });
}

/** Подключается к ПЕРВОМУ доступному брокеру (для гостя). */
async function connectFirst(urls: string[]): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pending = urls.length;
    for (const url of urls) {
      connectOne(url)
        .then((client) => {
          if (settled) {
            try { client.end(true); } catch { /* ignore */ }
            return;
          }
          settled = true;
          resolve(client);
        })
        .catch(() => {
          pending -= 1;
          if (pending === 0 && !settled) {
            reject(new Error('Нет доступных MQTT-брокеров'));
          }
        });
    }
  });
}

/** Подключается ко ВСЕМ доступным брокерам (для хоста). */
async function connectAll(urls: string[]): Promise<MqttClient[]> {
  const results = await Promise.allSettled(urls.map((u) => connectOne(u)));
  const clients: MqttClient[] = [];
  for (const r of results) if (r.status === 'fulfilled') clients.push(r.value);
  if (clients.length === 0) throw new Error('Нет доступных MQTT-брокеров');
  return clients;
}

function publishJSON(client: MqttClient, t: string, obj: unknown, retain = false) {
  client.publish(t, JSON.stringify(obj), { qos: 1, retain });
}

// ---------------------------------------------------------------------------
// Хост
// ---------------------------------------------------------------------------

export class HostController {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private processedTracks = new Set<string>();
  private codeValue = '';

  constructor(
    private engine: GameEngine,
    private clients: MqttClient[],
    code: string,
    timers: ReturnType<typeof setTimeout>[],
  ) {
    this.codeValue = code;
    this.timers = timers;
    this.subscribeIntents();
    this.publishState();
  }

  static async create(
    nickname: string,
    durationMinutes: number,
    onView: (v: RoomView) => void,
  ): Promise<HostController> {
    let clients: MqttClient[] | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const engine = new GameEngine({
      onState: (room: Room) => {
        onView(toRoomView(room));
        if (clients) {
          for (const c of clients) publishJSON(c, topic(room.code, 'state'), toRoomView(room), true);
        }
      },
      onRoundStart: () => {
        timers.push(setTimeout(() => engine.openVoting(), pickExcerptLengthSeconds() * 1000));
      },
      onVoteOpen: () => {
        timers.push(setTimeout(() => engine.reveal(), VOTE_MS));
      },
      onReveal: () => {
        timers.push(setTimeout(() => engine.nextRound(), REVEAL_MS));
      },
      onFinish: () => {
        /* финальный state уходит через onState */
      },
    });

    const room = engine.createRoom(nickname, durationMinutes);
    clients = await connectAll(BROKERS);
    return new HostController(engine, clients, room.code, timers);
  }

  private publishState() {
    const view = toRoomView(this.engine.state);
    for (const c of this.clients) publishJSON(c, topic(this.codeValue, 'state'), view, true);
  }

  private subscribeIntents() {
    const p = `muzlo/${this.codeValue}`;
    for (const c of this.clients) {
      c.subscribe([`${p}/join`, `${p}/track`, `${p}/vote`], { qos: 1 }, (err) => {
        if (err) console.error('subscribe error', err);
      });
      c.on('message', (t, payload) => this.onIntent(t, payload));
    }
  }

  private onIntent(t: string, payload: Uint8Array) {
    try {
      const msg = JSON.parse(payload.toString());
      const p = `muzlo/${this.codeValue}`;
      if (t === `${p}/join`) {
        this.engine.join(msg.nickname, msg.playerId);
      } else if (t === `${p}/track`) {
        if (this.processedTracks.has(msg.clientTrackId)) return;
        this.processedTracks.add(msg.clientTrackId);
        this.engine.submitTrack(msg.playerId, msg.text);
      } else if (t === `${p}/vote`) {
        this.engine.castVote(msg.playerId, msg.votedForId);
      }
    } catch {
      /* битые сообщения игнорируем */
    }
  }

  start() {
    this.engine.start();
  }

  /** Голос самого хоста (он тоже игрок). */
  castVote(votedForId: string) {
    this.engine.castVote(this.engine.state.hostId, votedForId);
  }

  /** Хост добавляет трек (он тоже игрок). Возвращает false, если ссылка не подошла. */
  submitTrack(text: string): boolean {
    return this.engine.submitTrack(this.engine.state.hostId, text);
  }

  /** Хост завершает сессию для всех — у всех финальный экран. */
  endGame() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.engine.endGame();
  }

  destroy() {
    this.timers.forEach(clearTimeout);
    for (const c of this.clients) {
      try { c.end(true); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Гость
// ---------------------------------------------------------------------------

export class GuestSync {
  readonly uid = getOrCreateUid();
  private codeValue: string;

  constructor(private client: MqttClient, code: string) {
    this.codeValue = code;
  }

  static async create(code: string, onState: (v: RoomView) => void): Promise<GuestSync> {
    const client = await connectFirst(BROKERS);
    const g = new GuestSync(client, code);
    client.on('message', (t, payload) => {
      if (t === topic(code, 'state')) {
        try { onState(JSON.parse(payload.toString()) as RoomView); } catch { /* ignore */ }
      }
    });
    client.subscribe(topic(code, 'state'), { qos: 1 });
    return g;
  }

  join(nickname: string) {
    publishJSON(this.client, topic(this.codeValue, 'join'), { playerId: this.uid, nickname });
  }

  submitTrack(text: string) {
    publishJSON(this.client, topic(this.codeValue, 'track'), {
      playerId: this.uid,
      clientTrackId: newId(),
      text,
    });
  }

  castVote(votedForId: string) {
    publishJSON(this.client, topic(this.codeValue, 'vote'), {
      playerId: this.uid,
      votedForId,
    });
  }

  destroy() {
    try { this.client.end(true); } catch { /* ignore */ }
  }
}
