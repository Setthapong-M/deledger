exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });
  pgm.createExtension("pg_cron", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropExtension("pg_cron", { ifExists: true });
  pgm.dropExtension("pgcrypto", { ifExists: true });
};
