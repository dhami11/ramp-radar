import { useEffect, useRef, useState } from 'react';

/** Subscribes to one server-sent event type; returns whether the stream is connected. */
export function useEventSource<T>(url: string, event: string, onMessage: (data: T) => void): boolean {
  const handler = useRef(onMessage);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    const source = new EventSource(url);
    const listener = (message: MessageEvent<string>) => handler.current(JSON.parse(message.data) as T);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener(event, listener);
    return () => source.close();
  }, [url, event]);

  return connected;
}
