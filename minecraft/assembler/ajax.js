"use strict";

var ajax = new function () {
    function getXHR() {
        if (window.XMLHttpRequest) {
            return new XMLHttpRequest();
        } else {
            return new ActiveXObject("Microsoft.XMLHTTP");
        }
    }
    var _parse_args = function(args, method, type) {
        if (args.length == 0) {
            throw "no arguments";
        }
        var params = {}
        if (typeof args[0] == "string") {
            params['url'] = args[0]
        } else {
            params['success'] = args[0]['success']
        }
        if (args.length > 1) {
            if (typeof args[1] == "function") {
                params['success'] = args[1];
            }
        }
        if (args.length > 1 && method == 'POST') {
            if (type == 'json') {
                params['data'] = JSON.stringify(args[1])
            } else if (typeof args[1] == "object") {
                var data = []
                for (var key in args[1]) {
                    data.push(encodeURIComponent(key) + '=' + encodeURIComponent(args[1][key]))
                }
                params['data'] = data.join('&').replace(/%20/g, '+')
            } else if (typeof args[1] == "string") {
                params['data'] = args[1]
            }
        }
        if (args.length > 2 && method == 'POST') {
            if (typeof args[2] == "function") {
                params['success'] = args[2];
            }
        }
        if (args.length > 2 && method != 'POST') {
           if (typeof args[2] == "function") {
                params['error'] = args[2];
            }
        }
        if (args.length > 3 && method == 'POST') {
            if (typeof args[3] == "function") {
                params['error'] = args[3];
            }
        }
        if (args.length > 3 && method == 'GET') {
            if (typeof args[3] == 'function') {
                params['stateChange'] = args[3];
            }
        }
        return params
    }
    var _do_request = function (xhr, params) {
        xhr.send(params['data'] ? params['data'] : null);
        xhr.onreadystatechange = function () {
            if (params['stateChange']) {
                params['stateChange'].call(xhr)
            }
            if (xhr.readyState == 4) {
                var cbType
                switch (parseInt(xhr.status / 100)) {
                    case 2:
                    case 3:
                        cbType = 'success'
                        break
                    case 4:
                    case 5:
                        cbType = 'error'
                        break
                    default:
                        return
                }
                if (!params[cbType]) {
                    return;
                }
                var contentType = xhr.getResponseHeader('Content-Type')
                if (contentType == 'application/json') {
                    params[cbType].call(xhr, JSON.parse(xhr.responseText));
                } else {
                    params[cbType].call(xhr, xhr.responseText);
                }
            }
        }
    }
    this.get = function () {
        var params = _parse_args(arguments, 'GET')
        var xhr = getXHR()
        xhr.open("GET", params['url'], true);
        _do_request(xhr, params)
    }

    this.post = function () {
        var params = _parse_args(arguments, 'POST')
        var xhr = getXHR()
        xhr.open("POST", params['url'], true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        _do_request(xhr, params)
    }

    this.postJSON = function() {
        var params = _parse_args(arguments, 'POST', 'json')
        var xhr = getXHR()
        xhr.open("POST", params['url'], true);
        xhr.setRequestHeader("Content-type", "application/json");
        _do_request(xhr, params)
    }

    this.uploadPost = function () {
        var args = []
        for (var i = 0, len = arguments.length; i < len; i++) {
            args.push(arguments[i])
        }
        var files = args.splice(1, 1, '')[0]
        var params = _parse_args(args, 'POST')
        var formData = new FormData()
        for (var key in files) {
            formData.append(key, files[key])
        }
        var xhr = getXHR()
        xhr.open("POST", params['url'], true)
        params['data'] = formData
        _do_request(xhr, params)
    }
}
