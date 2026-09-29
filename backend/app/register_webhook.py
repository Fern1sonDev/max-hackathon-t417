"""One-off helper to register this backend's /webhook with MAX.

    docker compose exec backend python -m app.register_webhook https://your-domain.example/webhook [secret]

Requires MAX_BOT_TOKEN to be set. Not called automatically on startup since
it needs a real public HTTPS URL, which only exists once you've deployed
somewhere reachable by MAX.
"""

import sys

from app.max_client import max_client
from app.config import settings


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.register_webhook <https://.../webhook> [secret]")
        raise SystemExit(1)
    url = sys.argv[1]
    secret = sys.argv[2] if len(sys.argv) > 2 else settings.max_webhook_secret or None
    if not secret:
        raise SystemExit("Set MAX_WEBHOOK_SECRET or pass a webhook secret as the second argument")
    result = max_client.register_webhook(url, secret)
    print(result)


if __name__ == "__main__":
    main()
