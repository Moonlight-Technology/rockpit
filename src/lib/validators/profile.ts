import { z } from "zod";

function hexToHsl(color: string) {
  const value = color.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    if (maximum === blue) hue = 60 * ((red - green) / delta + 4);
  }

  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

export function isWarmAvatarColor(color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return false;

  const { hue, saturation, lightness } = hexToHsl(color);
  return (hue <= 60 || hue >= 330) && saturation >= 0.4 && lightness >= 0.3 && lightness <= 0.75;
}

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .refine(isWarmAvatarColor, "Avatar color must be a warm color."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
