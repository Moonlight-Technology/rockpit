const DEFAULT_AVATAR_COLOR = "#E76F51";

export function getAvatarBackgroundColor(avatarColor: string | null | undefined) {
  return avatarColor ?? DEFAULT_AVATAR_COLOR;
}
