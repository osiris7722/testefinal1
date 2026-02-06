export function parseAdminEmails() {
  const raw = (process.env.REACT_APP_ADMIN_EMAILS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmailDomain() {
  const raw = (process.env.REACT_APP_ADMIN_EMAIL_DOMAIN || '').trim().toLowerCase();
  return raw || null;
}

export function isAdminEmailAllowed(email) {
  if (!email) return false;
  const emailLower = String(email).trim().toLowerCase();
  const allowList = parseAdminEmails();
  if (allowList.length) return allowList.includes(emailLower);
  const domain = getAdminEmailDomain();
  if (domain) return emailLower.endsWith(`@${domain}`);
  // If nothing configured, allow any signed-in user
  return true;
}
