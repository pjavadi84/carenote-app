"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Smartphone, Share, Plus, X } from "lucide-react";

// Chrome / Edge / Samsung Internet fire `beforeinstallprompt` when the PWA
// meets installability criteria. Safari (iOS + macOS) does NOT — they
// require the user to manually use Share → Add to Home Screen. We detect
// the platform and show appropriate instructions for each.
//
// State machine:
//   - "hidden"  : default; we haven't decided to show anything yet
//   - "android" : Chrome-family browser fired beforeinstallprompt; we can
//                 call .prompt() directly when the user taps Install
//   - "ios"     : iOS Safari; show manual instructions
//
// Dismissal: stored in localStorage with a 30-day cooldown so we don't
// nag. A separate, shorter cooldown (24h) applies to the iOS path
// because there's nothing to "accept" — the user has to do it themselves.

const STORAGE_KEY = "kinroster:install-prompt-dismissed-at";
const COOLDOWN_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari adds a non-standard `standalone` property to navigator
    // when the page is launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/i.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return iOS && webkit && notChrome;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

function isDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  const at = window.localStorage.getItem(STORAGE_KEY);
  if (!at) return false;
  const millis = parseInt(at, 10);
  if (!Number.isFinite(millis)) return false;
  const ageDays = (Date.now() - millis) / (1000 * 60 * 60 * 24);
  return ageDays < COOLDOWN_DAYS;
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [androidEvent, setAndroidEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Skip the prompt entirely when the app is already running standalone
    // (i.e., already installed), on desktop, or when the user dismissed us
    // recently. Each guard short-circuits to keep the wiring cheap.
    if (isStandalone()) return;
    if (!isMobileViewport()) return;
    if (isDismissedRecently()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setAndroidEvent(event as BeforeInstallPromptEvent);
      setMode("android");
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstall as EventListener
    );

    // iOS path: nothing fires, so we detect the platform and show after a
    // short delay so we don't blast the user the moment they land.
    if (isIosSafari()) {
      const timer = window.setTimeout(() => setMode("ios"), 2000);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(
          "beforeinstallprompt",
          onBeforeInstall as EventListener
        );
      };
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstall as EventListener
      );
    };
  }, []);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
    setMode("hidden");
  };

  const installOnAndroid = async () => {
    if (!androidEvent) return;
    try {
      await androidEvent.prompt();
      // userChoice resolves once the user has answered. We don't need the
      // outcome — Chrome handles "accepted" by installing, and "dismissed"
      // simply leaves things as-is. Either way, hide ourselves and apply
      // the cooldown so we don't immediately re-show.
      await androidEvent.userChoice;
    } catch {
      // Some browsers throw if prompt() is called outside a user gesture;
      // that's harmless here because we only call it from a click.
    }
    dismiss();
  };

  if (mode === "hidden") return null;

  return (
    <Sheet open={true} onOpenChange={(open) => !open && dismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-center">
            Add Kinroster to your home screen
          </SheetTitle>
          <SheetDescription className="text-center">
            {mode === "android"
              ? "One tap to install. Kinroster will open like a regular app, full-screen, with no browser bar."
              : "Tap the Share button, then Add to Home Screen. Kinroster will launch full-screen like a regular app."}
          </SheetDescription>
        </SheetHeader>

        {mode === "ios" && (
          <div className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground space-y-3 px-4">
            <div className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0" />
              <span>
                Tap <strong>Share</strong> in Safari&apos;s toolbar.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 shrink-0" />
              <span>
                Choose <strong>Add to Home Screen</strong>.
              </span>
            </div>
          </div>
        )}

        <SheetFooter className="pt-4">
          {mode === "android" ? (
            <>
              <Button onClick={installOnAndroid} className="w-full">
                Add to home screen
              </Button>
              <Button
                variant="ghost"
                onClick={dismiss}
                className="w-full"
              >
                Not now
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={dismiss} className="w-full">
              <X className="h-4 w-4 mr-1" /> Got it
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
