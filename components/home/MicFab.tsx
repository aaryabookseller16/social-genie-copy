"use client";

import { useRef, useState } from "react";
import Image from "next/image";

type Props = {
  onResult: (text: string) => void;
  onFallback: () => void;
  onTranscript?: (text: string) => void;
  onListeningChange?: (isListening: boolean) => void;
};

export default function MicFab({
  onResult,
  onFallback,
  onTranscript,
  onListeningChange,
}: Props) {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  const setListening = (v: boolean) => {
    setIsListening(v);
    onListeningChange?.(v);
  };

  const startListening = () => {
    const SpeechRecognition =
      // @ts-ignore
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onFallback();
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? "";
      }

      const clean = transcript.trim();
      if (clean) onTranscript?.(clean);

      const last = event.results?.[event.results.length - 1];
      const isFinal = Boolean(last?.isFinal);

      if (isFinal) {
        const finalText = (
          event.results?.[0]?.[0]?.transcript ?? clean
        ).trim();

        if (finalText) onResult(finalText);
        else onFallback();
      }
    };

    recognition.onerror = () => {
      setListening(false);
      onFallback();
    };

    recognition.onend = () => setListening(false);

    recognition.start();
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setListening(false);
  };

  return (
    <>
      {/* IDLE MIC — CLEAN VERSION (NO RED CIRCLE) */}
      {!isListening && (
        <button
          type="button"
          onClick={startListening}
          aria-label="Speak to Genie"
          className="relative flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 transition active:scale-95"
        >
          <Image
            src="/mic.png"
            alt="Mic"
            fill
            className="object-contain"
            priority
          />
        </button>
      )}

      {/* LISTENING ORB (kept for mobile UX) */}
      {isListening && (
        <div className="flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={stopListening}
            aria-label="Stop listening"
            className="relative flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20"
          >
            <Image
              src="/orb.png"
              alt="Listening"
              fill
              className="object-contain animate-[orbPulse_1.6s_ease-in-out_infinite]"
              priority
            />
          </button>

          <style jsx>{`
            @keyframes orbPulse {
              0% {
                transform: scale(1);
                filter: brightness(1);
              }
              50% {
                transform: scale(1.05);
                filter: brightness(1.08);
              }
              100% {
                transform: scale(1);
                filter: brightness(1);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
