import os
import tempfile
import random
import mcc.cli

def do_build(data):
    try:
        return do_build_0(data)
    except Exception as e:
        return {'error': e.__class__.__name__ + ': ' + ' '.join(map(str, e.args))}

def do_build_0(data):

    errmsg = [None]
    def handle_error(message):
        errmsg[0] = message

    def handle_exit(status=0, message=None):
        handle_error('Exit: %s' % (message or ''))

    def handle_fatal(msg):
        raise Exception(msg)

    files = data['files']
    if not files:
        return {'error': 'No files to compile'}
    with tempfile.TemporaryDirectory() as tmpdir:
        out = os.path.join(tmpdir, 'out%d' % random.randint(0, 1<<32))
        arglist = ['-o', out]
        for name, content in files.items():
            realpath = os.path.normpath(os.path.join(tmpdir, name))
            assert realpath.startswith(tmpdir + '/'), "Path escaping tmpdir %s" \
                   % realpath
            with open(realpath, 'w') as f:
                f.write(content)
            arglist.append(realpath)

        parser = mcc.cli.build_argparser()
        parser.error = handle_error
        parser.exit = handle_exit
        args = parser.parse_args(arglist)
        if errmsg[0] is not None:
            return {'error': errmsg[0]}
        mcc.cli.fatal = handle_fatal
        mcc.cli.run_with_args(args)

        with open(out + '.zip', 'rb') as f:
            datapack = f.read()

        return {
            'cleanup': None, # TODO
            'datapack': datapack,
        }

