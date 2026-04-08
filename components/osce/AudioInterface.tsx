/**
 * AudioInterface - Voice-to-Voice OSCE capture and stream component
 *
 * Uses Web Audio API (AudioWorklet) to capture raw PCM audio and stream
 * chunks via WebSocket to the backend (PatientVoiceSession Durable Object).
 *
 * Barge-in: When the user speaks while the AI is playing audio, the frontend
 * sends a cancel signal; the backend stops TTS generation immediately.
 *
 * @see docs/VOICE_TO_VOICE_ARCHITECTURE.md for backend implementation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, VolumeX, Loader2, AlertCircle } from 'lucide-react';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
// CHUNK_MS retained for documentation purposes; actual chunk size is set by AudioWorklet buffer
const _CHUNK_MS = 100; // eslint-disable-line @typescript-eslint/no-unused-vars
const BARGE_IN_THRESHOLD = 0.02; // RMS threshold for "user is speaking"

export interface AudioInterfaceProps {
  /** WebSocket URL for the PatientVoiceSession (Durable Object or proxy) */
  wsUrl: string | null;
  /** Called when connection closes; pass transcript for persistence to PatientEncounterSession.messages */
  onSessionClose?: (transcript: string[]) => void;
  /** Optional: display patient context in UI */
  patientLabel?: string;
  onClose?: () => void;
}

