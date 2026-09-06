FROM postgres:18.6-bookworm
COPY db/entrypoint.sh /usr/local/bin/deledger-entrypoint
COPY db/init/001_roles.sh /docker-entrypoint-initdb.d/001_roles.sh
COPY db/pg_hba.conf /etc/postgresql/pg_hba.conf
RUN chmod 0755 /usr/local/bin/deledger-entrypoint /docker-entrypoint-initdb.d/001_roles.sh
RUN chown postgres:postgres /etc/postgresql/pg_hba.conf && chmod 0640 /etc/postgresql/pg_hba.conf
ENTRYPOINT ["deledger-entrypoint"]
CMD ["postgres", "-c", "hba_file=/etc/postgresql/pg_hba.conf"]
