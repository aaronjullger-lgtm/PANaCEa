# Workflow: The Feature Hardening Sprint

**Trigger:** "Harden [Feature Name] for production."

1. **Dependency Check:** Does [Feature] rely on static assets? -> Move to DB.
2. **Offline Check:** Add the API routes used by [Feature] to the `vite-plugin-pwa` runtime caching list.
3. **Error Simulation:**
   - Manually force a 500 error in the backend route.
   - Verify the frontend shows a "Maintenance Mode" toast, NOT a white screen crash (fixing the "Unexpected token <" issue).
4. **Visual Regression:** Ensure images in [Feature] (e.g., Photo Drill) implement the "BlurHash" lazy-loading pattern from **Immich** [Source: Deep Research].