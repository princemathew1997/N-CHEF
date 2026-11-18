const { tabAuth } = require('./qa-tab-auth.cjs');
// Writes only to a disposable local QA instance.
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const qaRequire = createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT, 'package.json'));
const { chromium, firefox, webkit } = qaRequire('playwright');
const base = process.env.NCHEF_QA_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:889[0-9]$/);
const engine = process.env.NCHEF_QA_BROWSER || 'edge';
assert.ok(['edge', 'chromium', 'firefox', 'webkit'].includes(engine), 'Choose a supported QA browser.');
const screenshotDir = process.env.NCHEF_QA_SCREENSHOTS;
const baselineDir = process.env.NCHEF_QA_VISUAL_BASELINE;
if (baselineDir) assert.ok(screenshotDir, 'Set NCHEF_QA_SCREENSHOTS to retain comparison images.');
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

async function capture(editor, viewport) {
    if (!screenshotDir) return;
    const filename = `${engine}-quick-edit-${viewport}.png`;
    const actual = await editor.screenshot({ path: resolve(screenshotDir, filename), animations: 'disabled' });
    if (!baselineDir) return;
    const expected = readFileSync(resolve(baselineDir, filename));
    if (actual.equals(expected)) return;
    const { PNG } = qaRequire('pngjs');
    const before = PNG.sync.read(expected);
    const after = PNG.sync.read(actual);
    assert.equal(after.width, before.width, filename + ': width changed');
    assert.ok(Math.abs(after.height - before.height) <= 1, filename + ': height changed');
    const taller = before.height >= after.height ? before : after;
    const shorter = taller === before ? after : before;
    // Firefox can round the screenshot origin by one pixel after scrolling.
    const rowBytes = shorter.width * 4;
    const offsets = taller.height === shorter.height ? [0] : [0, rowBytes];
    const mismatch = Math.min(...offsets.map(offset => {
        let pixels = 0;
        for (let byte = 0; byte < shorter.data.length; byte += 4) {
            if (shorter.data.readUInt32LE(byte) !== taller.data.readUInt32LE(byte + offset)) pixels++;
        }
        return pixels / (shorter.width * shorter.height);
    }));
    assert.ok(mismatch <= 0.001, `${filename}: ${(mismatch * 100).toFixed(2)}% of pixels differ`);
}

