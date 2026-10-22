import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DispatchMigrationTests(unittest.TestCase):
    def test_groups_only_audited_dispatches_without_losing_history(self):
        db = sqlite3.connect(':memory:')
        for migration in sorted((ROOT / 'migrations').glob('*.sql')):
            if migration.name.startswith('0009'):
                break
            db.executescript(migration.read_text(encoding='utf-8'))
        for name, cuisine, recipient, audited in [
            ('one', 'Indian', 'head', True), ('two', 'Indian', 'head', True),
            ('other', 'Continental', 'other', True), ('unknown', 'Indian', 'head', False)
        ]:
            payload = dict(id=name, cuisine=cuisine, recipientId=recipient, outletId='brigade',
                           status='Issued', quantity=3, createdAt='2026-01-01T00:00:00.000Z')
            db.execute('INSERT INTO operation_records VALUES (?,?,?)', (name, 'delivery', json.dumps(payload)))
            if audited:
                db.execute('INSERT INTO audit_events(id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?)',
                           ('audit_' + name, 'create', 'delivery', name, json.dumps(dict(operationId='command'))))
        db.executescript((ROOT / 'migrations/0009_dispatch_queues.sql').read_text(encoding='utf-8'))
        rows = {r[0]: (json.loads(r[1]), r[2]) for r in db.execute(
            "SELECT id,payload_json,delivery_dispatch FROM operation_records WHERE kind='delivery'")}
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows['one'][1], rows['two'][1])
        self.assertNotEqual(rows['one'][1], rows['other'][1])
        self.assertEqual(rows['unknown'][1], 'unknown')
        self.assertNotIn('dispatchId', rows['unknown'][0])
        self.assertTrue(rows['one'][0]['earlierDelivery'])
        self.assertTrue(all(row[0]['quantity'] == 3 and row[0]['status'] == 'Issued' for row in rows.values()))
        db.close()


if __name__ == '__main__':
    unittest.main()
