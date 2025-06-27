import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';

export default defineConfig({
    base: process.env.NODE_ENV === 'production' ? '/G32-3D-Calculator/' : '',
    plugins: [glsl()]
});