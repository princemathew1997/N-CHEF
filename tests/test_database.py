"""Validate migrations and business data constraints without cloud writes."""
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys = ON')
        for migration in sorted((ROOT / 'migrations').glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))

    def tearDown(self):
        self.db.close()

    def test_fresh_catalog_has_no_demo_business_data(self):
        for table, expected in [('outlets', 5), ('vendors', 4), ('cuisines', 6), ('items', 10),
                                ('inventory_balances', 60), ('users', 0), ('requests', 0),
                                ('indents', 0), ('purchase_orders', 0), ('stock_movements', 0)]:
            self.assertEqual(self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], expected)
        self.assertEqual(self.db.execute('SELECT SUM(quantity) FROM inventory_balances').fetchone()[0], 0)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_negative_stock_and_unknown_items_are_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE inventory_balances SET quantity = -1 WHERE item_id = 'item_01'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO inventory_balances VALUES ('unknown', 'central', 1, 0)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO stock_locations VALUES ('invalid', NULL)")

    def test_duplicate_stock_command_is_rejected(self):
        self.db.execute("INSERT INTO users (id, username, password_hash, role, name) VALUES ('u1', 'tester', 'test-only-hash', 'admin', 'Tester')")
        command = "INSERT INTO stock_movements (id, operation_id, item_id, location_id, delta, reason, actor_id) VALUES (?, 'receipt-1', 'item_01', 'central', 10, 'receipt', 'u1')"
        self.db.execute(command, ('movement-1',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(command, ('movement-2',))

    def test_usernames_are_case_insensitive_and_roles_checked(self):
        self.db.execute("INSERT INTO users (id, username, password_hash, role, name) VALUES ('u1', 'Tester', 'test-only-hash', 'admin', 'Tester')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO users (id, username, password_hash, role, name) VALUES ('u2', 'tester', 'test-only-hash', 'chef', 'Tester')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO users (id, username, password_hash, role, name) VALUES ('u3', 'other', 'test-only-hash', 'invalid', 'Tester')")


if __name__ == '__main__':
    unittest.main()
