import json
import os
import stat
import tomllib
from urllib.parse import urlparse, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

class Client:
    def __init__(self, base_url, token, wallet=None, muse_model='muse-spark-1.3', muse_protocol='responses'):
        url = urlparse(base_url)
        if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')):
            raise ValueError('Use HTTPS, or HTTP on localhost only.')
        self.base_url, self.token, self.wallet = base_url.rstrip('/'), token, wallet
        if muse_protocol not in ('responses', 'chat/completions', 'messages'):
            raise ValueError('Choose a supported Muse API format.')
        self.muse_model, self.muse_protocol = muse_model, muse_protocol

    @classmethod
    def from_config(cls, path):
        info = os.stat(path)
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) & 0o077:
            raise ValueError('Config must be a regular file with permissions 0600.')
        with open(path, 'rb') as handle:
            cfg = tomllib.load(handle)
        return cls(cfg['base_url'], cfg['device_token'], cfg.get('wallet'),
                   cfg.get('muse_model', 'muse-spark-1.3'), cfg.get('muse_protocol', 'responses'))

    def request(self, route, body=None, binary=False):
        data = None if body is None else json.dumps(body).encode()
        req = Request(self.base_url + '/api/gadget/' + route, data=data,
                      headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urlopen(req, timeout=190 if route.startswith('meta/') or route == 'voice' else 20) as response:
                result = response.read(1024 * 1024 + 1)
                if len(result) > 1024 * 1024:
                    raise ValueError('Response too large.')
                return result if binary else json.loads(result)
        except HTTPError as exc:
            raise ValueError(f'Pocket Wallet HTTP {exc.code}. Reconnect if the session expired.') from None
        except URLError:
            raise ValueError('Pocket Wallet unavailable. Check the API URL and connection.') from None

    def chart(self, mint, tf='1h', format='jpeg'):
        return self.request('chart?' + urlencode({'mint': mint, 'tf': tf, 'format': format}), binary=True)
