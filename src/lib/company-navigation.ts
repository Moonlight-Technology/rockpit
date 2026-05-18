export function isCompanyNavItemActive({
  pathname,
  href,
  overviewHref,
}: {
  pathname: string;
  href: string;
  overviewHref: string;
}) {
  if (href === overviewHref) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
