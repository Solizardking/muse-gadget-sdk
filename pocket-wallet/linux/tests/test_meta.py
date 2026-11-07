import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from clawd_muse.service import dispatch

class Client:
    muse_model = 'muse-spark-1.3'
    muse_protocol = 'messages'
    def request(self, route, body=None):
        self.last = (route, body)
        return {'content': [{'type': 'redacted_thinking', 'data': 'opaque'}]}

class MetaTests(unittest.TestCase):
    def test_wire_request_and_encrypted_reasoning_are_preserved(self):
        client = Client()
        request = {'messages': [{'role': 'user', 'content': 'hi'}], 'tools': []}
        result = dispatch(client, 'clawd.muse', {'request': request})
        self.assertEqual(client.last[0], 'meta/messages')
        self.assertEqual(client.last[1]['messages'], request['messages'])
        self.assertEqual(result['content'][0]['data'], 'opaque')
        self.assertNotIn('model', request)
    def test_token_count_and_voice_use_selected_protocol(self):
        client = Client()
        dispatch(client, 'clawd.muse.tokens', {'request': {'messages': []}})
        self.assertEqual(client.last[0], 'meta/messages/count_tokens')
        dispatch(client, 'clawd.voice', {'transcript': 'sell SOL'})
        self.assertEqual(client.last[1]['protocol'], 'messages')
        self.assertNotIn('META_API_KEY', client.last[1])
    def test_rejects_unsupported_format_stream_and_request(self):
        for params in ({'request': {}, 'protocol': '../submit'}, {'request': {'stream': True}}, {'request': 'bad'}):
            with self.assertRaises(ValueError): dispatch(Client(), 'clawd.muse', params)
