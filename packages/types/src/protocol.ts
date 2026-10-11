/** The WebSocket protocol of an online room. The page asks for it and sends its token as a second protocol, because a browser cannot set headers on a WebSocket. */
export const SOCKET_PROTOCOL = 'go-game';

/** Where an online room is in its life. */
export const RoomStatus = { OPEN: 1, PLAYING: 2, FINISHED: 4 } as const;
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

/** What a page says to a room. */
export const ClientMessageType = { MOVE: 1, RESIGN: 2 } as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

/** What a room says to a page. */
export const ServerMessageType = { ROOM: 1, ERROR: 2 } as const;
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType];