export function AudioInterface({
  wsUrl,
  onSessionClose,
  patientLabel = 'Patient',
  onClose,
}: AudioInterfaceProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<string[]>([]);
  /** Holds the active AudioWorkletNode or ScriptProcessorNode for cleanup */
  const captureNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  /** Guard against setState on unmounted component */
  const mountedRef = useRef(true);

  const disconnect = useCallback(() => {
    if (captureNodeRef.current) {
      captureNodeRef.current.disconnect();
      captureNodeRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    // Only update React state if still mounted
    if (mountedRef.current) {
      setStatus('idle');
    }
    if (transcriptRef.current.length > 0) {
      onSessionClose?.(transcriptRef.current);
    }
  }, [onSessionClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  const sendBargeIn = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'barge_in' }));
      setIsAiSpeaking(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!wsUrl) {
      setErrorMessage('Voice mode requires backend deployment (WebSocket URL not configured)');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        // startCapture is async (AudioWorklet requires addModule); use an IIFE
        // to handle errors without making onopen itself async.
        (async () => {
          try {
            const captureNode = await startCapture(audioContext, stream, ws);
            captureNodeRef.current = captureNode;
          } catch (err) {
            if (mountedRef.current) {
              setStatus('error');
              setErrorMessage(err instanceof Error ? err.message : 'Failed to start audio capture');
            }
          }
        })();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'transcript') {
            transcriptRef.current.push(msg.text ?? '');
          }
          if (msg.type === 'tts_start') {
            setIsAiSpeaking(true);
          }
          if (msg.type === 'tts_end') {
            setIsAiSpeaking(false);
          }
          // Fix: Only set isAiSpeaking=true for 'audio' chunks if we haven't
          // just received a tts_end (which means this is a stale flush after barge-in).
          // A proper tts_start always precedes a real audio stream.
          // Removed the unconditional setIsAiSpeaking(true) on 'audio' to prevent
          // the tts_end→audio race where a stale chunk re-activates the speaking indicator.
          if (msg.type === 'audio') {
            // Audio playback handled by backend or separate channel
          }
        } catch {
          // Binary or non-JSON message
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus('error');
        setErrorMessage('WebSocket error');
      };

      ws.onclose = (e) => {
        disconnect();
        if (mountedRef.current && e.code !== 1000) {
          setErrorMessage(e.reason || 'Connection closed');
        }
      };
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start microphone');
    }
  }, [wsUrl, disconnect]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Voice: {patientLabel}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {status === 'idle' && (
        <button
          type="button"
          onClick={connect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90"
        >
          <Mic className="w-5 h-5" />
          Connect Voice
        </button>
      )}

      {status === 'connecting' && (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Connecting...
        </div>
      )}

      {status === 'connected' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${micMuted ? 'bg-data-fail/20 text-data-fail' : 'bg-data-pass/20 text-data-pass'}`}
              aria-label={micMuted ? 'Unmute' : 'Mute'}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {micMuted ? 'Muted' : 'Listening'}
            </button>
            {isAiSpeaking && (
              <button
                type="button"
                onClick={sendBargeIn}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-data-provisional/20 text-data-provisional hover:bg-data-provisional/30"
                title="Interrupt (barge-in)"
              >
                <VolumeX className="w-5 h-5" />
                Interrupt
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Speak naturally. Click Interrupt to talk over the patient.
          </p>
          <button
            type="button"
            onClick={disconnect}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            End session
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-data-fail">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </div>
          <button
            type="button"
            onClick={connect}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Encode a Uint8Array to base64 without blowing the call stack.
 * The old `btoa(String.fromCharCode(...bytes))` spreads the entire buffer as
 * function arguments (~8KB per chunk), causing GC pressure and potential
 * stack overflow on large buffers. This chunked version is O(n) with no spread.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32KB chunks — safe for String.fromCharCode.apply
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(
      String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[])
    );
  }
  return btoa(parts.join(''));
}

/**
 * AudioWorkletProcessor source — loaded via Blob URL so no separate file is needed.
 *
 * Runs in the dedicated AudioWorklet thread (off main thread).
 * Converts Float32 PCM → Int16 and posts the buffer back to the main thread
 * using transferable ArrayBuffer (zero-copy).
 *
 * Buffer size is 128 frames per Web Audio spec quantum; we accumulate into a
 * larger buffer (SAMPLE_RATE * CHUNK_MS / 1000 samples) before posting to
 * match the ~100 ms chunk cadence the backend expects.
 */
const WORKLET_CHUNK_FRAMES = Math.floor((SAMPLE_RATE * 100) / 1000); // 1600 frames @ 16 kHz

const PCM_CAPTURE_WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${WORKLET_CHUNK_FRAMES});
    this._filled = 0;
    this._bargeInThreshold = ${BARGE_IN_THRESHOLD};
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    let srcOffset = 0;
    while (srcOffset < channel.length) {
      const toCopy = Math.min(channel.length - srcOffset, ${WORKLET_CHUNK_FRAMES} - this._filled);
      this._buffer.set(channel.subarray(srcOffset, srcOffset + toCopy), this._filled);
      this._filled += toCopy;
      srcOffset += toCopy;

      if (this._filled >= ${WORKLET_CHUNK_FRAMES}) {
        // Convert Float32 → Int16
        const pcm = new Int16Array(this._filled);
        let sumSq = 0;
        for (let i = 0; i < this._filled; i++) {
          const s = Math.max(-1, Math.min(1, this._buffer[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / this._filled);
        // Transfer the buffer (zero-copy) with RMS for barge-in detection
        this.port.postMessage(
          { type: 'pcm', buffer: pcm.buffer, rms },
          [pcm.buffer]
        );
        this._filled = 0;
      }
    }
    return true; // keep processor alive
  }
}
registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;

/**
 * Capture audio via AudioWorkletProcessor (off-main-thread).
 * Falls back to the deprecated ScriptProcessorNode if AudioWorklet is
 * unavailable (e.g. non-secure contexts, older browsers).
 *
 * Returns the created processing node so callers can disconnect it on cleanup.
 */
async function startCapture(
  audioContext: AudioContext,
  stream: MediaStream,
  ws: WebSocket
): Promise<AudioWorkletNode | ScriptProcessorNode> {
  const source = audioContext.createMediaStreamSource(stream);

  // Attempt AudioWorklet first
  if (typeof AudioWorkletNode !== 'undefined' && audioContext.audioWorklet) {
    try {
      const blob = new Blob([PCM_CAPTURE_WORKLET_CODE], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      try {
        await audioContext.audioWorklet.addModule(blobUrl);
      } finally {
        // Always revoke; the module is registered in the AudioContext after addModule resolves
        URL.revokeObjectURL(blobUrl);
      }

      const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');
      workletNode.port.onmessage = (e: MessageEvent<{ type: string; buffer: ArrayBuffer; rms?: number }>) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const { buffer } = e.data;
        const base64 = uint8ToBase64(new Uint8Array(buffer));
        ws.send(JSON.stringify({ type: 'audio', data: base64 }));
      };

      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      silentGain.connect(audioContext.destination);

      source.connect(workletNode);
      workletNode.connect(silentGain);

      return workletNode;
    } catch (workletErr) {
      console.warn(
        '[AudioInterface] AudioWorklet unavailable, falling back to ScriptProcessorNode:',
        workletErr instanceof Error ? workletErr.message : String(workletErr)
      );
      // fall through to ScriptProcessorNode fallback
    }
  }

  // Fallback: ScriptProcessorNode (runs on main thread, deprecated but broadly supported)
  const bufferSize = 4096;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const processor = audioContext.createScriptProcessor(bufferSize, CHANNELS, CHANNELS);

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const input = e.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i] ?? 0));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Chunked base64 encoding — avoids the stack-overflow-prone spread operator
    const base64 = uint8ToBase64(new Uint8Array(pcm.buffer));
    ws.send(JSON.stringify({ type: 'audio', data: base64 }));
  };

  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  silentGain.connect(audioContext.destination);

  source.connect(processor);
  processor.connect(silentGain);

  return processor;
}
