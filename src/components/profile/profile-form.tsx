"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Profile = {
  name: string;
  email: string;
  avatarColor: string;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] =
    segment < 1 ? [chroma, secondary, 0] : [secondary, chroma, 0];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function hexToHsl(color: string) {
  const value = color.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0 : maximum === red ? 60 * (((green - blue) / delta) % 6) : 60 * ((blue - red) / delta + 2);

  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const initialColor = hexToHsl(profile.avatarColor);
  const [name, setName] = useState(profile.name);
  const [hue, setHue] = useState(Math.round(initialColor.hue));
  const [saturation, setSaturation] = useState(Math.round(initialColor.saturation * 100));
  const [lightness, setLightness] = useState(Math.round(initialColor.lightness * 100));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarColor = useMemo(() => hslToHex(hue, saturation / 100, lightness / 100), [hue, saturation, lightness]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarColor }),
      });
      const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setError(result?.error?.message ?? "Unable to save profile.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Unable to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-2xl border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Personalize how your account appears in RockPit.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <Avatar className="size-16 text-lg" style={{ backgroundColor: avatarColor, color: "#fff" }}>
              <AvatarFallback className="bg-transparent text-lg font-semibold text-inherit">{initials(name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">Avatar preview</p>
              <p className="text-sm text-muted-foreground">Initials are generated from your name.</p>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <FieldContent>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Email</FieldLabel>
            <FieldContent>
              <Input value={profile.email} readOnly aria-label="Email" />
              <FieldDescription>Email cannot be changed from this page.</FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Avatar color</FieldLabel>
            <FieldContent className="gap-4">
              <div className="h-4 rounded-full" style={{ background: "linear-gradient(90deg, #D94B45 0%, #E76F51 30%, #F4A261 65%, #F6C453 100%)" }} />
              <label className="grid gap-2 text-sm">
                Hue <span className="text-muted-foreground">{hue}°</span>
                <input aria-label="Warm color hue" type="range" min="0" max="60" value={hue} onChange={(event) => setHue(Number(event.target.value))} />
              </label>
              <label className="grid gap-2 text-sm">
                Saturation <span className="text-muted-foreground">{saturation}%</span>
                <input aria-label="Color saturation" type="range" min="40" max="100" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} />
              </label>
              <label className="grid gap-2 text-sm">
                Brightness <span className="text-muted-foreground">{lightness}%</span>
                <input aria-label="Color brightness" type="range" min="30" max="75" value={lightness} onChange={(event) => setLightness(Number(event.target.value))} />
              </label>
              <FieldDescription>Choose any shade within a warm red-to-yellow spectrum.</FieldDescription>
            </FieldContent>
          </Field>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-600">Profile saved.</p> : null}
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
