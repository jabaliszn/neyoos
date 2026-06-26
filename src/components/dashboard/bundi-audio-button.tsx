"use client";

import * as React from "react";
import { Volume2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function BundiAudioButton({ text }: { text: string }) {
  const { toast } = useToast();
  const [speaking, setSpeaking] = React.useState(false);

  function handleSpeak(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast({
        title: "Voice synthesis unsupported",
        description: "Your browser does not support local text-to-speech audio.",
        tone: "error",
      });
      return;
    }

    // Cancel any ongoing speech to avoid overlay clutter
    window.speechSynthesis.cancel();
    setSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Soft, natural pace

    // Optional local accent mapping if supported by client OS
    utterance.lang = "en-KE"; 

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
    
    toast({
      title: "Bundi Audio Coach Active",
      description: "Reading card metrics aloud...",
      tone: "info",
    });
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={speaking}
      className="p-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] font-bold transition flex items-center gap-1 shrink-0"
      title="Read statistics aloud"
    >
      {speaking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      Listen
    </button>
  );
}
