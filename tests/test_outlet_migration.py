import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class OutletMigrationTests(unittest.TestCase):
    def test_preserves_outlet_and_shared_balances_and_flags_inconsistency(self):
        db = sqlite3.connect(':memory:')
        for file in sorted((ROOT / 'migrations').glob('*.sql')):
            if file.name.startswith('0005'): break
            db.executescript(file.read_text(encoding='utf-8'))
        db.execute("UPDATE items SET payload_json=json_set(payload_json,'$.bought',20,'$.allocations',json(?),'$.consumed',json(?)) WHERE id='item_01'", ('{"brigade":8,"cafe":4}', '{"brigade":3}'))
        db.execute("UPDATE items SET payload_json=json_set(payload_json,'$.bought',2,'$.allocations',json(?),'$.consumed',json(?)) WHERE id='item_02'", ('{"brigade":5}', '{"brigade":7}'))
        db.executescript((ROOT/'migrations/0005_outlet_stock.sql').read_text())
        self.assertEqual(db.execute("SELECT quantity FROM outlet_stock WHERE item_id='item_01' AND outlet_id='brigade'").fetchone()[0],5)
        self.assertEqual(db.execute("SELECT quantity FROM outlet_stock WHERE item_id='item_01' AND outlet_id='cafe'").fetchone()[0],4)
        self.assertEqual(db.execute("SELECT quantity,issue FROM legacy_stock WHERE item_id='item_01'").fetchone(),(8,''))
        self.assertTrue(db.execute("SELECT issue FROM legacy_stock WHERE item_id='item_02'").fetchone()[0])
        self.assertEqual(db.execute("SELECT json_extract(payload_json,'$.bought') FROM items WHERE id='item_01'").fetchone()[0],20)
        self.assertEqual(db.execute("SELECT sum(delta) FROM outlet_stock_history WHERE item_id='item_01'").fetchone()[0],9)

        with self.assertRaisesRegex(sqlite3.IntegrityError, 'LEGACY_STOCK_READ_ONLY'):
            db.execute("UPDATE items SET payload_json=json_set(payload_json,'$.bought',30) WHERE id='item_01'")
        db.execute("UPDATE items SET payload_json=json_set(payload_json,'$.name','Renamed item') WHERE id='item_01'")
        self.assertEqual(db.execute("SELECT quantity FROM legacy_stock WHERE item_id='item_01'").fetchone()[0],8)

        columns = db.execute("SELECT id,name,category,vendor_id,unit,payload_json FROM items WHERE id='item_01'").fetchone()
        db.execute("INSERT INTO items(id,name,category,vendor_id,unit,payload_json) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",columns)
        with self.assertRaisesRegex(sqlite3.IntegrityError, 'LEGACY_STOCK_READ_ONLY'):
            db.execute("INSERT INTO items(id,name,category,unit,payload_json) VALUES ('bad_legacy','Bad','Dry','kg',?)", ('{"bought":1,"allocations":{},"consumed":{}}',))
        db.close()
