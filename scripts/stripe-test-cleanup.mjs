// Stripe TEST only: lists the Checkout Sessions left by tests/checkout/stripe-real
// (fictitious e-mail client-test@example.com, last 48 h) and expires the open ones.
// Reads STRIPE_TEST_KEY from the env, refuses any non-Test key, never prints it.
// Output: session id, status, kind (order/control), created and expires_at in UTC.

const TEST_EMAIL = "client-test@example.com";
const key = process.env.STRIPE_TEST_KEY?.trim() ?? "";
if (!/^(?:sk|rk)_test_[A-Za-z0-9]{20,}$/.test(key)) {
  console.error("STRIPE_TEST_KEY refused: a Test key (sk_test_ / rk_test_) is required");
  process.exit(2);
}

const api = async (path, method = "GET") => {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`stripe_${res.status}`);
  return res.json();
};
const utc = (s) => new Date(s * 1000).toISOString();

const since = Math.floor(Date.now() / 1000) - 48 * 3600;
const found = [];
let after = null;
for (;;) {
  const page = await api(`/checkout/sessions?created[gte]=${since}&limit=100${after ? `&starting_after=${after}` : ""}`);
  for (const s of page.data) if (!s.livemode && s.customer_email === TEST_EMAIL) found.push(s);
  if (!page.has_more || page.data.length === 0) break;
  after = page.data[page.data.length - 1].id;
}

let expired = 0;
for (const s of found) {
  const kind = String(s.metadata?.orderId ?? "").startsWith("control-") ? "control" : "order";
  let status = s.status;
  if (status === "open") {
    status = (await api(`/checkout/sessions/${s.id}/expire`, "POST")).status;
    expired += 1;
  }
  console.log(`${s.id}  ${kind.padEnd(7)}  ${String(s.status).padEnd(8)} -> ${String(status).padEnd(8)}  created ${utc(s.created)}  expires_at ${utc(s.expires_at)}  gap ${s.expires_at - s.created}s  paid ${s.payment_status}`);
}
console.log(`sessions found: ${found.length}, expired now: ${expired}, still open: ${found.filter((s) => s.status === "open").length - expired}`);
