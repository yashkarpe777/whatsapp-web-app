@echo off
echo Installing required dependencies for WhatsApp Campaign Manager...
echo.

echo Installing csv-parser and multer...
npm install csv-parser@3.0.0 multer@1.4.5-lts.1 --save

echo.
echo Installing type definitions for multer...
npm install @types/multer@1.4.11 --save-dev

echo.
echo Dependencies installed successfully!
echo.
echo You can now run the backend with: npm run start:dev
echo.
pause
