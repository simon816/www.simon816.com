"use strict";

;(function(document){


    var editor = ace.edit("editor");

    editor.setTheme("ace/theme/chrome");

    var statusBar;
    var errorConsole;
    var fileList;
    var files = {};
    var fileOrdering = [];
    var activeFilename = null;

    function fixPanelWidth() {
        document.getElementById('editor').style.left = document.getElementById('file-panel').offsetWidth + 'px';
        document.getElementById('console').style.left = document.getElementById('file-panel').offsetWidth + 'px';
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('build-button').addEventListener('click', doBuild);
        document.getElementById('reset-button').addEventListener('click', resetState);
        document.getElementById('eg-select').addEventListener('change', exampleSelect);
        document.getElementById('new-file-btn').addEventListener('click', newFile);
        document.getElementById('eg-select').value = 'none';

        statusBar = document.getElementById('status-bar');
        statusBar.textContent = 'Ready';
        statusBar.style.color = '#42ff42';

        fileList = document.getElementById('file-list');

        errorConsole = document.getElementById('error-console');

        loadOrCreateState();
    });

    window.addEventListener('beforeunload', function() {
        saveState();
        return true;
    });

    var sampleFibCode = {
        asm: '.x 0x00\n.y 0x01\n.old_x 0x02\n.counter 0x03\n\nmain:\n    MOV #0, x\n    MOV #1, y\n    MOV #1, counter'
            +'\n    _loop:\n    PRINT "fib(", counter, ") = ", x\n    SYNC\n    ADD #1, counter\n    MOV x, old_x\n    '
            +'MOV y, x\n    ADD old_x, y\n    CMP #0, x\n    JGE _loop ; if not >=0 then x has overflowed',
        c: '#include <stdio.h>\n\nint x;\nint y;\nint old_x;\nint counter;\n\nvoid main() {\n    x = 0;\n    y = 1;\n    counter = 1;\n    '
            +'do {\n        printf("fib(%d) = %d", counter++, x);\n        sync;\n        old_x = x;\n        x = y;\n'
            +'        y += old_x;\n    } while(x >= 0);\n}\n',
        ir: 'preamble {\n    $all_players = selector a\n}\n\nfunction main {\n    preamble {\n        $x = define i32\n        $y = define i32\n'
            +'        $old_x = define i32\n        $counter = define i32\n        extern\n    }\n\n    entry:\n    $x = 0\n    $y = 1\n    $counter = 1\n'
            +'    branch :loop\n\n    loop:\n    $msg = text\n    text_append $msg, "fib("\n    text_append $msg, $counter\n    text_append $msg, ") = "\n'
            +'    text_append $msg, $x\n    text_send $msg, $all_players\n    set_command_block :post_tick\n\n    post_tick:\n    clear_command_block\n'
            +'    $counter += 1\n    $old_x = $x\n    $x = $y\n    $y += $old_x\n    rangebr $x, 0, NULL, :loop, :end\n\n    end:\n    ret\n}\n',
        cbl: 'include "Text"\ninclude "Game"\n\nint x;\nint y;\nint counter;\nint old_x;\n\nasync void main() {\n    x = 0;\n    y = 1;\n'
            +'    counter = 1;\n\    do {\n        Text t;\n        t << "fib(";\n        t.append_ref(counter);\n        t << ") = ";\n        t.append_ref(x);\n'
            +'        t.send_to_all();\n        counter++;\n        await Game.tick();\n        old_x = x;\n        x = y;\n        y += old_x;\n    } while(x >= 0);\n}'
    };

    var fibDpd = { name: 'fib.dpd', value: '[Datapack]\nnamespace = fib\nplace location = 0 56 0\nspawn location = ~ ~2 ~\n' };
    var examples = {
        'fib-asm': [ { name: 'fib.asm', value: sampleFibCode.asm }, fibDpd ],
        'fib-c': [ { name: 'fib.c', value: sampleFibCode.c }, fibDpd ],
        'fib-ir': [ { name: 'fib.ir', value: sampleFibCode.ir }, fibDpd ],
        'fib-cbl': [ { name: 'fib.cbl', value: sampleFibCode.cbl }, fibDpd ],
    };

    function exampleSelect(event) {
        var example = event.target.value;
        if (example === 'none' || (fileOrdering.length && !confirm("Clear files and load example code?"))) {
            return;
        }
        setExample(example);
    }

    function setExample(example) {
        if (example in examples) {
            resetState();
            var eg = examples[example];
            for (var i = 0; i < eg.length; i++) {
                var file = eg[i];
                addFile(file.name, file.value);
            }
            setFileActive(0);
        }
    }

    function loadOrCreateState() {
        var state = window.localStorage.getItem('assemblerState');
        if (state) {
            state = JSON.parse(state);
            for (var i = 0; i < state.fileOrdering.length; i++) {
                var file = state.fileOrdering[i];
                addFile(file, state.fileContent[file]);
            }
            setFilenameActive(state.activeFilename);
        } else {
            setExample('fib-cbl');
            saveState();
        }
    }

    function resetState() {
        for (var oldFile in files) {
            fileList.removeChild(files[oldFile].domNode);
        }
        fileOrdering = [];
        activeFilename = null;
        files = {};
        setFileActive(-1);
    }

    function saveState() {
        var content = {};
        for (var file in files) {
            content[file] = files[file].content;
        }
        if (activeFilename !== null) {
            content[activeFilename] = editor.getValue();
        }
        var state = {
            fileOrdering: fileOrdering,
            activeFilename: activeFilename,
            fileContent: content,
        };
        window.localStorage.setItem('assemblerState', JSON.stringify(state));
    }

    function newFile() {
        var filename = prompt('New file name:');
        if (!filename) {
            return;
        }
        if (filename in files) {
            alert(filename + ' already exists');
            return;
        }
        addFile(filename, '');
    }

    function addFile(filename, content) {
        fileOrdering.push(filename);
        var fileNode = document.createElement('div');
        files[filename] = { content: content, domNode: fileNode };
        fileNode.classList.add('file');
        var filenameNode = document.createElement('div');
        filenameNode.classList.add('filename');
        filenameNode.textContent = filename;
        var deleteBtn = document.createElement('div');
        deleteBtn.classList.add('delbtn');
        deleteBtn.textContent = 'X';
        deleteBtn.addEventListener('click', function (event) {
            var idx = fileOrdering.indexOf(filename);
            fileOrdering.splice(idx, 1);
            fileList.removeChild(fileNode);
            delete files[filename];
            if (filename === activeFilename) {
                activeFilename = null;
                // idx is now the index of the next file
                // Switch to next file unless there are no files after
                // Choose previous file in that case
                if (idx === fileOrdering.length) {
                    idx -= 1;
                }
                setFileActive(idx);
            }
        });
        fileNode.addEventListener('click', function(event) {
            if (event.target === deleteBtn) {
                return;
            }
            setFilenameActive(filename);
        });
        fileNode.appendChild(filenameNode);
        fileNode.appendChild(deleteBtn);
        fileList.appendChild(fileNode);
        setFileActive(fileOrdering.length - 1);
    }

    function setFilenameActive(filename) {
        var idx = fileOrdering.indexOf(filename);
        setFileActive(idx);
    }

    function setFileActive(idx) {
        if (activeFilename !== null) {
            files[activeFilename].content = editor.getValue();
            files[activeFilename].domNode.classList.remove('active');
        }
        fixPanelWidth();
        if (idx < 0 || idx >= fileOrdering.length) {
            editor.getSession().setMode('ace/mode/text');
            setEditor('');
            activeFilename = null;
            saveState();
            return;
        }
        var filename = fileOrdering[idx];
        activeFilename = filename;
        var fileInfo = files[filename];
        fileInfo.domNode.classList.add('active');
        editor.getSession().setMode(modeForFilename(filename));
        setEditor(fileInfo.content);
        saveState();
    }

    function setEditor(value) {
        editor.setValue(value);
        editor.gotoLine(0);
        editor.clearSelection();
    }

    function modeForFilename(filename) {
        if (filename.endsWith('.asm')) {
            return 'ace/mode/assembly_x86';
        }
        if (filename.endsWith('.c') || filename.endsWith('.cbl')) {
            return 'ace/mode/c_cpp';
        }
        if (filename.endsWith('.dpd')) {
            return 'ace/mode/ini';
        }
        return 'ace/mode/text';
    }

    function doBuild() {

        if (activeFilename !== null) {
            files[activeFilename].content = editor.getValue();
        }
        saveState();

        statusBar.textContent = 'Compiling...';
        statusBar.style.color = 'orange';
        var fileArg =  {};
        for (var filename in files) {
            fileArg[filename] = files[filename].content;
        }
        ajax.postJSON('.', {'files': fileArg}, function(data) {
            if (data.error) {
                statusBar.style.color = 'red';
                statusBar.textContent = 'Error! See console below';
                errorConsole.value = data.error;
            } else {
                errorConsole.value = '';
                statusBar.style.color = '#42ff42';
                statusBar.textContent = 'Complete';
                if (data.zip) {
                    var blob = b64toBlob(data.zip, 'application/zip');
                    var blobUrl = URL.createObjectURL(blob);
                    var download = document.createElement('a');
                    download.textContent = 'Download Datapack';
                    download.href = blobUrl;
                    download.download = data.namespace + '.zip';
                    statusBar.appendChild(download);
                }
                if (data.cleanup) {
                    var cleanup = document.createElement('a');
                    cleanup.textContent = 'Cleanup command';
                    cleanup.href = '#';
                    cleanup.addEventListener('click', function(event) {
                        event.preventDefault();
                        prompt('Cleanup command', data.cleanup);
                    });
                    statusBar.appendChild(cleanup);
                }
            }
        }, function(error) {
            statusBar.style.color = 'red';
            statusBar.textContent = 'Error! See console below';
            errorConsole.value = error;
        });
    }

    // https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
    function b64toBlob(b64Data, contentType, sliceSize) {
      contentType = contentType || '';
      sliceSize = sliceSize || 512;

      var byteCharacters = atob(b64Data);
      var byteArrays = [];

      for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);

        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
      }

      var blob = new Blob(byteArrays, {type: contentType});
      return blob;
    }

})(document);
