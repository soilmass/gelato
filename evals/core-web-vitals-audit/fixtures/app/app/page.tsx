export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>CWV Fixture App</h1>
      <p>Two routes, same image asset, opposite Core Web Vitals profiles.</p>
      <ul>
        <li>
          <a href="/regressed">/regressed</a> — deliberate LCP/CLS/TBT regressions
        </li>
        <li>
          <a href="/fixed">/fixed</a> — skill's guidance applied
        </li>
      </ul>
    </main>
  );
}
