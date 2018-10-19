from assembler import Assembler
from session import Session
from placer import Rel

from datapack import DataPackWriter
import zipfile
from io import BytesIO

from compiler.asm_extensions import CompilerSession, ExtendedAssembler
from compiler.compiler import Compiler
from compiler.preprocessor import Preprocessor
from compiler.lexer import Lexer
from compiler.parser_ import Parser

class VirtualDataPackWriter(DataPackWriter):

    def __init__(self, name):
        super().__init__(None, name, True)
        self.virtual = BytesIO()

    def open(self):
        self.zip = zipfile.ZipFile(self.virtual, 'w', zipfile.ZIP_DEFLATED)

    def output(self):
        return self.virtual.getvalue()

def do_assemble(data):
    try:
        return do_assemble_0(data)
    except Exception as e:
        return {'error': e.__class__.__name__ + ': ' + ' '.join(map(str, e.args))}

def do_compile(code):
    compiler = Compiler('string')
    pre = Preprocessor(code, 'input.c')
    code = pre.transform()
    parser = Parser(Lexer(code))
    return compiler.compile(parser.parse_program())

def do_assemble_0(data):
    code = data['code']
    args = data['args']
    lang = data['lang'] if 'lang' in data else 'asm'
    namespace = args['namespace'] if 'namespace' in args else None
    namespace = namespace or 'asm_generated'
    stack_size = int(args['stack-size']) if 'stack-size' in args else 8
    jump = args['jump'] if 'jump' in args else None
    place = args['place-location'] if 'place-location' in args else None
    place = place or '~1,~,~1'
    enable_sync = bool(args['enable-sync']) if 'enable-sync' in args else False
    asm_args = args['args'] if 'args' in args else {}
    spawn_loc = args['spawn-location'] if 'spawn-location' in args else '~ ~2 ~'

    A = Assembler
    if lang == 'c':
        code = do_compile(code)
        A = ExtendedAssembler

    assembler = A()
    assembler.enable_sync = enable_sync
    assembler.parse(code)

    parse_pos = lambda p: Rel(int(p[1:]) if p[1:] else 0) if p[0] == '~' else int(p)

    x, y, z = map(parse_pos, place.split(',', 3))

    writer = VirtualDataPackWriter(namespace)
    writer.open()
    if lang == 'c':
        session = CompilerSession((x, y, z), writer, namespace,
                                  stack_size=stack_size, args=asm_args)
    else:
        session = Session((x, y, z), writer, namespace,
                          stack_size=stack_size,args=asm_args)

    assembler.write_to_session(session)
    setup, cleanup = session.create_up_down_functions(spawn_loc)
    writer.close()

    jump_cmd = assembler.get_sub_jump_command(jump).resolve(session.scope) if jump else None

    return {
        'setup': setup,
        'cleanup': cleanup,
        'datapack': writer.output(),
        'jump': jump_cmd,
        'namespace': namespace
    }