async function main() {
    const browserType = { edge: chromium, chromium, firefox, webkit }[engine];
    const browser = await browserType.launch({ headless: true, ...(engine === 'edge' ? { channel: 'msedge' } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await page.goto(base);
        await page.locator('#username').fill('qa_admin');
        await page.locator('#password').fill('qa-only-password-2026');
        await page.locator('#loginBtn').click();
        await page.waitForFunction(() => currentUser?.username === 'qa_admin');
        await page.locator('#page-loader').waitFor({ state: 'hidden' });

        const state = async () => (await page.request.get(base + '/api/state', { headers: await tabAuth(page) })).json();
        const command = async (path, input) => {
            const response = await page.request.post(base + '/api/' + path, {
                headers: { Origin: base, ...await tabAuth(page) },
                data: { ...input, revision: (await state()).revision, operationId: crypto.randomUUID() },
            });
            assert.equal(response.status(), 200, await response.text());
        };
        const initial = await state();
        const itemName = 'QA Quick Edit ' + engine;
        const existing = initial.items.find(row => row.name === itemName);
        const item = existing || {
            id: crypto.randomUUID(), name: itemName,
            category: initial.items[0].category, unit: initial.items[0].unit, vendor: initial.vendors[0].name,
        };
        const outlet = initial.outlets.find(row => row.id === 'brigade');
        if (!existing) await command('changes', { changes: [{ entity: 'items', key: item.id, value: item }] });
        await command('stock/adjust', {
            itemId: item.id, outletId: outlet.id, quantity: 100, reason: 'Seed browser QA fixture',
        });

        async function openOverview() {
            await page.evaluate(() => switchToView('inventory:overview'));
            await page.locator('[name=overviewOutlet]').selectOption(outlet.id);
            const picker = page.locator('#overviewItemPicker [role=combobox]');
            await picker.fill(item.name);
            await page.locator('#overviewItemPicker [role=option]').filter({ hasText: item.name }).click();
        }
        await page.evaluate(() => refreshDatabase());
        await openOverview();
        const row = page.locator('#overviewRows tbody tr').filter({ hasText: item.name });
        assert.equal(await row.locator('td').nth(3).innerText(), '100');
        const edit = row.getByRole('button', { name: 'Edit' });
        await edit.press('Enter');
        const editor = page.locator('#overviewQuickEditor form');
        const quantity = editor.locator('[name=quickQty]');
        assert.ok(await quantity.evaluate(el => el === document.activeElement));
        await editor.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
        assert.ok(await edit.evaluate(el => el === document.activeElement));
        await edit.press('Enter');
        await capture(editor, 'desktop');
        if (process.env.NCHEF_QA_AXE === '1') {
            await page.evaluate(readFileSync(qaRequire.resolve('axe-core'), 'utf8'));
            const results = await page.evaluate(async () => {
                const audit = await axe.run('#overviewQuickEditor', {
                    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
                });
                return audit.violations.map(rule => ({ rule: rule.id, impact: rule.impact, targets: rule.nodes.map(node => node.target) }));
            });
            console.log('Quick Edit accessibility scan:', JSON.stringify(results));
        }
        await quantity.fill('110');
        const auditReason = 'Verified physical count ' + crypto.randomUUID();
        await editor.locator('[name=quickReason]').fill(auditReason);
        await page.evaluate(() => {
            document.activeElement.blur();
            window.onLiveSyncReceived();
        });
        assert.equal(await quantity.inputValue(), '110');

        const rejectOnce = route => route.fulfill({ status: 409, json: { error: 'QA simulated save conflict' } });
        await page.route('**/api/stock/adjust', rejectOnce, { times: 1 });
        await editor.getByRole('button', { name: 'Save Changes' }).click();
        await editor.getByRole('alert').filter({ hasText: 'QA simulated save conflict' }).waitFor();
        assert.equal(await quantity.inputValue(), '110');
        assert.equal(await row.locator('td').nth(3).innerText(), '100');

        await editor.getByRole('button', { name: 'Save Changes' }).click();
        await editor.waitFor({ state: 'detached' });
        assert.ok(await edit.evaluate(el => el === document.activeElement));
        assert.equal(await row.locator('td').nth(3).innerText(), '110');
        const saved = await state();
        assert.equal(saved.outletStock.find(s => s.item_id === item.id && s.outlet_id === outlet.id).quantity, 110);
        const adjustments = saved.stockHistory.filter(s => s.item_id === item.id && s.reason === auditReason);
        assert.equal(adjustments.length, 1);
        assert.equal(adjustments[0].delta, 10);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await page.waitForFunction(() => currentUser?.username === 'qa_admin');
        await page.locator('#page-loader').waitFor({ state: 'hidden' });
        await openOverview();
        assert.equal(await row.locator('td').nth(3).innerText(), '110');
        if (screenshotDir) {
            await edit.press('Enter');
            await capture(editor, 'mobile');
            await editor.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
        }
        await edit.press('Enter');
        await quantity.fill('111');
        const lostResponseReason = 'Lost response retry ' + crypto.randomUUID();
        await editor.locator('[name=quickReason]').fill(lostResponseReason);
        await page.route('**/api/stock/adjust', async route => {
            await route.fetch();
            await route.abort('failed');
        }, { times: 1 });
        await editor.getByRole('button', { name: 'Save Changes' }).click();
        await page.waitForFunction(() => document.querySelector('[data-quick-error]')?.textContent.trim());
        assert.equal(await quantity.inputValue(), '111');
        assert.equal((await state()).outletStock.find(s => s.item_id === item.id && s.outlet_id === outlet.id).quantity, 111);
        await editor.getByRole('button', { name: 'Save Changes' }).click();
        await editor.waitFor({ state: 'detached' });
        const retried = await state();
        assert.equal(retried.stockHistory.filter(s => s.item_id === item.id && s.reason === lostResponseReason).length, 1);
        assert.equal(await row.locator('td').nth(3).innerText(), '111');
        console.log(`Quick Edit ${engine} QA passed: keyboard focus, refresh, failed save, retry and mobile reload.`);
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
