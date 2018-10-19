"use strict";

;(function(document){

    var statusBar;
    var lang = 'asm';

    var sampleCode = {
        asm: '.x 0x00\n.y 0x01\n.old_x 0x02\n.counter 0x03\n\nmain:\n    MOV #0, x\n    MOV #1, y\n    MOV #1, counter'
            +'\n    _loop:\n    PRINT "fib(", counter, ") = ", x\n    SYNC\n    ADD #1, counter\n    MOV x, old_x\n    '
            +'MOV y, x\n    ADD old_x, y\n    CMP #0, x\n    JGE _loop ; if not >=0 then x has overflowed',
        c: '#include <stdio.h>\n\nint x;\nint y;\nint old_x;\nint counter;\n\nvoid main() {\n    x = 0;\n    y = 1;\n    counter = 1;\n    '
            +'do {\n        printf("fib(%d) = %d", counter++, x);\n        sync;\n        old_x = x;\n        x = y;\n'
            +'        y += old_x;\n    } while(x >= 0);\n}\n'
    };

    var highlight = {
        asm: 'ace/mode/assembly_x86',
        c: 'ace/mode/c_cpp'
    };

    function doBuild() {

        var args = {};
        var argNames = ['namespace', 'stack-size', 'jump', 'place-location', 'spawn-location'];
        for (var i = 0; i < argNames.length; i++) {
            var arg = argNames[i];
            args[arg] = document.getElementById('arg-' + arg).value;
        }
        args['enable-sync'] = document.getElementById('arg-enable-sync').checked;

        var elArgs = document.getElementById('arg-args');
        args['args'] = {};
        for(var i = 0; i < elArgs.children.length; i++) {
            var pair = elArgs.children[i].children;
            if (pair[0].value) {
                args['args'][pair[0].value] = pair[1].value;
            }
        }

        statusBar.textContent = 'Assembling...';
        statusBar.style.color = 'orange';
        ajax.postJSON('.', {'code': editor.getValue(), 'args': args, 'lang': lang}, function(data) {
            if (data.error) {
                statusBar.style.color = 'red';
                statusBar.textContent = 'Error! ' + data.error;
            } else {
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
                var setup = document.createElement('a');
                setup.textContent = 'Setup command';
                setup.href = '#';
                setup.addEventListener('click', function(event) {
                    event.preventDefault();
                    prompt('Setup command', data.setup);
                });
                statusBar.appendChild(setup);
                var cleanup = document.createElement('a');
                cleanup.textContent = 'Cleanup command';
                cleanup.href = '#';
                cleanup.addEventListener('click', function(event) {
                    event.preventDefault();
                    prompt('Cleanup command', data.cleanup);
                });
                statusBar.appendChild(cleanup);
                if (data.jump) {
                    var jump = document.createElement('a');
                    jump.textContent = 'Jump command';
                    jump.href = '#';
                    jump.addEventListener('click', function(event) {
                        event.preventDefault();
                        prompt('Jump command', data.jump);
                    });
                    statusBar.appendChild(jump);
                }
            }
        }, function(error) {
            statusBar.style.color = 'red';
            statusBar.textContent = 'Error! ' + error;
        });
    }

    function argHandler(event) {
        var el = document.getElementById('arg-args');
        var empty = [];
        for(var i = 0; i < el.children.length; i++) {
            var pair = el.children[i].children;
            if (!pair[0].value && !pair[1].value) {
                empty.push(el.children[i]);
            }
        }
        if (!empty.length) {
            var div = document.createElement('div');
            div.appendChild(document.createElement('input'));
            div.appendChild(document.createElement('input'));
            el.appendChild(div);
        } else {
            var len = empty.length;
            while (len-- > 1) {
                el.removeChild(empty[empty.length - 1]);
            }
        }
    }

    function changeLang(event) {
        lang = event.target.value;
        resetEditor();
    }

    function resetEditor() {
        editor.getSession().setMode(highlight[lang]);
        editor.setValue(sampleCode[lang]);
        editor.gotoLine(0);
        editor.clearSelection();
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('build-button').addEventListener('click', doBuild);

        document.getElementById('arg-enable-sync').className = '';
        document.getElementById('arg-enable-sync').checked = true; // For the demo

        document.getElementById('arg-args').addEventListener('keyup', argHandler);

        statusBar = document.getElementById('status-bar');
        statusBar.textContent = 'Ready';
        statusBar.style.color = '#42ff42';

        document.getElementById('lang-select').addEventListener('change', changeLang);
        resetEditor();
    });

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
