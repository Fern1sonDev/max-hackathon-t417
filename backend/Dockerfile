FROM python:3.11-slim
WORKDIR /backend

# *.max.ru's TLS certificate chains to the Russian Minsvyaz root CA, which
# isn't in Debian's default ca-certificates bundle -> httpx calls in
# app/max_client.py would otherwise fail TLS verification. Installing the
# real root+intermediate (vendored from the government's own distribution
# at gu-st.ru, verified: self-signed root, sub-CA chains to it via
# `openssl verify`) fixes this properly instead of disabling verification.
COPY certs/russian_trusted_root_ca.pem certs/russian_trusted_sub_ca.pem /usr/local/share/ca-certificates/
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && cd /usr/local/share/ca-certificates \
    && tr -d '\r' < russian_trusted_root_ca.pem > russian_trusted_root_ca.crt \
    && tr -d '\r' < russian_trusted_sub_ca.pem > russian_trusted_sub_ca.crt \
    && rm russian_trusted_root_ca.pem russian_trusted_sub_ca.pem \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# httpx (via httpcore) verifies against the `certifi` package's own bundled
# CA file by default, not the OS trust store above — update-ca-certificates
# alone doesn't cover it. Append the same two certs to certifi's bundle so
# app/max_client.py's httpx calls trust *.max.ru too.
COPY scripts/append_ca_certs.py /tmp/append_ca_certs.py
RUN python /tmp/append_ca_certs.py && rm /tmp/append_ca_certs.py

COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
