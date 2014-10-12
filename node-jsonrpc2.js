var Q = require('q');

module.exports = jsonrpc2;
function jsonrpc2(interfaces, adapter) {
	return function() {
		var ctx = adapter.context.apply(null, arguments);

		if('string' === typeof ctx.data) {
			try {
				ctx.data = JSON.parse(ctx.data);
			} catch(e) {
				adapter.write(ctx, error(-32700, 'Parse error'));
				return;
			}
		}

		var promise;
		if(Array.isArray(ctx.data)) {
			promise = Q.all(ctx.data.map(function(data) { 
				return handle(data, interfaces, ctx) 
			})).then(function(response) {
				return response.filter(function(response) {
					return !!response;
				})
			});
		} else {
			promise = Q.fcall(handle, ctx.data, interfaces, ctx);
		}

		promise.then(function(response) {
			adapter.write(ctx, response);
		});
	}

	
}

module.exports.http = function http(interfaces) {
	return jsonrpc2(interfaces, {
		context: function(req, res) {
			return {
				request: req,
				response: res,
				data: req.body
			}
		},
		write: function(ctx, obj) {
			ctx.response.writeHead(200);
			ctx.response.header('Content-Type', 'application/json');
			ctx.response.end(obj ? JSON.stringify(obj) : undefined);
		}
	})
}

function handle(data, interfaces, ctx) {
	try {
		if('2.0' !== data.jsonrpc) {
			return data.id !== undefined ? error(-32600, 'Invalid Request', 'JSON RPC version is invalid or missing', data.id) : undefined;
		}
		
		if(!('method' in data)) {
			return data.id !== undefined ? error(-32600, 'Invalid Request', 'JSON RPC method expected', data.id) : undefined;
		}

		var method;
		if('function' === typeof interfaces[data.method]) {
			method = interfaces[data.method];
		} else {
			var index = data.method.lastIndexOf('.'),
				namespace = -1 === index ? '' : data.method.substr(0, index),
				methodName = -1 === index ? data.method : data.method.substr(index + 1);

			if('object' === typeof interfaces[namespace] && 'function' === typeof interfaces[namespace][methodName]) {
				method = function(params, ctx) {
					return interfaces[namespace][methodName].call(interfaces[namespace], params, ctx);
				}
			}
		}

		if(!method) {
			return data.id !== undefined ? error(-32601, 'Method not found', 'Method "' + data.method + '" not found', data.id) : undefined;
		}

		ctx.id = data.id;
		var promise = Q.fcall(method, data.params, ctx);

		if(!data.id) {
			return;
		}

		return promise.then(function(response) {
			return result(response, data.id)
		}, function(err) {
			return error(err.code, err.message, err.data, data.id);
		});


		
	} catch(e) {
		return error(-32603, 'Internal error', e, data.id);
	}
}

function error(code, message, data, id) {
	return {
		jsonrpc: '2.0',
		error: {
			code: code,
			message: message,
			data: data
		},
		id: id
	};
}

function result(result, id) {
	return {
		jsonrpc: '2.0',
		result: undefined === result ? null : result,
		id: id
	};
}
