@echo off
echo Starting MongoDB...

REM Try different MongoDB installation paths
if exist "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" (
    echo Found MongoDB 8.0
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
    goto :end
)

if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
    echo Found MongoDB 7.0
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
    goto :end
)

if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" (
    echo Found MongoDB 6.0
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db"
    goto :end
)

if exist "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" (
    echo Found MongoDB 5.0
    "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" --dbpath "C:\data\db"
    goto :end
)

echo MongoDB not found in standard installation paths
echo Please install MongoDB or check the installation path

:end
pause
