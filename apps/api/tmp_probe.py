import json, urllib.request
url='http://127.0.0.1:8000/api/v1/auth/login'
data=json.dumps({'email':'admin@smartproduct.ai','password':'AdminPass123!'}).encode()
req=urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(req, timeout=20) as r:
    print(r.status)
    print(r.read().decode())
