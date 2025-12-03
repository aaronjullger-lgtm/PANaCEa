<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1XKKOL9unGhpt6WDahRfrws6I92V3mjTJ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (from https://dashboard.clerk.com)
   - `GEMINI_API_KEY`: Your Gemini API key
   - `VITE_GEMINI_API_KEY`: Your Gemini API key (for client-side)
   
   See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) for detailed authentication setup instructions.

3. Start the backend server on port 3001 (required for `/geminiProxy` endpoint)
4. Run the app:
   `npm run dev`

**Note:** The Vite development server is configured to proxy requests to `/geminiProxy` to `http://localhost:3001`. Make sure your backend server is running on this port before starting the frontend.
