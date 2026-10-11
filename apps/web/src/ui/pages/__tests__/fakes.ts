import type { Session, User } from '../../../firebase/auth.ts';
import type { GameRecord, Match } from '@go-game/core/ports.ts';
import type { GameSync, Room } from '@go-game/client/rooms.ts';
import type { Leaderboard, PlayedGame, Player, RankedPlayer } from '@go-game/client/leaderboard.ts';
import type { Firebase } from '../../../firebase/services.ts';
import type { Skins } from '@go-game/presentation/skins/SkinManager.ts';
import { DEFAULT_SKIN } from '@go-game/presentation/skins/SkinRegistry.ts';
import type { AppContext } from '../../context.ts';
import { RoomStatus } from '@go-game/types/protocol.ts';

export class FakeSession implements Session {
  public user: User | null = null;
  public claimed: string[] = [];
  public linked: { email: string; password: string }[] = [];
  public signedInWith: { email: string; password: string }[] = [];
  public guestSignIns = 0;
  public signOuts = 0;
  public deletions = 0;
  public failWith: string | null = null;
  private _listeners = new Set<(user: User | null) => void>();

  onUser(listener: (user: User | null) => void): () => void {
    this._listeners.add(listener);
    listener(this.user);
    return () => this._listeners.delete(listener);
  }
  async signInAsGuest(): Promise<void> {
    this._fail();
    this.guestSignIns++;
    this.emit(this.user ?? { uid: 'guest-1', nickname: null, isGuest: true, email: null });
  }
  async claimNickname(nickname: string): Promise<void> {
    this._fail();
    this.claimed.push(nickname);
    this.emit({ ...this.user!, nickname });
  }
  async linkEmail(email: string, password: string): Promise<void> {
    this._fail();
    this.linked.push({ email, password });
    this.emit({ ...this.user!, isGuest: false, email });
  }
  async signInWithEmail(email: string, password: string): Promise<void> {
    this._fail();
    this.signedInWith.push({ email, password });
    this.emit({ uid: 'linked-1', nickname: 'Alice', isGuest: false, email });
  }
  async signOut(): Promise<void> {
    this.signOuts++;
    this.emit(null);
  }
  async deleteEntry(): Promise<void> {
    this._fail();
    this.deletions++;
    this.emit(null);
  }
  emit(user: User | null): void {
    this.user = user;
    for (const listener of this._listeners) listener(user);
  }
  reportErrorsTo(): void {}
  private _fail(): void {
    if (this.failWith !== null) throw new Error(this.failWith);
  }
}

export class FakeLeaderboard implements Leaderboard {
  public top: RankedPlayer[] = [];
  public players = new Map<string, Player>();
  public games: PlayedGame[] = [];
  public records: GameRecord[] = [];
  public topListener: ((players: readonly RankedPlayer[]) => void) | null = null;
  public unsubscribed = 0;

  followTop(onTop: (players: readonly RankedPlayer[]) => void): () => void {
    this.topListener = onTop;
    onTop(this.top);
    return () => this.unsubscribed++;
  }
  followPlayer(uid: string, onPlayer: (player: Player | null) => void): () => void {
    onPlayer(this.players.get(uid) ?? null);
    return () => this.unsubscribed++;
  }
  async history(): Promise<PlayedGame[]> {
    return this.games;
  }
  record(game: GameRecord): void {
    this.records.push(game);
  }
  reportErrorsTo(): void {}
}

/** Rooms live in `rooms`; the page sees them through `followOpenRooms`. `failWith` makes every call fail with that message. */
export class FakeGameSync implements GameSync {
  public rooms: Room[] = [];
  public joined: string[] = [];
  public closed: string[] = [];
  public failWith: string | null = null;
  private _roomListeners = new Set<(rooms: readonly Room[]) => void>();
  private _hostedListeners = new Map<string, (room: Room | null) => void>();

