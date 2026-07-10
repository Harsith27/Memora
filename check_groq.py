from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    root = Path(__file__).resolve().parent
    env_values = load_env_file(root / 'memora-backend' / '.env')

    api_key = os.environ.get('GROQ_API_KEY') or env_values.get('GROQ_API_KEY', '')
    model_name = os.environ.get('GROQ_MODEL') or env_values.get('GROQ_MODEL', 'llama-3.3-70b-versatile')
    base_url = os.environ.get('GROQ_BASE_URL') or env_values.get('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')

    api_key = api_key.strip()
    model_name = model_name.strip() or 'llama-3.3-70b-versatile'
    base_url = base_url.strip().rstrip('/') or 'https://api.groq.com/openai/v1'

    if not api_key:
        print('Error checking key: GROQ_API_KEY is missing from environment or memora-backend/.env')
        return 1

    request = urllib.request.Request(
        f'{base_url}/models',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        print(f'Error checking key: HTTP Error {error.code}: {error.reason}')
        return 1
    except Exception as error:
        print(f'Error checking key: {error}')
        return 1

    model = next((item for item in data.get('data', []) if item.get('id') == model_name), None)
    if model:
        print(f"Success! Model: {model['id']} | Active: {model.get('active')}")
        return 0

    available = ', '.join(item.get('id', '') for item in data.get('data', [])[:10] if item.get('id'))
    print(f'Key works, but {model_name} was not found in the model list.')
    if available:
        print(f'Available models: {available}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
