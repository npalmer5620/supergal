// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    vite: {
        plugins: [tailwindcss({
            content: [
                './src/**/*.{astro,html,js,jsx,ts,tsx}',
            ],
            theme: {
                extend: {
                    colors: {
                        gray: {
                            50: '#f9fafb',
                            100: '#f3f4f6',
                            200: '#e5e7eb',
                            300: '#d1d5db',
                            500: '#6b7280',
                            600: '#4b5563',
                            700: '#374151',
                            900: '#111827',
                        },
                        blue: {
                            500: '#3b82f6',
                        },
                        white: '#ffffff',
                    },
                },
            },
        })],
    },
});
