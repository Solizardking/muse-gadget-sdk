import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from clawd_muse.musebook import Client
from clawd_muse.service import dispatch

class FakeClient:
    def __init__(self): self.calls = []
    def request(self, route, body=None): self.calls.append((route, body)); return {'quote_id': 'q'}
    def chart(self, mint, tf): return b'jpeg'

class CompanionTests(unittest.TestCase):
    def test_commands_never_submit(self):
        client = FakeClient()
        for command in ('clawd.buy', 'clawd.sell', 'clawd.quote'):
            result = dispatch(client, command, {'input_mint': 'SOL', 'output_mint': 'USDC', 'amount': '123'})
            self.assertTrue(result['requires_wallet_approval'])
        self.assertEqual([c[0] for c in client.calls], ['quote'] * 3)
    def test_config_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.toml'
            path.write_text('base_url="http://localhost:8787"\ndevice_token="test"')
            path.chmod(0o644)
            with self.assertRaises(ValueError): Client.from_config(path)
            path.chmod(0o600)
            self.assertEqual(Client.from_config(path).token, 'test')
    def test_insecure_remote_rejected(self):
        with self.assertRaises(ValueError): Client('http://wallet.example', 'test')
    def test_unknown_command_rejected(self):
        with self.assertRaises(ValueError): dispatch(FakeClient(), 'clawd.execute', {})
