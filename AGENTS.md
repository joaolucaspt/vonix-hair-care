<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Catalog lives in src/data/products.json (prices already final); all price/installment/shipping rules are derived in src/lib/store.ts so they stay consistent everywhere.
- Store listings resolve the persisted audience independently of internal link search parameters; professional card presentation reuses lineTotals through cardPricing so catalog bases and cart offers remain unchanged.
- Typography rule (docs/TIPOGRAFIA.md): only two formats site-wide — Playfair Display for titles and Inter for everything else; images carry no drawn text; src/test/typography.test.ts fails on any other font family.
- Header audience choices share the existing audience store; professional relevance sorts filtered results stably by catalog slug/category without changing offer eligibility, so manual sorting and commercial rules stay independent.
- Address lookup uses a validated server RPC with bounded public-provider fallback; shipping remains independent and stale CEP results must never update the UI.
- Checkout and Appmax card forms remain sibling forms; the final CTA explicitly targets the checkout form after card fields and summary to preserve tokenization without nested forms.
- Coupon registration confirms only accepted persistence; the confirmed local marker is versioned to ignore prior unverified successes.
