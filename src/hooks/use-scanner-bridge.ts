"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

export const SCANNER_BRIDGE_URL = 'ws://127.0.0.1:9080';
export const SCANNER_BRIDGE_HEALTH_URL = 'http://127.0.0.1:9080/health';

export interface ScannerBridgeState {
  connected: boolean;
  captureMode: 'window' | 'global' | 'none';
  version?: string;
  lastScan?: string;
  error?: string;
}

const RETRY_DELAYS = [2000, 3000, 5000, 8000, 12000];

/**
 * Connects to the local ecbills desktop scanner bridge (ws://127.0.0.1:9080).
 * The bridge captures barcode/QR codes from a USB scanner and pushes them
 * here in real-time so billing auto-adds the scanned product.
 */
export function useScannerBridge(onScan?: (code: string) => void) {
  const [state, setState] = useState<ScannerBridgeState>({
    connected: false,
    captureMode: 'none',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const onScanRef = useRef(onScan);
  const retryIndexRef = useRef(0);
  const aliveRef = useRef(true);

  onScanRef.current = onScan;

  const connect = useCallback(() => {
    if (!aliveRef.current) return;

    const ws = new WebSocket(SCANNER_BRIDGE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryIndexRef.current = 0;
      setState((prev) => ({ ...prev, connected: true, error: undefined }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message?.type === 'hello') {
          setState((prev) => ({
            ...prev,
            connected: true,
            version: message.version,
            captureMode: message.captureMode || prev.captureMode,
          }));
        } else if (message?.type === 'scan' && typeof message.code === 'string' && message.code) {
          setState((prev) => ({ ...prev, lastScan: message.code }));
          onScanRef.current?.(message.code);
        } else if (message?.type === 'status') {
          setState((prev) => ({
            ...prev,
            captureMode: message.captureMode || prev.captureMode,
            version: message.version || prev.version,
          }));
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setState((prev) => ({ ...prev, connected: false, captureMode: 'none' }));
      if (aliveRef.current) {
        const delay = RETRY_DELAYS[Math.min(retryIndexRef.current, RETRY_DELAYS.length - 1)];
        retryIndexRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [connect]);

  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  return { ...state, ping };
}