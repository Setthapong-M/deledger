FROM postgres:18.6-bookworm AS pg-cron-builder

RUN apt-get update \
  && apt-get install --no-install-recommends --yes ca-certificates git build-essential postgresql-server-dev-18 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN git clone --depth 1 --branch v1.6.7 https://github.com/citusdata/pg_cron.git pg_cron \
  && make -C pg_cron \
  && make -C pg_cron DESTDIR=/stage install

FROM postgres:18.6-bookworm
COPY --from=pg-cron-builder /stage/usr/lib/postgresql/18/lib/pg_cron.so /usr/lib/postgresql/18/lib/pg_cron.so
COPY --from=pg-cron-builder /stage/usr/share/postgresql/18/extension/pg_cron* /usr/share/postgresql/18/extension/
COPY db/init/001_roles.sh /docker-entrypoint-initdb.d/001_roles.sh
COPY db/pg_hba.conf /etc/postgresql/pg_hba.conf
RUN chmod 0755 /docker-entrypoint-initdb.d/001_roles.sh
RUN chown postgres:postgres /etc/postgresql/pg_hba.conf && chmod 0640 /etc/postgresql/pg_hba.conf
CMD ["postgres", "-c", "hba_file=/etc/postgresql/pg_hba.conf", "-c", "shared_preload_libraries=pg_cron", "-c", "cron.database_name=deledger", "-c", "cron.timezone=Asia/Bangkok"]
