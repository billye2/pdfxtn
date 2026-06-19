import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'PDF Page Manager',
  description:
    'Reorder, delete, rotate, merge/split, and crop PDF pages — fully local, nothing uploaded.',
  version: pkg.version,
  icons: {
    16: 'src/icons/icon16.png',
    32: 'src/icons/icon32.png',
    48: 'src/icons/icon48.png',
    128: 'src/icons/icon128.png',
  },
  action: {
    default_title: 'Open PDF Page Manager',
    default_icon: {
      16: 'src/icons/icon16.png',
      32: 'src/icons/icon32.png',
    },
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['activeTab', 'tabs', 'storage', 'contextMenus'],
  host_permissions: ['<all_urls>'],
});
