import Phaser from 'phaser';
import { AUDIO, type AudioKey } from '@/assets/manifest';
import { session } from '@/state/session';

/** Hudba scény v slučke; hlasitosť sleduje nastavenia, pri vypnutí scény sa zastaví. */
export function playMusic(scene: Phaser.Scene, key: AudioKey): void {
  scene.sound.mute = session.settings.muted;
  if (!scene.cache.audio.exists(key)) return;
  const base = AUDIO[key].volume;
  const music = scene.sound.add(key, { loop: true, volume: base * session.settings.musicVolume });
  music.play();
  const off = session.ui.on('settingsChanged', (s) => {
    music.setVolume(base * s.musicVolume);
    scene.sound.mute = s.muted;
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    off();
    music.destroy();
  });
}

export function toggleMute(): void {
  session.updateSettings({ muted: !session.settings.muted });
}
