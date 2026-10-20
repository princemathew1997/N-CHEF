"""Rehearse the upgrade on a copy of an existing database with linked users."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class OperationsMigrationTests(unittest.TestCase):
    def test_upgrade_copy_preserves_credentials_assignments_history_and_balances(self):
        source = sqlite3.connect(':memory:')
        source.execute('PRAGMA foreign_keys=ON')
        for path in sorted((ROOT / 'migrations').glob('*.sql')):
            if path.name < '0006':
                source.executescript(path.read_text(encoding='utf-8'))
        source.execute("INSERT INTO users(id,username,password_hash,role,name,profile_json) VALUES ('sup','supervisor','saved-hash','supervisor','Existing Supervisor',?)",
                       ('{"id":"sup","role":"supervisor","assignedLocations":["brigade"]}',))
        source.execute("INSERT INTO users(id,username,password_hash,role,name,profile_json) VALUES ('chef','chef','head-hash','chef','Existing Chef',?)",
                       ('{"id":"chef","role":"chef","assignedLocations":["brigade"],"assignedSections":["Indian"]}',))
        source.execute("INSERT INTO user_outlets VALUES ('sup','brigade')")
        source.execute("INSERT INTO sessions VALUES ('session','sup',9999999999,1)")
        source.execute("INSERT INTO indents(id,indent_number,outlet_id,supervisor_id) VALUES ('indent','OLD-1','brigade','sup')")
        source.execute("UPDATE outlet_stock SET quantity=7 WHERE item_id='item_01' AND outlet_id='brigade'")
        source.execute("INSERT INTO requests(id,item_id,outlet_id,cuisine_id,chef_id,quantity,status,payload_json) SELECT 'issued','item_01','brigade',id,'chef',5,'Approved','{\"qty\":5,\"status\":\"Approved\"}' FROM cuisines WHERE name='Indian'")
        source.commit()
        copy = sqlite3.connect(':memory:')
        source.backup(copy)
        copy.execute('PRAGMA foreign_keys=ON')
        for path in sorted((ROOT / 'migrations').glob('*.sql')):
            if path.name >= '0006':
                copy.executescript(path.read_text(encoding='utf-8'))
        self.assertEqual(copy.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(copy.execute("SELECT effective_role,password_hash FROM users WHERE id='sup'").fetchone(), ('executive_chef', 'saved-hash'))
        self.assertEqual(copy.execute("SELECT effective_role,password_hash FROM users WHERE id='chef'").fetchone(), ('cuisine_head', 'head-hash'))
        self.assertEqual(copy.execute("SELECT user_id FROM sessions WHERE token_hash='session'").fetchone()[0], 'sup')
        self.assertEqual(copy.execute("SELECT supervisor_id FROM indents WHERE id='indent'").fetchone()[0], 'sup')
        self.assertEqual(copy.execute("SELECT outlet_id FROM user_outlets WHERE user_id='sup'").fetchone()[0], 'brigade')
        self.assertEqual(copy.execute("SELECT quantity,unit_cost_minor FROM outlet_stock WHERE item_id='item_01' AND outlet_id='brigade'").fetchone(), (7, None))
        self.assertEqual(copy.execute("SELECT json_extract(payload_json,'$.legacyIssuedQuantity') FROM requests WHERE id='issued'").fetchone()[0], 5)
        self.assertEqual(source.execute("SELECT role FROM users WHERE id='sup'").fetchone()[0], 'supervisor')
        with self.assertRaises(sqlite3.IntegrityError):
            copy.execute("UPDATE users SET effective_role='invalid' WHERE id='sup'")
        copy.close()
        source.close()
