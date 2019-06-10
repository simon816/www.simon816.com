from assembler import Assembler
from session import Session
from placer import Rel

from datapack import DataPackWriter
import zipfile
from io import BytesIO

from compiler.asm_extensions import CompilerSession, ExtendedAssembler
from compiler.compiler import Compiler
from compiler.preprocessor import Preprocessor
from compiler.parser_ import Parser

from cmd_ir.reader import Reader
from cmd_ir.allocator import default_allocation

class VirtualDataPackWriter(DataPackWriter):

    def __init__(self, name):
        super().__init__(None, name, True)
        self.virtual = BytesIO()

    def open(self):
        self.zip = zipfile.ZipFile(self.virtual, 'w', zipfile.ZIP_DEFLATED)

    def output(self):
        return self.virtual.getvalue()

def do_build(data):
    try:
        return do_build_0(data)
    except Exception as e:
        return {'error': e.__class__.__name__ + ': ' + ' '.join(map(str, e.args))}

def do_c_compile(code, pos, writer, namespace, spawn_loc, gen_cleanup, jump):
    pre = Preprocessor(code, 'input.c')
    code = pre.transform()
    compiler = Compiler('token')
    parser = Parser(compiler.get_type_names())
    out = compiler.compile(parser.parse_program(code))

    class OutputReader:
        def __init__(self, output):
            self.output = output
            self.lineno = 1

        def __iter__(self):
            return iter(self.output)

    assembler = ExtendedAssembler()
    assembler.consume_reader(OutputReader(out))
    assembler.finish()
    page_size = 64
    if not assembler.use_mem:
        page_size = 0
    session = CompilerSession(pos, writer, namespace, spawn_loc, gen_cleanup, page_size)
    return assembler_write_session(assembler, session, jump)

def do_assemble(code, pos, writer, namespace, spawn_loc, gen_cleanup, jump):
    assembler = Assembler()
    assembler.parse(code)
    assembler.finish()
    session = Session(pos, writer, namespace, spawn_loc, gen_cleanup)
    return assembler_write_session(assembler, session, jump)

def assembler_write_session(assembler, session, jump):
    cleanup = assembler.write_to_session(session)
    if jump and assembler.top.lookup_func('sub_' + jump) is not None:
        jump_cmd = assembler.get_sub_jump_command(jump).resolve(session.scope)
    else:
        jump_cmd = None
    return cleanup, jump_cmd

def do_ir_compile(code, pos, writer, namespace, spawn_loc, gen_cleanup, jump):
    reader = Reader()
    top = reader.read(code)
    default_allocation(top)
    session = Session(pos, writer, namespace, spawn_loc, gen_cleanup)
    cleanup = session.load_from_top(top)
    jump_cmd = None
    if jump:
        jfunc = top.lookup_func(jump)
        if jfunc is not None:
            from commands import Function
            jump_cmd = Function(jfunc.global_name).resolve(session.scope)
    return cleanup, jump_cmd

def do_build_0(data):
    code = data['code']
    args = data['args']
    lang = data['lang'] if 'lang' in data else 'asm'
    namespace = args['namespace'] if 'namespace' in args else None
    namespace = namespace or 'generated'
    jump = args['jump'] if 'jump' in args else None
    place = args['place-location']
    spawn_loc = args['spawn-location'] if 'spawn-location' in args else '~ ~2 ~'
    gen_cleanup = 'gen-cleanup' in args and bool(args['gen-cleanup'])

    parse_pos = lambda p: Rel(int(p[1:]) if p[1:] else 0) if p[0] == '~' else int(p)
    pos = tuple(map(parse_pos, place.split(',', 3)))

    writer = VirtualDataPackWriter(namespace)
    writer.open()

    args = (code, pos, writer, namespace, spawn_loc, gen_cleanup, jump)
    if lang == 'c':
        cleanup, jump_cmd = do_c_compile(*args)
    elif lang == 'asm':
        cleanup, jump_cmd = do_assemble(*args)
    elif lang == 'ir':
        cleanup, jump_cmd = do_ir_compile(*args)

    writer.close()

    return {
        'cleanup': cleanup,
        'datapack': writer.output(),
        'jump': jump_cmd,
        'namespace': namespace
    }

