"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type CallState = "idle" | "starting" | "in-call" | "ending";

interface VapiClient {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  start: (assistantId: string, overrides?: unknown) => Promise<unknown>;
  stop: () => void;
}

export function VoiceCallButton({ residentId }: { residentId: string }) {
  const [state, setState] = useState<CallState>("idle");
  const vapiRef = useRef<VapiClient | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
    };
  }, []);

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

      const { assistantId, publicKey, assistantOverrides } = await res.json();

      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(publicKey) as unknown as VapiClient;
      vapiRef.current = vapi;

      vapi.on("call-start", () => setState("in-call"));
      vapi.on("call-end", () => {
        setState("idle");
        toast.success("Call ended — note is being structured");
        router.refresh();
      });
      vapi.on("error", (...args: unknown[]) => {
        const err = args[0];
        const msg = err instanceof Error ? err.message : String(err ?? "Call error");
        // "Meeting has ended" is a normal Daily.co teardown event, not a real error
        if (msg.includes("Meeting has ended") || msg.includes("ejection")) return;
        toast.error(msg);
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
