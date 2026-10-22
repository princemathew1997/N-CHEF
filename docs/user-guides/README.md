# N-CHEF user guides

Revised 22 October 2026 for N-CHEF 2.3.0. Confirm the sidebar version is 2.3.0 or later before following these instructions; refresh the app after an upgrade.

## Choose your role

| Role | Editable guide | Shareable PDF |
| --- | --- | --- |
| Admin | [Admin guide](admin.md) | [Admin PDF](../../output/pdf/nchef-admin-guide.pdf) |
| Executive Chef | [Executive Chef guide](supervisor.md) | [Executive Chef PDF](../../output/pdf/nchef-supervisor-guide.pdf) |
| Purchaser (Supervisor) | [Purchaser guide](purchaser.md) | [Purchaser PDF](../../output/pdf/nchef-purchaser-guide.pdf) |
| Cuisine Head | [Cuisine Head guide](chef.md) | [Cuisine Head PDF](../../output/pdf/nchef-chef-guide.pdf) |

The supervisor and chef filenames retain compatibility with older links. Their current contents describe Executive Chef and Cuisine Head respectively.

## Latest features covered

- Compact one-level menus with icons: main labels open pages, separate arrows reveal related actions. Cuisine Heads use the direct Receive Order link.
- Existing-order editing and duplicate item selection prevention; today's requests for Cuisine Heads and justified backdating for Executive Chefs.
- Executive Chef batch review, quantity changes, rejection reasons, saved consolidation edits and recall before approval.
- Approval followed by separate vendor orders, vendor PDFs and the existing manual stock receipt option.
- Receive stock from Vendor Order shortcut, partial receipts, rejected goods, unit prices and optional vendor invoice comparison.
- Purchase Orders Received and Stock History defaulting to today's IST dates.
- Delivery cards per dispatch to a cuisine, Needs attention / Today / History, filters and paging.
- Per-item receipt issues followed by Accept all remaining for one delivery card; preserved issue outcomes and separately confirmed replacements.
- Notifications, role/outlet restrictions, stock movement links, opening-stock imports and safe handling of concurrent saves.

Approval, purchasing, receiving, issuing and confirming receipt are separate steps. Stock increases on usable receiving and decreases on issue; approval and receipt confirmation do not repeat those movements.

## Documentation and validation

See [current limitations](implementation-gaps.md) and the [extended local validation report](../EXTENDED_QA_2026-10-22.md). The guides describe version 2.3.0 user actions; the validation report records the pre-release local checks.

The images in `images/`, the older `validation.json`, and `capture-user-guides.cjs` describe the historical screenshot capture. They are retained as reference material, not current navigation instructions. Current PDFs are rebuilt from the revised text guides and do not embed those outdated screenshots. Do not run the old capture script as a current-workflow test without updating its fixtures and selectors.

## Rebuild the PDFs

From the repository root, use Python with the dependencies in `scripts/user-guides-requirements.txt`:

```powershell
python scripts/build-user-guides.py --render
```

The Codex bundled Python runtime can be used when system Python lacks these libraries. Poppler's `pdftoppm` must be on PATH for rendering. The builder generates all four role PDFs in `output/pdf/`, checks source text preservation and writes preview pages to `tmp/pdfs/`. Every main section starts on a new page and the contents are linked. Review rendered pages after editing.

The Markdown files are the source of truth. Update the revision date in the PDF builder when revising the guides. Supported content includes headings, paragraphs, bold, lists, notes and standalone PNG images. Screenshots added in future must use fictional local QA data and accurately match the current workflow.
