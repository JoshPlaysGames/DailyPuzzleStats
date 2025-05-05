import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';

export default defineConfig({
  // if your repo is github.com/your-user/your-repo, set base to '/your-repo/'
  base: '/DailyPuzzleStats/',

  // output to a folder GitHub Pages can serve
  outDir: 'docs',

  integrations: [
    vue(),
    mdx(),
  ],
});
