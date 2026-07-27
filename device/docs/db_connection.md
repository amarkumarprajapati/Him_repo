# PostgreSQL Connection Guide

## Database Credentials

Edit the `.env` file in the project root for defaults:

```
DATABASE_ENGINE=postgresql
DB_NAME=himshravan
DB_USER=himshravan
DB_PASSWORD=himshravan@123456
DB_HOST=localhost
DB_PORT=5432
PG_ADMIN_USER=postgres
PG_ADMIN_PASSWORD=postgres
```

## Connect via psql

```bash
psql -U himshravan -d himshravan -h localhost -p 5432
```

If that fails with role auth issues, switch to PG admin:

```bash
sudo -u postgres psql -d himshravan
```

## Check Data in DeviceInfo Table

```sql
psql -U himshravan -d himshravan -c \
  "SELECT device_id, device_type, node_id, latitude, longitude, status, telemetry_timestamp FROM device_info ORDER BY telemetry_timestamp DESC LIMIT 20;"
```

## List All Tables

```sql
psql -U himshravan -d himshravan -c "\dt"
```

## See Table Structures

```sql
psql -U himshravan -d himshravan -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```

Then for any table:

```sql
psql -U himshravan -d himshravan -c "\d device_info"
psql -U himshravan -d himshravan -c "\d cellular_active_telemetry"
psql -U himshravan -d himshravan -c "\d cellular_passive_telemetry"
psql -U himshravan -d himshravan -c "\d satellite_telemetry"
psql -U himshravan -d himshravan -c "\d telemetry_session"
psql -U himshravan -d himshravan -c "\d sync_status"
```

## Count Rows Per Table

```sql
psql -U himshravan -d himshravan -c \
  "SELECT 'device_info' AS tbl, COUNT(*) FROM device_info UNION ALL SELECT 'cellular_active_telemetry', COUNT(*) FROM cellular_active_telemetry UNION ALL SELECT 'cellular_passive_telemetry', COUNT(*) FROM cellular_passive_telemetry UNION ALL SELECT 'satellite_telemetry', COUNT(*) FROM satellite_telemetry UNION ALL SELECT 'telemetry_session', COUNT(*) FROM telemetry_session UNION ALL SELECT 'sync_status', COUNT(*) FROM sync_status;"
```

## Check Indexes

```sql
psql -U himshravan -d himshravan -c \
  "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;"
```

## Last 10 Records Per Telemetry Table

```sql
psql -U himshravan -d himshravan -c \
  "SELECT 'ACTIVE' AS src, timestamp, active_cellular_id AS node_id, latitude, longitude FROM cellular_active_telemetry ORDER BY timestamp DESC LIMIT 10;"
psql -U himshravan -d himshravan -c \
  "SELECT 'PASSIVE' AS src, timestamp, passive_cellular_id AS node_id, latitude, longitude FROM cellular_passive_telemetry ORDER BY timestamp DESC LIMIT 10;"
psql -U himshravan -d himshravan -c \
  "SELECT 'SAT' AS src, timestamp, satellite_id AS node_id, latitude, longitude FROM satellite_telemetry ORDER BY timestamp DESC LIMIT 10;"
```

## Tail Monitor Log

```bash
tail -f logs/data_file_monitor.log
```

## Check Latest Local Files

```bash
ls -lrt /home/amar/Documents/serverfile/CellularActive | tail
ls -lrt /home/amar/Documents/serverfile/CellularPassive | tail
ls -lrt /home/amar/Documents/serverfile/Satellite | tail
```

## Run the Monitor Once

```bash
source .venv/bin/activate
python scripts/cognent/cellular_satelliite_info.py --once
```
