"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface JoinByCodeProps {
  loading: boolean;
  error: string;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}

export default function JoinByCode({ loading, error, onSubmit, onCancel }: JoinByCodeProps) {
  const [code, setCode] = useState("");

  return (
    <Card className="rounded-xl py-4">
      <CardContent className="px-4">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onSubmit(code)}
            placeholder="Código de sala"
            maxLength={12}
            className="flex-1 bg-secondary font-mono text-[15px] tracking-[.1em]"
          />
          <Button onClick={() => onSubmit(code)} disabled={loading || !code.trim()} className="font-semibold">
            Entrar
          </Button>
          <Button variant="outline" onClick={onCancel} className="text-muted-foreground">
            ×
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
