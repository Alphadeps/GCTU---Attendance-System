// Cloudflare Turnstile site key (public). Leave VITE_TURNSTILE_SITE_KEY unset to turn the check off.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const HUMAN_CHECK_ENABLED = Boolean(TURNSTILE_SITE_KEY);
