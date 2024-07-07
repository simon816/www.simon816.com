from flask import Flask
from flask import json
from flask import request

from web_app_hook import do_build

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
    if 'files' not in data:
        return {'error': 'Missing data'}
    try:
        output = do_build(data)
        if 'error' in output:
            return output
        return post_process(output)
    except Exception as e:
        raise Exception('An internal error occurred while running the compiler')

def post_process(output):
    cleanup = output['cleanup']
    if cleanup:
        cleanup = '/' + cleanup
    datapack = output['datapack']

    from base64 import encodebytes as b64_encode
    return {
        'zip': b64_encode(datapack).decode('utf8'),
        'cleanup': cleanup,
        'namespace': output['namespace'],
    }

application = app

if __name__ == '__main__':
    application.run()
