const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Preparing files for YNR Fishes Desktop build...');

const frontendDist = path.join(__dirname, '../frontend/dist');
const backendSrc = path.join(__dirname, '../backend');

const desktopFrontend = path.join(__dirname, 'frontend');
const desktopBackend = path.join(__dirname, 'backend');

// Helper to copy recursively
function copySync(src, dest, ignoreRootNames = []) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(child => {
      if (ignoreRootNames.includes(child)) return;
      copySync(path.join(src, child), path.join(dest, child), []);
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clean old folders
if (fs.existsSync(desktopFrontend)) fs.rmSync(desktopFrontend, { recursive: true, force: true });
if (fs.existsSync(desktopBackend)) fs.rmSync(desktopBackend, { recursive: true, force: true });

// Build Frontend
console.log('Building Frontend...');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execSync(`${npmCmd} run build`, { 
  cwd: path.join(__dirname, '../frontend'), 
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: './', NODE_OPTIONS: '--max-old-space-size=4096' }
});

// Copy Backend
console.log('Copying Backend (with pre-installed node_modules for maximum speed)...');
copySync(backendSrc, desktopBackend, ['.git', 'auth_info_baileys', 'reports', 'uploads', 'logs']);

// Explicitly ensure .env is bundled for packaged Desktop builds (.exe)
const envSrc = path.join(backendSrc, '.env');
const envDest = path.join(desktopBackend, '.env');
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDest);
  console.log('[Desktop Build] Successfully bundled .env into desktop backend package.');
}

// Copy Frontend to desktopFrontend
console.log('Copying Frontend...');
copySync(frontendDist, desktopFrontend);

// Also copy to backend so the Express server can serve it to mobile phones without asar restrictions
const desktopBackendFrontend = path.join(desktopBackend, 'frontend');
copySync(frontendDist, desktopBackendFrontend);

// Convert all root absolute paths to relative paths in index.html for Electron file:// protocol
console.log('Patching HTML asset paths for Electron file:// protocol...');
[desktopFrontend, desktopBackendFrontend].forEach(dir => {
  const indexHtml = path.join(dir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    let html = fs.readFileSync(indexHtml, 'utf8');
    html = html.replace(/src="\/assets\//g, 'src="./assets/');
    html = html.replace(/href="\/assets\//g, 'href="./assets/');
    html = html.replace(/href="\/icon\.png"/g, 'href="./icon.png"');
    html = html.replace(/href="\/manifest\.webmanifest"/g, 'href="./manifest.webmanifest"');
    html = html.replace(/src="\/registerSW\.js"/g, 'src="./registerSW.js"');
    html = html.replace(/ crossorigin/g, '');
    fs.writeFileSync(indexHtml, html);
  }
});

// Disable PWA service worker in Electron
const swDisableScript = `// Unregister stale service workers
if('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}`;

[desktopFrontend, desktopBackendFrontend].forEach(dir => {
  const swPath = path.join(dir, 'registerSW.js');
  if (fs.existsSync(swPath)) {
    fs.writeFileSync(swPath, swDisableScript);
  }
});

// Patch API URLs for localhost
console.log('Patching API URLs for Desktop (localhost)...');
[desktopFrontend, desktopBackendFrontend].forEach(targetDir => {
  const assetsDir = path.join(targetDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(assetsDir, file);
        try {
          let content = fs.readFileSync(filePath, 'utf8');
          content = content.replace(/http:\/\/localhost:5000/g, 'http://127.0.0.1:5000');
          fs.writeFileSync(filePath, content);
        } catch (err) {}
      }
    });
  }
});

// Copy models if available
const modelsSrc = path.join(__dirname, '../frontend/public/models');
const backendModelsDest = path.join(desktopBackend, 'public/models');
if (fs.existsSync(modelsSrc)) {
  copySync(modelsSrc, backendModelsDest);
}

// Check node_modules inside desktopBackend
const destModules = path.join(desktopBackend, 'node_modules');
if (!fs.existsSync(destModules) || fs.readdirSync(destModules).length === 0) {
  console.log('Installing Backend dependencies for production...');
  execSync(`${npmCmd} install --omit=dev --no-package-lock`, { cwd: desktopBackend, stdio: 'inherit' });
} else {
  console.log('Backend node_modules ready (' + fs.readdirSync(destModules).length + ' packages verified).');
}

console.log('All files prepared and verified for electron-builder packaging!');

