/** External app links. Overridable via .env for local/staging builds; the
 * production praktikaplus.max.it-integrators.ru subdomains are the
 * compiled-in defaults. */
export const LK_URL = import.meta.env.VITE_LK_URL || "https://lk.praktikaplus.max.it-integrators.ru";
// Universal deep link: MAX opens the bot's Mini App when it is installed,
// while the bot chat remains the fallback entry point.
export const BOT_URL = import.meta.env.VITE_BOT_URL || "https://max.ru/t417_hakaton_max_bot?startapp=app";
