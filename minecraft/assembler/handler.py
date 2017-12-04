from flask import Flask
from flask import json
from flask import request

from web_app_hook import do_assemble

app = Flask(__name__)

@app.route('/minecraft/assembler/', methods=['POST'])
def serve_assembler():
    resp_headers = {
        'Content-Type': 'application/json'
    }
    if request.headers['Content-Type'] == 'application/json':
        return json.dumps(handle_assemble(request.json)), resp_headers
    else:
        return '{"error": "Bad Request"}', resp_headers

def handle_assemble(data):
    if 'code' not in data or 'args' not in data:
        return {'error': 'Missing data'}
    try:
        if 'stack-size' in data['args']:
            data['args']['stack-size'] = int(data['args']['stack-size'])
        if 'enable-sync' in data['args']:
            data['args']['enable-sync'] = bool(data['args']['enable-sync'])
        if 'args' in data['args'] and not data['args']['args']:
            del data['args']['args']
        output = do_assemble(data)
        if 'error' in output:
            return output
        return post_process(output)
    except Exception as e:
        raise Exception('An internal error occurred while running the assembler')

def post_process(output):
    setup = '/' + output['setup']
    cleanup = '/' + output['cleanup']
    functions = output['functions']
    jump = output['jump']
    namespace = output['namespace']
    if jump:
        jump = '/' + jump

    from io import BytesIO
    from zipfile import ZipFile, ZIP_DEFLATED
    from base64 import encodestring as b64_encode
    zipio = BytesIO()
    with ZipFile(zipio, 'w', compression=ZIP_DEFLATED) as zip:
        for fname, commands in functions:
            zip.writestr('%s.mcfunction' % fname,
                         '\n'.join(commands).encode('utf8'))

    return {
        'zip': b64_encode(zipio.getbuffer()).decode('utf8'),
        'setup': setup,
        'cleanup': cleanup,
        'jump': jump,
        'namespace': namespace
    }

application = app

if __name__ == '__main__':
    application.run()
