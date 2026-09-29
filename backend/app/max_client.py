"""Thin adapter around the MAX Bot API.

Confirmed against the official docs at https://dev.max.ru/docs-api (base
URL, /me, /messages, /subscriptions, /answers, auth header format).

Mini app launch button — empirically confirmed against the real API
(2026-09-20), and it does NOT work the way the TS client's type definitions
suggest:
  - {"type": "open_app", "web_app": "<our own domain>"} 404s with
    "Link not found ... LinkPK{name=<url>, space=TAMTAM}" — MAX looks the
    URL up in an internal registry that an arbitrary HTTPS domain isn't in,
    even after the hackathon organizers "connected" the mini app (that step
    only wires up the bot's own persistent Mini App entry — the little grid
    icon next to the message box in the MAX client — not this attachment
    lookup).
  - {"type": "open_app"} with no web_app at all 400s: "Field 'webApp'
    cannot be null" — so it's not optional despite the TS type saying so.
  - {"type": "link", "url": "https://max.ru/<bot_username>"} (no
    ?startapp=) delivers fine (200) but just opens the bot chat — not the
    Mini App.
  - {"type": "link", "url": "https://max.ru/<bot_username>?startapp=<payload>"}
    is what actually launches the Mini App natively inside MAX — confirmed
    live by tapping it in the client. This matches the documented format
    (dev.max.ru/docs/webapps/introduction: "https://max.ru/<botName>?startapp=<payload>"),
    and the `startapp` param is NOT optional in practice despite the docs
    phrasing it that way. See miniapp_link() — this is what webhook.py and
    notifications.py use for the launch button.

If MAX_BOT_TOKEN is empty (no organizer token yet), every call is logged
instead of sent over the network, so the rest of the app works standalone.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger("max_client")


class MaxBotClient:
    def __init__(self):
        self.base_url = settings.max_api_base_url.rstrip("/")
        self.token = settings.max_bot_token
        self.mock_mode = not bool(self.token)

    def _headers(self) -> dict:
        return {"Authorization": self.token, "Content-Type": "application/json"}

    @staticmethod
    def _keyboard(buttons: list[list[dict]]) -> list[dict]:
        def to_api_button(b: dict) -> dict:
            if "web_app" in b:
                return {"type": "open_app", "text": b["text"], "web_app": b["web_app"]}
            if "url" in b:
                return {"type": "link", "text": b["text"], "url": b["url"]}
            return {"type": "callback", "text": b["text"], "payload": b["payload"]}

        return [{"type": "inline_keyboard", "payload": {"buttons": [[to_api_button(b) for b in row] for row in buttons]}}]

    def send_message(self, user_id: str, text: str, buttons: list[list[dict]] | None = None) -> None:
        """Send a text message to a user, optionally with an inline keyboard.

        buttons: list of rows, each row a list of button dicts:
          - {"text": ..., "payload": ...} -> callback button
          - {"text": ..., "url": ...}     -> link button (opens as an external page)
          - {"text": ..., "web_app": ...} -> open_app button (launches a Mini App
            inside MAX — this is what actually opens our PWA as a mini app,
            not a browser tab)
        """

        attachments = self._keyboard(buttons) if buttons else []

        if self.mock_mode:
            logger.info("[MAX MOCK] -> user %s: %s | buttons=%s", user_id, text, buttons)
            return
        if not is_max_user_id(user_id):
            # Organisation accounts (email login) and browser sandbox users
            # have no MAX chat — there is nobody to deliver to.
            logger.info("[MAX SKIP] %s has no MAX chat: %s", user_id, text[:120])
            return

        def post(attachments_payload: list) -> None:
            httpx.post(
                f"{self.base_url}/messages",
                params={"user_id": user_id},
                headers=self._headers(),
                json={"text": text[:4000], "attachments": attachments_payload},
                timeout=10,
            ).raise_for_status()

        try:
            post(attachments)
        except httpx.HTTPError:
            logger.exception("Failed to send MAX message to %s (with attachments)", user_id)
            if not attachments:
                return
            # A button referencing an unregistered mini app URL (or any other
            # attachment-related rejection) fails the whole request, text
            # included. Registering the mini app link is a one-off manual
            # step in the MAX Partner Platform (business.max.ru/self ->
            # Chat-bots -> bot -> Settings) — until/unless that's done, still
            # deliver the plain text so the bot isn't silent for the user.
            try:
                post([])
            except httpx.HTTPError:
                logger.exception("Failed to send MAX message to %s (text-only retry)", user_id)

    def answer_callback(self, callback_id: str, text: str | None = None, buttons: list[list[dict]] | None = None) -> None:
        """Acknowledges a callback button press; with `text` the message that
        carried the button is replaced (e.g. a confirmation turns into its result)."""
        if self.mock_mode:
            logger.info("[MAX MOCK] answer callback %s: %s", callback_id, text)
            return
        try:
            body: dict = {}
            if text:
                body["message"] = {"text": text[:4000], "attachments": self._keyboard(buttons) if buttons else []}
            httpx.post(
                f"{self.base_url}/answers",
                params={"callback_id": callback_id},
                headers=self._headers(),
                json=body,
                timeout=10,
            ).raise_for_status()
        except httpx.HTTPError:
            logger.exception("Failed to answer MAX callback %s", callback_id)

    def get_me(self) -> dict | None:
        if self.mock_mode:
            logger.info("[MAX MOCK] get_me() called without MAX_BOT_TOKEN")
            return None
        try:
            resp = httpx.get(f"{self.base_url}/me", headers=self._headers(), timeout=10)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError:
            logger.exception("Failed to call GET /me")
            return None

    def register_webhook(self, url: str, secret: str | None = None) -> dict | None:
        """Convenience helper for one-off setup (not called automatically)."""
        if self.mock_mode:
            logger.info("[MAX MOCK] would register webhook at %s", url)
            return None
        body = {
            "url": url,
            "update_types": ["bot_started", "message_created", "message_callback"],
        }
        if secret:
            body["secret"] = secret
        try:
            resp = httpx.post(
                f"{self.base_url}/subscriptions", headers=self._headers(), json=body, timeout=10
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError:
            logger.exception("Failed to register webhook")
            return None

    def miniapp_link(self, payload: str = "app") -> str:
        """The bot's own canonical deep link with a `startapp` param —
        confirmed (2026-09-20) to be the button target that actually
        launches the Mini App natively inside MAX (the bare link without
        `?startapp=` just opens the bot chat instead — see module
        docstring). The payload reaches the mini app as `start_param`:
        `app` opens the feed, `apps` the applications tab, `vac_<id>` a
        specific vacancy, `campus_<…>` a curator's group invitation."""
        username = settings.max_bot_username or "<bot_username>"
        return f"https://max.ru/{username}?startapp={payload}"


def is_max_user_id(user_id: str) -> bool:
    """MAX user ids are numeric; organisation (email) and sandbox accounts are not."""
    return str(user_id).isdigit()


max_client = MaxBotClient()
