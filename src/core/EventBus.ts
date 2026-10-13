/** Typovaný pub/sub. `Events` mapuje názov eventu na typ jeho payloadu. */
export class EventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (payload: never) => void);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.handlers.get(event)?.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (set === undefined) return;
    for (const h of [...set]) (h as (payload: Events[K]) => void)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
