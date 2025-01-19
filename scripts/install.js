// scripts/install.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const binPath = path.join(__dirname, '..', 'bin', 'cli.js');

// Make the CLI executable
try {
  fs.chmodSync(binPath, '755');
  console.log('✅ CLI permissions set');
} catch (error) {
  console.error('Failed to set CLI permissions:', error);
  process.exit(1);
}

// Install Playwright browsers
exec('npx playwright install chromium', (error, stdout, stderr) => {
  if (error) {
    console.error('Failed to install Playwright browsers:', error);
    return;
  }
  console.log('✅ Playwright browsers installed');
});

// Create config directory if it doesn't exist
const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.squirrel');
try {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
  console.log('✅ Config directory created');
} catch (error) {
  console.error('Failed to create config directory:', error);
  process.exit(1);
}