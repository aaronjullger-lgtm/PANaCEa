/** @type {import('next').Metadata} */
export const metadata = {
  title: 'PANaCEa Agent Orchestrator',
  description: 'Control-plane for the LangGraph agent orchestration layer (Langfuse + LangSmith traced, Qdrant memory).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#101729',
          color: '#f1f5f9',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}