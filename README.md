node-jsonrpc2
===

Installation
---

	$ npm install node-jsonrpc2

Changelog
---

### 0.1.0  
 - Initial version  
 - http/express support  

Usage
---

### express

	var express = require('express'),
		jsonrpc = require('node-jsonrpc2'),
		app = express();

	app.post('/rpc', jsonrpc.http({
		echo: function(params) {
			return params;
		}
	}));

	app.listen(8080);

### http

	var http = require('http'),
		jsonrpc = require('node-jsonrpc2'),
		rpc = jsonrpc.http({
			echo: function(params) {
				return params;
			}
		});

	http.createServer(function(req, res) {
		if('/rpc' === req.url && 'POST' === req.method) {
			var data = '';
			req.on('data', function(d) {
				data += d;
			});
			req.on('end', function() {
				rpc(req, res, data);
			});
		}
	}).listen(8080);

### ws

	TODO

API
---

For registered functions	

	>> { "jsonrpc": "2.0", "method": "echo", "params": { "foo": "bar" }, "id": 1 }

	require('node-jsonrpc2').http({
		echo: function(params, ctx) {
			// params = { foo: "bar" }
			// ctx = {
			//	request: <http request>,
			//	response: <http response>,
			//	id: 1
			// }

			// return value or promise
			return params;
		}
	});

	<< { "jsonrpc": "2.0", "result": { "foo": "bar" }, "id": 1 }

For registered objects/services

	>> { "jsonrpc": "2.0", "method": "service.echo", "params": { "foo": "bar" }, "id": 1 }

	require('node-jsonrpc2').http({
		service {
			echo: function(params, ctx) {
				return params;
			}
		}
	});

	<< { "jsonrpc": "2.0", "result": { "foo": "bar" }, "id": 1 }
