import type { AvatarId } from "@dimadong/contracts";

export type AvatarOption = {
  id: AvatarId;
  label: string;
  imagePath: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: "alien-neon-ace",
    label: "Neon Ace",
    imagePath: "/avatars/alien-neon-ace.png",
  },
  {
    id: "alien-beanie",
    label: "Beanie",
    imagePath: "/avatars/alien-beanie.png",
  },
  {
    id: "alien-mask",
    label: "Cyber Mask",
    imagePath: "/avatars/alien-mask.png",
  },
  {
    id: "alien-dreads",
    label: "Neon Dreads",
    imagePath: "/avatars/alien-dreads.png",
  },
];

export const DEFAULT_AVATAR_ID: AvatarId = AVATAR_OPTIONS[0].id;

export function isAvatarId(value: string): value is AvatarId {
  return AVATAR_OPTIONS.some((avatar) => avatar.id === value);
}