  async createRoom(user: User): Promise<string> {
    this._fail();
    const room = openRoom(`room-${this.rooms.length + 1}`, user.uid, user.nickname ?? 'Guest');
    this.rooms.push(room);
    this.emitRooms();
    return room.id;
  }
  async joinRoom(roomId: string): Promise<void> {
    this._fail();
    this.joined.push(roomId);
  }
  followOpenRooms(onRooms: (rooms: readonly Room[]) => void): () => void {
    this._roomListeners.add(onRooms);
    onRooms(this.rooms);
    return () => this._roomListeners.delete(onRooms);
  }
  followRoom(roomId: string, onRoom: (room: Room | null) => void): () => void {
    this._hostedListeners.set(roomId, onRoom);
    return () => this._hostedListeners.delete(roomId);
  }
  openMatch(): Promise<Match> {
    return Promise.reject(new Error('Not used in this test'));
  }
  async closeRoom(roomId: string): Promise<void> {
    this._fail();
    this.closed.push(roomId);
    this.rooms = this.rooms.filter((room) => room.id !== roomId);
    this.emitRooms();
  }
  /** A guest has joined the hosted room, so it starts playing. */
  guestJoins(roomId: string): void {
    const room = this.rooms.find((candidate) => candidate.id === roomId);
    this._hostedListeners.get(roomId)?.(room === undefined ? null : { ...room, status: RoomStatus.PLAYING });
  }
  emitRooms(): void {
    for (const listener of this._roomListeners) listener(this.rooms);
  }
  private _fail(): void {
    if (this.failWith !== null) throw new Error(this.failWith);
  }
}

export function openRoom(id: string, host: string, hostName: string): Room {
  return {
    id,
    host,
    hostName,
    guest: null,
    guestName: null,
    status: RoomStatus.OPEN,
    createdAt: 1,
    moves: [],
    resignedBy: null,
    timedOutBy: null,
    turnStartedAt: 1,
  };
}

export interface FakeContext extends AppContext {
  session: FakeSession;
  leaderboard: FakeLeaderboard;
  sync: FakeGameSync;
  visited: string[];
}

/** The pages under test never touch the board, so one fixed skin is enough. */
const classicOnly: Skins = {
  current: DEFAULT_SKIN,
  select: () => undefined,
  onChange: () => () => undefined,
  textures: () => Promise.resolve(null),
};

/** A context for a site with accounts, a leaderboard and online play, all faked. */
export function fakeContext(): FakeContext {
  const fakes = { session: new FakeSession(), leaderboard: new FakeLeaderboard(), sync: new FakeGameSync() };
  return contextWith(fakes, fakes);
}

/** A context for a site without Firebase: no accounts, so `firebase` is null. The fakes are still there for the assertions. */
export function fakeContextWithoutFirebase(): FakeContext {
  return contextWith(
    { session: new FakeSession(), leaderboard: new FakeLeaderboard(), sync: new FakeGameSync() },
    null,
  );
}

interface Fakes {
  session: FakeSession;
  leaderboard: FakeLeaderboard;
  sync: FakeGameSync;
}

function contextWith(fakes: Fakes, firebase: Firebase | null): FakeContext {
  const visited: string[] = [];
  const context: FakeContext = {
    ...fakes,
    firebase,
    user: null,
    skins: classicOnly,
    navigate: (path) => visited.push(path),
    visited,
  };
  fakes.session.onUser((user) => (context.user = user));
  return context;
}

export function button(root: ParentNode, name: string): HTMLButtonElement {
  return root.querySelector(`[data-ref="${name}"]`) as HTMLButtonElement;
}

export function input(root: ParentNode, name: string): HTMLInputElement {
  return root.querySelector(`[data-ref="${name}"]`) as HTMLInputElement;
}

export function text(root: ParentNode, name: string): string {
  return root.querySelector(`[data-ref="${name}"]`)?.textContent?.trim() ?? '';
}
