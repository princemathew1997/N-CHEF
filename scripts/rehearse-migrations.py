"""Validate a private D1 export in memory; never connects to or writes production."""
import argparse
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def rehearse(path):
    db = sqlite3.connect(':memory:')
    db.executescript(Path(path).read_text(encoding='utf-8-sig'))
    db.execute('PRAGMA foreign_keys=ON')
    if db.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('The source export has foreign-key errors; resolve them before migration.')
    applied = {row[0] for row in db.execute('SELECT name FROM d1_migrations')}
    migrations = sorted((ROOT / 'migrations').glob('*.sql'))
    if applied - {p.name for p in migrations}:
        raise ValueError('The export contains migrations absent from this checkout.')
    pending = [p for p in migrations if p.name not in applied]
    # Compare common columns so added fields do not mask a changed balance/history.
    tables = ['users', 'sessions', 'user_outlets', 'user_cuisines', 'outlets',
              'vendors', 'items', 'requests', 'indents', 'indent_items',
              'purchase_orders', 'purchase_order_items', 'inventory_balances',
              'outlet_stock', 'legacy_stock', 'outlet_stock_history', 'stock_movements']
    snapshots = {}
    for table in tables:
        columns = [r[1] for r in db.execute(f'PRAGMA table_info({table})')]
        columns = [c for c in columns if c not in {'payload_json', 'profile_json', 'title'}]
        snapshots[table] = (columns, sorted(db.execute(f'SELECT {",".join(columns)} FROM {table}').fetchall(), key=repr))
    profiles = {r[0]: json.loads(r[1]) for r in db.execute('SELECT id,profile_json FROM users')}
    for migration in pending:
        db.executescript(migration.read_text(encoding='utf-8'))
    for table, (columns, expected) in snapshots.items():
        actual = sorted(db.execute(f'SELECT {",".join(columns)} FROM {table}').fetchall(), key=repr)
        if actual != expected:
            raise ValueError(f'Migration changed existing {table} records unexpectedly.')
    mapping = {'admin': 'admin', 'supervisor': 'executive_chef', 'chef': 'cuisine_head'}
    for user_id, role, effective, raw in db.execute('SELECT id,role,effective_role,profile_json FROM users'):
        if effective != mapping[role]:
            raise ValueError('Account role conversion failed.')
        before = {k: v for k, v in profiles[user_id].items() if k not in {'role', 'title'}}
        after = {k: v for k, v in json.loads(raw).items() if k not in {'role', 'title'}}
        if before != after:
            raise ValueError('Migration changed account assignments or other profile fields.')
    if db.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('Migrated copy has foreign-key errors.')
    result = {'ok': True, 'applied_on_private_copy': [p.name for p in pending],
              'preserved_row_counts': {t: len(rows) for t, (_, rows) in snapshots.items()},
              'foreign_key_errors': 0, 'production_changed': False}
    db.close()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', help='Private SQL export; keep it outside Git/release assets.')
    args = parser.parse_args()
    print(json.dumps(rehearse(args.export), indent=2))
