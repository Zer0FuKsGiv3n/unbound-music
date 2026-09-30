/// <reference types="vite/client" />
import { defineConfig } from 'vite';

interface ImportMetaEnv {
  readonly VITE_YOUTUBE_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
