import urllib.request
import json

# Paste your actual key inside the quotes below
api_key = "your_api_key_here"
url = "https://api.groq.com/openai/v1/models"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        # Find your exact model
        model = next((m for m in data.get("data", []) if m.get("id") == "llama-3.1-8b-instant"), None)
        if model:
            print(f"Success! Model: {model['id']} | Active: {model['active']}")
        else:
            print("Key works, but couldn't locate llama-3.1-8b-instant in the model list.")
except Exception as e:
    print(f"Error checking key: {e}")
