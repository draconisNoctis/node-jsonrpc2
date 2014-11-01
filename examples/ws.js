var WebSocketServer = require('ws').Server,
	jsonrpc = require('../');

var wss = new WebSocketServer({ port: 8080 });

var rpc = jsonrpc.ws({
	echo: function(params) {
		return params;
	}
});

wss.on('connection', function(ws) {
	ws.on('message', function(message) {
		rpc(ws, message);
	});
})
