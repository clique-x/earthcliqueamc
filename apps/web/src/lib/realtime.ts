"use client";

import type { ServerEvent } from "@amc/shared";
import { useEffect, useRef } from "react";
import { API_URL, type Audience } from "./api";

/**
 * Keeps a WebSocket open to the API (cookie-authenticated) and calls onEvent for every server event.
 * Reconnects with backoff and re-subscribes to the given ticket channels.
 */
export function useRealtime(audience: Audience, onEvent: (event: ServerEvent) => void, ticketIds: string[] = []) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  const key = ticketIds.join(",");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let closed = false;
    let ping: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ids = key ? key.split(",") : [];

    const connect = () => {
      socket = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?as=${audience}`);
      socket.onopen = () => {
        retry = 0;
        for (const ticketId of ids) socket?.send(JSON.stringify({ type: "subscribe", ticketId }));
        ping = setInterval(() => socket?.send(JSON.stringify({ type: "ping" })), 25_000);
      };
      socket.onmessage = (msg) => {
        const event = JSON.parse(msg.data as string) as ServerEvent | { type: "pong" };
        if (event.type !== "pong") handler.current(event);
      };
      socket.onclose = () => {
        clearInterval(ping);
        if (closed) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15_000));
      };
    };
    connect();

    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(timer);
      socket?.close();
    };
  }, [audience, key]);
}
