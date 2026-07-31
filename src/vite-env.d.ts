/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: "school" | "creator";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
