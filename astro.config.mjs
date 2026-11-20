// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The site address comes from SITE_URL if you set it, otherwise from Vercel's production domain.
// While the site is only on *.vercel.app, every page is marked noindex (see src/layouts/Base.astro).
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL || (vercelDomain ? `https://${vercelDomain}` : 'https://blue-hour-site.vercel.app');

export default defineConfig({
  site,
  trailingSlash: 'never',
  build: { format: 'file' },
  // Pages marked noindex (404, thank-you, welcome) stay out of the sitemap so Google gets one consistent signal.
  integrations: [sitemap({ filter: (page) => !/\/(404|thank-you|welcome)$/.test(page.replace(/\/$/, '')) })],
});
