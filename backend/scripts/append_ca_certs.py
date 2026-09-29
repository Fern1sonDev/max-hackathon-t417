"""Append the Russian Trusted Root/Sub CA certs to certifi's bundle so
httpx (which verifies against certifi.where(), not the OS trust store)
trusts *.max.ru. Run once at image build time; see backend/Dockerfile.
"""

import certifi

CERT_FILES = [
    "/usr/local/share/ca-certificates/russian_trusted_root_ca.crt",
    "/usr/local/share/ca-certificates/russian_trusted_sub_ca.crt",
]

cafile = certifi.where()
with open(cafile, "ab") as out:
    for path in CERT_FILES:
        with open(path, "rb") as f:
            data = f.read()
        if not data.endswith(b"\n"):
            data += b"\n"
        out.write(b"\n" + data)

print(f"appended {len(CERT_FILES)} cert(s) to {cafile}")
