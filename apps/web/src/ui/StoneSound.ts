import type { SoundPlayer } from '@go-game/core/ports.ts';
import type { SkinSelection } from '@go-game/presentation/skins/SkinManager.ts';
import type { SkinConfig } from '@go-game/presentation/skins/SkinTypes.ts';

const START_HZ = 320;
const END_HZ = 120;
const DURATION_S = 0.08;
const VOLUME = 0.3;
const SAMPLE_VOLUME = 0.6;
/** The volume fades down to this value instead of zero. An exponential fade can never reach zero. */
const SILENCE = 0.01;

/** Plays the recorded sound of the skin when it has one. Otherwise it plays a short tone made in code. */
export class StoneSound implements SoundPlayer {
  private _context: AudioContext | null = null;
  private _sample: AudioBuffer | null = null;
  /** The sound file of the selected skin, or null when it has none. */
  private _wanted: string | null = null;
  private readonly _samples = new Map<string, Promise<AudioBuffer | null>>();
  private readonly _stopFollowingSkin: () => void;

  constructor(skins: SkinSelection) {
    void this._useSkin(skins.current);
    this._stopFollowingSkin = skins.onChange((skin) => void this._useSkin(skin));
  }

  public play(): void {
    const context = this._contextForPlayback();
    if (context === null) return;
    if (this._sample !== null) this._playSample(context, this._sample);
    else this._playTone(context);
  }

  public dispose(): void {
    this._stopFollowingSkin();
  }

  private async _useSkin(skin: SkinConfig): Promise<void> {
    const url = skin.sound ?? null;
    this._wanted = url;
    this._sample = null;
    if (url === null) return;
    const sample = await this._load(url);
    // The player may have selected another skin while the sound was loading.
    if (this._wanted === url) this._sample = sample;
  }

  /** Each sound file is downloaded and decoded one time. When the load fails, the tone is played instead. */
  private _load(url: string): Promise<AudioBuffer | null> {
    let loading = this._samples.get(url);
    if (loading === undefined) {
      loading = this._fetchAndDecode(url).catch(() => null);
      this._samples.set(url, loading);
    }
    return loading;
  }

  private async _fetchAndDecode(url: string): Promise<AudioBuffer | null> {
    if (typeof AudioContext === 'undefined') return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    this._context ??= new AudioContext();
    return this._context.decodeAudioData(bytes);
  }

  private _playSample(context: AudioContext, sample: AudioBuffer): void {
    const source = context.createBufferSource();
    source.buffer = sample;
    const gain = context.createGain();
    gain.gain.value = SAMPLE_VOLUME;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  }

  private _playTone(context: AudioContext): void {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(START_HZ, now);
    oscillator.frequency.exponentialRampToValueAtTime(END_HZ, now + DURATION_S);

    const gain = context.createGain();
    gain.gain.setValueAtTime(VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(SILENCE, now + DURATION_S);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + DURATION_S);
  }

  /** Browsers allow sound only after a click or a tap. When the audio is paused, we try to resume it. If that does not work, nothing breaks. */
  private _contextForPlayback(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    this._context ??= new AudioContext();
    if (this._context.state === 'suspended') void this._context.resume().catch(() => undefined);
    return this._context;
  }
}
