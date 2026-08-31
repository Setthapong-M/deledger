FROM postgres:18.6-bookworm

RUN apt-get update \
  && apt-get install --no-install-recommends --yes age util-linux \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 deledger-backup \
  && useradd --system --uid 1001 --gid deledger-backup deledger-backup

COPY infra/backup/backup.sh /usr/local/bin/deledger-backup
RUN chmod 0755 /usr/local/bin/deledger-backup

USER 1001:1001
ENTRYPOINT ["/usr/local/bin/deledger-backup"]
