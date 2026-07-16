export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "À Tour de Bras";

export const APP_LOGO = import.meta.env.VITE_APP_LOGO || "/logo.jpg";

// Page de connexion locale (email + mot de passe).
export const getLoginUrl = () => "/login";