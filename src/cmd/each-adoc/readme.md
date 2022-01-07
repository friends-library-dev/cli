## DB IMPORT

1. run `fl each-adoc ALL > output.txt` to create a `~/fl/insert.sql` and
   `~/fl/EditionMigrationMap.swift` file
2. check `output.txt` file carefully for errors
3. copy migration map swift dict over into migration file

### testing

To dump from remote (before upgrade):

```bash
pg_dump -d flp --inserts > pre-converge-dump.sql
```

To import locally for testing

```bash
psql flp_dev < ~/Desktop/pre-converge-dump.sql > output.txt 2> error.txt
```

### Local testing PRE-steps:

```bash
# get into state of prod db
dropdb flp_dev
createdb flp_dev
psql flp_dev < ~/Desktop/all.sql > output.txt 2> error.txt
```

### More steps

Modifications for PROD:

- flp_dev -> flp
- can't cat file, need to ssh in etc...

```bash
# prep for migration
fl each-adoc ALL
cat ~/fl/EditionMigrationMap.swift >> ~/converge/apps/graphql-api/Sources/App/Migrations/10_HandleEditionIds.swift
# then move map into extension
npm run migrate:up
# at this point, the FK things with order items and downloads are sorted
# so we can run the import of all our entities from the yaml export
psql -d flp_dev -f ./insert.sql > output.txt 2> error.txt
```
