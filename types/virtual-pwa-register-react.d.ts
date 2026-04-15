declare module 'virtual:pwa-register/react' {
  export interface RegisterSWOptions {
    onRegisteredSW?: (
      swUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, (reloadPage?: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => void;
  };
}
