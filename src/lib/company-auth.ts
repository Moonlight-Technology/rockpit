export function canOpenCompanyShell(input: {
  isOwner: boolean;
  hasPremiumUnlock: boolean;
  invitedLeadBoardIds: string[];
}) {
  if (input.isOwner) {
    return input.hasPremiumUnlock;
  }

  return input.invitedLeadBoardIds.length > 0;
}
