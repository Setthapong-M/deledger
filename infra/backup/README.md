# Encrypted backup

Mount a physically separate filesystem at `/mnt/deledger-backups` before starting the stack. `backup.sh` streams a PostgreSQL custom dump through `age`, verifies a non-empty artifact, writes a checksum beside it, and only then applies the 30-day retention rule. Plaintext dumps and the age identity never enter the mount.

`restore-verify.sh` selects the newest checksum-valid artifact and restores it into a uniquely named, network-isolated PostgreSQL container and volume. The cleanup trap removes only resources carrying that generated name.

On success it updates `.restore-verify.last-success` on the mounted target; the protected readiness check requires that marker and a backup newer than 26 hours.
