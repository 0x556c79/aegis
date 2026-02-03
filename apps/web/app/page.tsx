export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">AEGIS</h1>
      <p className="mt-4 text-lg text-gray-600">
        Autonomous Economic Guardian &amp; Investment System — a multi-agent AI swarm for Solana DeFi.
      </p>

      <section className="mt-10 grid gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Status</h2>
          <p className="mt-2 text-sm text-gray-600">
            UI skeleton is live. Wallet (Privy) + agent orchestration wiring will land next.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Next steps</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
            <li>Privy embedded wallet auth + policy-based approvals</li>
            <li>Agent activity feed + portfolio dashboard</li>
            <li>API routes to talk to the agent swarm</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
