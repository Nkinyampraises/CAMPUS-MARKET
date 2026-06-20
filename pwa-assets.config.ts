import { defineConfig } from '@vite-pwa/assets-generator/config';

// The brand logo (public/favicon.png) is non-square, so every icon is generated
// with `fit: contain` + padding to keep the full logo visible:
//  - transparent (pwa-192/512): transparent padding, used as standard icons
//  - maskable (Android adaptive): extra safe-zone padding on forest green
//  - apple (iOS home screen): opaque white background (iOS ignores transparency)
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0.05,
      resizeOptions: { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } },
    },
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { fit: 'contain', background: '#005A30' },
    },
    apple: {
      sizes: [180],
      padding: 0.12,
      resizeOptions: { fit: 'contain', background: '#FFFFFF' },
    },
  },
  images: ['public/favicon.png'],
});
