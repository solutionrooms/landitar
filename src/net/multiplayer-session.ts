import Peer, { type DataConnection, type MediaConnection } from 'peerjs';

export type ConnectionState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'lost';

export interface RemoteState {
  score: number;
  lives: number;
  fuel: number;
  gameOver: boolean;
  finalScore: number;
}

export interface RemoteShipState {
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  shielded: boolean;
  thrusting: boolean;
  bullets: { x: number; y: number }[];
  scene: string;
}

export interface PeerMessage {
  type: 'seed' | 'settings' | 'score-update' | 'game-over' | 'game-start' | 'ship-state' | 'ship-hit';
  payload: any;
}

export class MultiplayerSession {
  isMultiplayer = false;
  isHost = false;
  connectionState: ConnectionState = 'idle';
  sharedSeed = 0;
  peerId = '';

  // Remote player state
  remote: RemoteState = { score: 0, lives: 0, fuel: 0, gameOver: false, finalScore: 0 };
  remoteShip: RemoteShipState = { x: 0, y: 0, angle: 0, alive: false, shielded: false, thrusting: false, bullets: [], scene: '' };

  // Video streams
  remoteStream: MediaStream | null = null;
  remoteVideo: HTMLVideoElement | null = null;

  // Internal
  private lastShipBroadcast = 0;
  private peer: Peer | null = null;
  private dataConn: DataConnection | null = null;
  private mediaConn: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private messageHandlers: ((msg: PeerMessage) => void)[] = [];
  private lastBroadcast = 0;

  onMessage(handler: (msg: PeerMessage) => void) {
    this.messageHandlers.push(handler);
  }

  sendMessage(msg: PeerMessage) {
    if (this.dataConn?.open) {
      this.dataConn.send(msg);
    }
  }

  /** Broadcast score state, throttled to ~2Hz */
  maybeBroadcastState(state: { score: number; lives: number; fuel: number }) {
    const now = Date.now();
    if (now - this.lastBroadcast < 500) return;
    this.lastBroadcast = now;
    this.sendMessage({ type: 'score-update', payload: state });
  }

  /** Broadcast ship position/state at ~12Hz */
  broadcastShipState(ship: { pos: { x: number; y: number }; vel: { x: number; y: number }; angle: number; alive: boolean; shielded: boolean; thrusting: boolean; bullets: { pos: { x: number; y: number } }[] }, scene: string) {
    const now = Date.now();
    if (now - this.lastShipBroadcast < 80) return;
    this.lastShipBroadcast = now;
    this.sendMessage({
      type: 'ship-state',
      payload: {
        x: ship.pos.x, y: ship.pos.y,
        angle: ship.angle,
        alive: ship.alive,
        shielded: ship.shielded,
        thrusting: ship.thrusting,
        bullets: ship.bullets.map(b => ({ x: b.pos.x, y: b.pos.y })),
        scene,
      } as RemoteShipState,
    });
  }

  /** Host: create peer and wait for guest */
  hostGame(canvas: HTMLCanvasElement): Promise<string> {
    this.isMultiplayer = true;
    this.isHost = true;
    this.connectionState = 'waiting';

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.peerId = id;
        resolve(id);
      });

      this.peer.on('error', (err) => {
        this.connectionState = 'lost';
        reject(err);
      });

      // Wait for guest data connection
      this.peer.on('connection', (conn) => {
        this.dataConn = conn;
        this.setupDataConn();
      });

      // Wait for guest media call
      this.peer.on('call', (call) => {
        this.localStream = canvas.captureStream(15);
        call.answer(this.localStream);
        this.mediaConn = call;
        call.on('stream', (stream) => {
          this.setRemoteStream(stream);
        });
      });
    });
  }

  /** Guest: connect to host */
  joinGame(hostPeerId: string, canvas: HTMLCanvasElement): Promise<void> {
    this.isMultiplayer = true;
    this.isHost = false;
    this.connectionState = 'connecting';

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        this.peerId = this.peer!.id;

        // Data connection
        this.dataConn = this.peer!.connect(hostPeerId, { reliable: true });
        this.setupDataConn();

        this.dataConn.on('open', () => {
          // Media call
          this.localStream = canvas.captureStream(15);
          this.mediaConn = this.peer!.call(hostPeerId, this.localStream);

          this.mediaConn.on('stream', (stream) => {
            this.setRemoteStream(stream);
          });

          this.connectionState = 'connected';
          resolve();
        });

        this.dataConn.on('error', (err) => {
          this.connectionState = 'lost';
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        this.connectionState = 'lost';
        reject(err);
      });
    });
  }

  private setupDataConn() {
    if (!this.dataConn) return;

    this.dataConn.on('open', () => {
      this.connectionState = 'connected';
    });

    this.dataConn.on('data', (data: unknown) => {
      const msg = data as PeerMessage;
      // Handle score updates internally
      if (msg.type === 'score-update') {
        Object.assign(this.remote, msg.payload);
      } else if (msg.type === 'ship-state') {
        Object.assign(this.remoteShip, msg.payload);
      } else if (msg.type === 'game-over') {
        this.remote.gameOver = true;
        this.remote.finalScore = msg.payload.finalScore;
      }
      for (const h of this.messageHandlers) h(msg);
    });

    this.dataConn.on('close', () => {
      this.connectionState = 'lost';
    });
  }

  private setRemoteStream(stream: MediaStream) {
    this.remoteStream = stream;
    this.remoteVideo = document.createElement('video');
    this.remoteVideo.srcObject = stream;
    this.remoteVideo.autoplay = true;
    this.remoteVideo.muted = true;
    this.remoteVideo.playsInline = true;
    this.remoteVideo.play().catch(() => {});
  }

  destroy() {
    this.dataConn?.close();
    this.mediaConn?.close();
    this.peer?.destroy();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peer = null;
    this.dataConn = null;
    this.mediaConn = null;
    this.localStream = null;
    this.remoteStream = null;
    this.remoteVideo = null;
    this.isMultiplayer = false;
    this.connectionState = 'idle';
  }
}
