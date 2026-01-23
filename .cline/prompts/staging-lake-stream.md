# Staging Lake Stream

## Trigger
"Create a new Drill Mode component."

## Steps
1. **Scaffold UI:** Create the component in `components/drill/` using React 19 standards.
2. **Implement Streaming:** Use `fetch` with a `ReadableStream` reader to render text immediately (masking latency).
3. **Cache Logic:** Ensure the backend `GeminiProxy` saves the full generation to the Question table (Staging Lake) after the stream closes.
4. **Offline Check:** Add `vite-plugin-pwa` annotations to ensure this drill works offline.