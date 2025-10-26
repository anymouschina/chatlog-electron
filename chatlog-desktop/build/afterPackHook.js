// Ensure bundled backend binary has executable permission after packaging
// Called by electron-builder via afterPack hook
const fs = require('fs');
const path = require('path');

module.exports = async function afterPack(context) {
  try {
    const appOutDir = context.appOutDir; // e.g., Chatlog.app/Contents/Resources
    const resourcesDir = process.platform === 'darwin'
      ? path.join(appOutDir, '..', 'Resources')
      : path.join(appOutDir, 'resources');
    const binPath = path.join(resourcesDir, 'chatlog');
    if (fs.existsSync(binPath)) {
      await fs.promises.chmod(binPath, 0o755);
      context.packager.info('afterPack: set executable bit on', binPath);
    }
  } catch (e) {
    // best-effort; ignore errors
    console.warn('afterPack hook warning:', e.message || e);
  }
};

