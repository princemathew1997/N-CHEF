# N-CHEF user wiki

Current workflow guides revised 20 October 2026. The Markdown guides describe the new operations release. Existing screenshots and PDFs below document the older three-role release and must be regenerated before sharing as current instructions.

The historical [implementation gaps](implementation-gaps.md) describe the pre-operations release; use the role guides for current behavior.

| Role | Editable wiki | Shareable PDF |
| --- | --- | --- |
| Admin | [Admin guide](admin.md) | [Admin PDF](../../output/pdf/nchef-admin-guide.pdf) |
| Executive Chef | [Executive Chef guide](supervisor.md) | Legacy PDF only |
| Purchaser (Supervisor) | [Purchaser guide](purchaser.md) | Not generated |
| Cuisine Head | [Cuisine Head guide](chef.md) | Legacy PDF only |

## Screenshots

All screenshots use the disposable local QA database, fictional staff and sample transactions. Numbered callouts are explained immediately below each image in the guides. Password fields are empty in published captures.

- [Sign in](images/sign-in.png)
- [Locations](images/admin-locations.png), [Vendors](images/admin-vendors.png), [Catalog](images/admin-catalog.png), [Users](images/admin-users.png)
- [Approval review](images/admin-approval.png), [Purchase-order form](images/admin-purchase-order.png), [Stock Overview](images/admin-overview.png)
- [Separate vendor orders and individual PDF downloads](images/admin-vendor-results.png)
- [Chef accounts](images/supervisor-chefs.png), [Consolidation](images/supervisor-consolidate.png), [Stock receipt](images/supervisor-receipt.png), [Existing orders in Admin Vendors](images/admin-existing-orders.png)
- [Chef workspace](images/chef-home.png), [Ingredient selection](images/chef-select.png), [Quantity review](images/chef-review.png), [Request tracking](images/chef-tracking.png)
- [Separate distribution](images/stock-distribute.png), [Count adjustment](images/stock-adjust.png), [Master Orders](images/master-orders.png), [Stock History](images/stock-history.png)

## Regenerate the PDFs

The Markdown files are the content source. Edit them, keep image paths relative to this folder, and run:

```powershell
python scripts/build-user-guides.py --render
```

Use Python with `reportlab`, `Pillow` and `pypdf` installed. Poppler's `pdftoppm` must be on PATH for `--render`; omit that flag to generate PDFs only. Generated PDFs go to `output/pdf/`. Preview PNGs go to `tmp/pdfs/` and are not deliverables. The builder checks that every source text line is present in the PDF. Review every rendered page for layout and legibility after changes.

The tested Python dependency versions are pinned in `scripts/user-guides-requirements.txt`. Install them in a documentation environment with `python -m pip install -r scripts/user-guides-requirements.txt` if they are not already available. Capture tooling was exercised with bundled Playwright and Chrome; it is optional when rebuilding PDFs from existing images.

Supported source formatting: title, numbered section headings, subsection headings, paragraphs, bold, numbered steps, bullets, blockquote notes, standalone PNG images and captions. Each numbered section starts on a new PDF page. The linked contents and page numbers are generated automatically. Keep PDF revision text in the builder synchronized with the Markdown revision when updating the guides.

## Refresh screenshots and walkthrough checks

1. Build the app with `npm run build`.
2. Start a fresh disposable server with `node scripts/qa-server.mjs`. It must be the unchanged local QA server on `127.0.0.1:8888`; never point capture tooling at production.
3. In another terminal run `node scripts/capture-user-guides.cjs`. It requires Playwright and a local Microsoft Edge installation by default. `NCHEF_PLAYWRIGHT_ROOT` can point to the Playwright package directory; `NCHEF_BROWSER_PATH` can point to a Chromium executable instead.
4. The script requires a fresh database containing only the QA Admin. It creates sample staff, a location, a supplier, an item and transactions, then captures screenshots. Restart the QA server before rerunning it.
5. Review all images, then rebuild the PDFs and inspect their pages. Stop the QA server afterward; its database is in memory.

The script records successful walkthrough checks in [validation.json](validation.json). Capture uses browser controls for the main flows and real local stock commands for additional stock checks. This is documentation tooling, not a production migration or app feature.
