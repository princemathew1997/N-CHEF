import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

const source = readFileSync('js/app.js', 'utf8');
const fn = parse(source, { ecmaVersion: 'latest' }).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'initKeyboardShortcuts');
function harness(user, activeElement = null) {
    let handler;
    let redraws = 0;
    const context = {
        currentUser: user, currentView: 'viewMasterOrders', currentStoreView: 'all',
        document: { activeElement, addEventListener: (_, callback) => { handler = callback; } },
        loadDashboardData: () => { redraws++; },
    };
    runInNewContext(source.slice(fn.start, fn.end) + '\ninitKeyboardShortcuts();', context);
    return { context, handler, redraws: () => redraws };
}
test('malformed key events do not crash the shortcut handler', () => {
    const app = harness({ assignedLocations: ['all'] });
    for (const event of [{}, { key: undefined }, { key: null }, { key: 13 }]) assert.doesNotThrow(() => app.handler(event));
    assert.equal(app.redraws(), 0);
});
test('shortcuts are inactive while logged out or typing', () => {
    const loggedOut = harness(null);
    assert.doesNotThrow(() => loggedOut.handler({ key: 'b' }));
    assert.equal(loggedOut.redraws(), 0);
    const typing = harness({ assignedLocations: ['all'] }, { tagName: 'INPUT' });
    typing.handler({ key: 'b' });
    assert.equal(typing.redraws(), 0);
});
test('valid shortcuts select only assigned outlets', () => {
    const app = harness({ assignedLocations: ['brigade'] });
    app.handler({ key: 'B' });
    assert.equal(app.context.currentStoreView, 'brigade');
    assert.equal(app.redraws(), 1);
    app.handler({ key: 'c' });
    assert.equal(app.context.currentStoreView, 'brigade');
    assert.equal(app.redraws(), 1);
});

test('overall-view shortcut is removed', () => {
    const app = harness({ role:'admin', assignedLocations:['all'] });
    app.context.currentStoreView='brigade';
    app.handler({key:'o'});
    assert.equal(app.context.currentStoreView,'brigade');
    assert.equal(app.redraws(),0);
});
