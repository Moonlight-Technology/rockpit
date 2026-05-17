export function canOpenCompanyShell(input: {
  isOwner: boolean;
  hasPremiumUnlock: boolean;
  invitedLeadBoardIds: string[];
}) {
  return input.isOwner && input.hasPremiumUnlock;
}
