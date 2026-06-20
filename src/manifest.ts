import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'PDF Mana',
  description:
    'Merge, Arrange, Nip & Adjust your PDF pages — fully local, nothing uploaded.',
  version: pkg.version,
  icons: {
    16: 'src/icons/icon16.png',
    32: 'src/icons/icon32.png',
    48: 'src/icons/icon48.png',
    128: 'src/icons/icon128.png',
  },
  action: {
    default_title: 'Open PDF Mana',
    default_icon: {
      16: 'src/icons/icon16.png',
      32: 'src/icons/icon32.png',
    },
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['activeTab', 'storage', 'contextMenus'],
  // No standing host access. We request the specific PDF's origin at runtime,
  // only when the user chooses to load a tab/linked PDF. Local-file editing
  // needs none of this.
  optional_host_permissions: ['<all_urls>'],
});
