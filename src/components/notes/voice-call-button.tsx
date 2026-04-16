"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type CallState = "idle" | "starting" | "in-call" | "ending" | "structuring";

interface VapiClient {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  start: (assistantId: string, overrides?: unknown) => Promise<unknown>;
  stop: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10; // 30 seconds max

export function VoiceCallButton({ residentId }: { residentId: string }) {
  const [state, setState] = useState<CallState>("idle");
  const vapiRef = useRef<VapiClient | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const router = useRouter();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
      stopPolling();
    };
  }, [stopPolling]);

  function startPollingForNote() {
    let attempts = 0;
    setState("structuring");

    pollRef.current = setInterval(async () => {
      attempts++;
      router.refresh();

      if (sessionIdRef.current) {
        try {
          const res = await fetch(`/api/voice/session/${sessionIdRef.current}`);
          if (res.ok) {
            const data = await res.json();
            if (data.noteStructured) {
              stopPolling();
              setState("idle");
              toast.success("Note structured and saved");
              router.refresh();
              return;
            }
          }
        } catch {
          // Non-blocking — keep polling
        }
      }

      if (attempts >= MAX_POLL_ATTEMPTS) {
        stopPolling();
        setState("idle");
        toast.info("Note saved — structuring may still be in progress");
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleStart() {
    setState("starting");
    try {
      const res = await fetch("/api/voice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to start call");
      }

      const { sessionId, assistantId, publicKey, assistantOverrides } = await res.json();
      sessionIdRef.current = sessionId;

      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(publicKey) as unknown as VapiClient;
      vapiRef.current = vapi;

      vapi.on("call-start", () => setState("in-call"));
      vapi.on("call-end", () => {
        startPollingForNote();
      });
      vapi.on("error", (...args: unknown[]) => {
        const err = args[0];
        const msg = err instanceof Error ? err.message : String(err ?? "Call error");
        if (msg.includes("Meeting has ended") || msg.includes("ejection")) return;
        toast.error(msg);
        stopPolling();
        setState("idle");
      });

      await vapi.start(assistantId, assistantOverrides);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start call";
      toast.error(msg);
      setState("idle");
    }
  }

  function handleEnd() {
    setState("ending");
    vapiRef.current?.stop();
  }

  if (state === "structuring") {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        Structuring note...
      </Button>
    );
  }

  if (state === "in-call" || state === "ending") {
    return (
      <Button variant="destructive" onClick={handleEnd} disabled={state === "ending"}>
        {state === "ending" ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <PhoneOff className="mr-1 h-4 w-4" />
        )}
        End Call
      </Button>
    );
  }

  return (
    <Button onClick={handleStart} disabled={state === "starting"} variant="outline">
      {state === "starting" ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Mic className="mr-1 h-4 w-4" />
      )}
      Voice Call
    </Button>
  );
}
