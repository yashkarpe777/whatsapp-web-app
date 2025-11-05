@echo off
echo ===================================================
echo Production Database Update Script
echo ===================================================
echo.
echo This script will update your PostgreSQL database schema
echo to add the new media columns to the campaigns table.
echo.
echo Please enter your PostgreSQL credentials:
echo.

set /p DB_HOST=Database Host (default: localhost): 
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT=Database Port (default: 5432): 
if "%DB_PORT%"=="" set DB_PORT=5432

set /p DB_NAME=Database Name: 

set /p DB_USER=Username: 

set /p DB_PASS=Password: 

echo.
echo Creating backup before making changes...
echo.

set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=backup_%TIMESTAMP%.sql

echo Backing up schema to %BACKUP_FILE%...
set PGPASSWORD=%DB_PASS%
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --schema-only -f %BACKUP_FILE%

if %ERRORLEVEL% NEQ 0 (
    echo Error creating backup! Please check your credentials and try again.
    goto end
)

echo.
echo Applying database changes...
echo.

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f add_media_columns.sql

if %ERRORLEVEL% NEQ 0 (
    echo Error applying changes! Please check the error message above.
) else (
    echo.
    echo ===================================================
    echo Database updated successfully!
    echo ===================================================
    echo.
    echo New columns added:
    echo - media_type (VARCHAR(50))
    echo - media_name (VARCHAR(255))
    echo.
    echo An index was also created on the media_type column.
)

:end
echo.
echo Press any key to exit...
pause > nul
