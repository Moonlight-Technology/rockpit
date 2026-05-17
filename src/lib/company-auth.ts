export function canOpenCompanyShell(input: {
  isOwner: boolean;
  hasPremiumUnlock: boolean;
  invitedLeadBoardIds: string[];
}) {
  return input.hasPremiumUnlock && (input.isOwner || input.invitedLeadBoardIds.length > 0);
}
