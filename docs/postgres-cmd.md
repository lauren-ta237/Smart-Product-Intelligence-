# Local Backup
#  pg_dump -U postgres -h localhost db_delivo_v05 > local_db_backup_v0.bak
#  pg_dump -U postgres -h localhost db_delivo_v05 -f local_db_backup_v0.sql

###  Export Text File
 pg_dump -U postgres -h localhost smart_product_ai -p 5433 -F c -b -f local_db_backup_v01.bak
 
###  Export Custom File
#  pg_dump -U postgres -h localhost -p 5433 -F p -d smart_product_ai -f local_db_backup_v0.sql

# Local Restore
pg_restore -U postgres -h localhost -p 5432 -d --no-owner --no-privileges db_delivery_v04 local_db_backup_v002.bak

# Remote Server Database Backup
$ pg_dump -Fc -d <remote-address>  > remote_db_backup_v0.bak
$ pg_dump -Fc -d <remote-address>  -f remote_db_backup_v0.sql

# Remote Server Database Restore
$ pg_restore -d "<remote-address>" local_db_backup_v0.bak