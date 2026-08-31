const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'build', 'icon.png'), path.join(root, 'mobile-www', 'kitsune-logo.png'));
if (fs.existsSync(path.join(root, 'android'))) execFileSync('python', [path.join(__dirname, 'generate-android-assets.py')], { stdio: 'inherit' });
