## DB IMPORT

1. run `fl each-adoc ALL > output.txt` to create a `~/fl/insert.sql` and
   `~/fl/EditionMigrationMap.swift` file
2. check `output.txt` file carefully for errors
3. copy migration map swift dict over into migration file

## local testing (newest instructions)

1. ssh into remote, dump current db with:

```bash
pg_dump -d flp --inserts > pre-converge-dump.sql
```

2. Download the file with transmit, to desktop
3. Replace current db with production db:

```bash
cd ~/fl
dropdb flp_dev
createdb flp_dev
psql flp_dev < ~/Desktop/pre-converge-dump.sql > output.txt 2> error.txt
```

4. In `each-adoc/handler.ts` make sure you're not using cached docMeta
5. Compile from the `db-export-friends` branch of CLI
6. Run export script, and move migration map

```bash
cd ~/fl
fl each-adoc ALL
cat ~/fl/EditionMigrationMap.swift >> ~/converge/apps/graphql-api/Sources/App/Migrations/10_HandleEditionIds.swift
```

7. In `configure.swift` comment out all migrations starging with `AddEditionIdForeignKeys`
   and later
8. Run `run migrate:up`
9. Now, import all of the stuff created by running the cli command:

```bash
cd ~/fl
psql -d flp_dev -f ./insert.sql > output.txt 2> error.txt
```

10. Then, uncomment final migrations, and `run migrate:up`
11. Done.
