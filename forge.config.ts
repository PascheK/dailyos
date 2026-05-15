import type { ForgeConfig } from '@electron-forge/core'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { PublisherGithub } from '@electron-forge/publisher-github'

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/{better-sqlite3,bindings,file-uri-to-path,node-gyp-build}/**'
    },
    appBundleId: 'com.killian.dailyos',
    name: 'DailyOS',
    icon: 'resources/icon',
    appCategoryType: 'public.app-category.productivity',
    darwinDarkModeSupport: true
  },
  rebuildConfig: {},
  makers: [
    // ── macOS ──────────────────────────────────────────────────────────────
    new MakerDMG({ format: 'UDZO' }, ['darwin']),
    new MakerZIP({}, ['darwin']),
    // ── Windows ────────────────────────────────────────────────────────────
    new MakerSquirrel({ name: 'DailyOS' }, ['win32']),
    // ── Linux ──────────────────────────────────────────────────────────────
    new MakerDeb({
      options: {
        name: 'dailyos',
        productName: 'DailyOS',
        icon: 'resources/icon.png'
      }
    })
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main'
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts'
        }
      ]
    })
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'PascheK',
        name: 'dailyos'
      },
      prerelease: false,
      draft: true // Draft d'abord — on le publie manuellement quand tout est prêt
    })
  ]
}

export default config
