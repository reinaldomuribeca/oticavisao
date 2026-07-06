"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageCircle } from "lucide-react";

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" /> COPIADO!
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" /> COPIAR LINK
        </>
      )}
    </Button>
  );
}

export function WhatsAppShareButton({
  link,
  whenText,
}: {
  link: string;
  whenText?: string;
}) {
  const quando = whenText ? `no dia ${whenText}` : "em breve";
  const message = `🎉 Participe do sorteio comigo!
Me cadastrei e estou concorrendo.
Se você se cadastrar pelo meu link, eu ganho +5 números e você também entra no sorteio!
👉 Clique aqui: ${link}
O sorteio é AO VIVO ${quando}, numa live cheia de promoções!`;
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <Button
      asChild={false}
      type="button"
      size="lg"
      className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      <MessageCircle className="mr-2 h-5 w-5" /> COMPARTILHAR NO WHATSAPP
    </Button>
  );
}
