"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLiveTrainWebSocketOptions {
  journeyId: string;
  enabled?: boolean;
  onMessage?: (data: any) => void;
}

export function useLiveTrainWebSocket({
  journeyId,
  enabled = true,
  onMessage
}: UseLiveTrainWebSocketOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastData, setLastData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !journeyId) return;

    try {
      const wsUrl = `ws://127.0.0.1:8000/ws/trains/${journeyId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Start ping heartbeat
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const payload = JSON.parse(event.data);
          const predictionData = payload.type === "ETA_UPDATE" ? payload.data : payload;
          setLastData(predictionData);
          if (onMessage) {
            onMessage(predictionData);
          }
        } catch (e) {
          // Plain text message
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err: any) {
      setError(err.message || "Failed to initialize WebSocket");
    }
  }, [journeyId, enabled, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastData,
    error
  };
}
