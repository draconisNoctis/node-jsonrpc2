var jsonrpc2 = require('../');

describe('node-jsonrpc2', function() {
	var adapter, rpc, interfaces;

	beforeEach(function() {
		adapter = {
			context: function(data) {
				return {
					data: data
				};
			},
			write: function(ctx, obj) {}
		}
		spyOn(adapter, 'write');
		interfaces = {
			fn: function() {},
			instance: {
				method: function() {}
			}
		}
		spyOn(interfaces, 'fn');
		spyOn(interfaces.instance, 'method');
		rpc = jsonrpc2(interfaces, adapter);
	});

	it('should return error on parse error', function() {
		rpc('{invalidjson}');

		expect(adapter.write).toHaveBeenCalled();
		expect(adapter.write.calls[0].args[1]).toEqual({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }});
	});

	var IGNORE = {};

	function requestExpectResponse(request, response, opt) {
		return function() {
			opt && opt.pre && opt.pre();
			runs(function() {
				if(opt && opt.runs) {
					opt.runs(request);
				} else {
					rpc(typeof request === 'string' ? request : JSON.stringify(request));
				}
			});

			var i = 0;
			waitsFor(function() {
				return i++ > 5;
			});

			runs(function() {
				if(IGNORE !== response) {
					expect(adapter.write.calls[0].args[1]).toEqual(response);
				}
				opt && opt.assert && opt.assert()
			});
		}
	}

	describe('jsonrpc errors', function() {
		it('should return error on invalid jsonrpc property', requestExpectResponse(
			{ id:'$$id$$' },
			{
				jsonrpc: '2.0', 
				error: { 
					code: -32600, 
					message: 'Invalid Request', 
					data: 'JSON RPC version is invalid or missing' 
				}, 
				id: '$$id$$'
			}
		));

		it('should not return error on invalid jsonrpc property for notification', requestExpectResponse(
			{},
			undefined
		));

		it('should return error on missing method property', requestExpectResponse(
			{ jsonrpc: '2.0', id:'$$id$$' },
			{
				jsonrpc: '2.0', 
				error: { 
					code: -32600, 
					message: 'Invalid Request', 
					data: 'JSON RPC method expected' 
				}, 
				id: '$$id$$'
			}
		));

		it('should not return error on missing method property for notification', requestExpectResponse(
			{ jsonrpc: '2.0' },
			undefined
		));

		it('should return error on unknown method property', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'foobar', id:'$$id$$' },
			{
				jsonrpc: '2.0', 
				error: { 
					code: -32601, 
					message: 'Method not found', 
					data: 'Method "foobar" not found' 
				}, 
				id: '$$id$$'
			}
		));

		it('should not return error on unknown method property for notification', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'foobar' },
			undefined
		));

		it('should return error on invalid jsonrpc property in batch', requestExpectResponse(
			[{ id:'$$id$$' }],
			[{
				jsonrpc: '2.0', 
				error: { 
					code: -32600, 
					message: 'Invalid Request', 
					data: 'JSON RPC version is invalid or missing' 
				}, 
				id: '$$id$$'
			}]
		));

		it('should not return error on invalid jsonrpc property in batch for notification', requestExpectResponse(
			[{}],
			[]
		));

		it('should return error on missing method property in batch', requestExpectResponse(
			[{ jsonrpc: '2.0', id:'$$id$$' }],
			[{
				jsonrpc: '2.0', 
				error: { 
					code: -32600, 
					message: 'Invalid Request', 
					data: 'JSON RPC method expected' 
				}, 
				id: '$$id$$'
			}]
		));

		it('should not return error on missing method property in batch for notification', requestExpectResponse(
			[{ jsonrpc: '2.0' }],
			[]
		));

		it('should return error on unknown method property in batch', requestExpectResponse(
			[{ jsonrpc: '2.0', method: 'foobar', id:'$$id$$' }],
			[{
				jsonrpc: '2.0', 
				error: { 
					code: -32601, 
					message: 'Method not found', 
					data: 'Method "foobar" not found' 
				}, 
				id: '$$id$$'
			}]
		));

		it('should not return error on unknown method property in batch for notification', requestExpectResponse(
			[{ jsonrpc: '2.0', method: 'foobar' }],
			[]
		));
	});

	describe('requests', function() {
		it('it should call registered function and return its result', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'fn', params: { foo: 'bar' }, id: '$$id$$' },
			{ jsonrpc: '2.0', result: '$$FOOBAR$$', id: '$$id$$' },
			{ pre: function() {
				interfaces.fn.andReturn('$$FOOBAR$$')	
			  }, 
			  assert: function() {
				expect(interfaces.fn).toHaveBeenCalled();
				expect(interfaces.fn.calls[0].args[0]).toEqual({ foo: 'bar' });
			}}
		));

		it('it should call registered instance method and return its result', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'instance.method', params: { foo: 'bar' }, id: '$$id$$' },
			{ jsonrpc: '2.0', result: '$$BAZ$$', id: '$$id$$' },
			{ pre: function() {
				interfaces.instance.method.andReturn('$$BAZ$$')	
			  }, 
			  assert: function() {
				expect(interfaces.instance.method).toHaveBeenCalled();
				expect(interfaces.instance.method.calls[0].args[0]).toEqual({ foo: 'bar' });
			}}
		));

		it('it should call instance method with correct context', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'instance.method', params: {}, id: '$$id$$' },
			IGNORE,
			{ pre: function() {
				interfaces.instance.method.andCallFake(function() {
					expect(this).toBe(interfaces.instance);
				});
			}}
		));

		it('it should return error on thrown exception', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'fn', id: '$$id$$' },
			{ jsonrpc: '2.0', error: { code: 500, message: 'exception message', data: 'exception data' }, id: '$$id$$' },
			{ pre: function() {
				interfaces.fn.andCallFake(function() {
					throw { code: 500, message: 'exception message', data: 'exception data' };
				});
			}}
		))
	});

	describe('notifications', function() {
		it('it should call registered function and return undefined', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'fn', params: { foo: 'bar' } },
			undefined,
			{ pre: function() {
				interfaces.fn.andReturn('$$FOOBAR$$')	
			  }, 
			  assert: function() {
				expect(interfaces.fn).toHaveBeenCalled();
				expect(interfaces.fn.calls[0].args[0]).toEqual({ foo: 'bar' });
			}}
		));

		it('it should call registered instance method and return undefined', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'instance.method', params: { foo: 'bar' } },
			undefined,
			{ pre: function() {
				interfaces.instance.method.andReturn('$$BAZ$$')	
			  }, 
			  assert: function() {
				expect(interfaces.instance.method).toHaveBeenCalled();
				expect(interfaces.instance.method.calls[0].args[0]).toEqual({ foo: 'bar' });
			}}
		));

		it('it should call instance method with correct context', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'instance.method', params: {} },
			IGNORE,
			{ pre: function() {
				interfaces.instance.method.andCallFake(function() {
					expect(this).toBe(interfaces.instance);
				});
			}}
		));

		it('it should return error on thrown exception', requestExpectResponse(
			{ jsonrpc: '2.0', method: 'fn' },
			undefined,
			{ pre: function() {
				interfaces.fn.andCallFake(function() {
					throw { code: 500, message: 'exception message', data: 'exception data' };
				});
			}}
		))
	});

	describe('batch', function() {
		it('it should call registered function and return its result', requestExpectResponse(
			[
				{ jsonrpc: '2.0', method: 'fn', params: { foo: 'bar' }, id: '$$id$$' },
				{ jsonrpc: '2.0', method: 'fn', params: { foobar: 'baz' } }
			],
			[{ jsonrpc: '2.0', result: '$$FOOBAR$$', id: '$$id$$' }],
			{ pre: function() {
				interfaces.fn.andReturn('$$FOOBAR$$')	
			  }, 
			  assert: function() {
				expect(interfaces.fn).toHaveBeenCalled();
				expect(interfaces.fn.calls[0].args[0]).toEqual({ foo: 'bar' });
				expect(interfaces.fn.calls[1].args[0]).toEqual({ foobar: 'baz' });
			}}
		));

		it('it should call registered instance method and return its result', requestExpectResponse(
			[
				{ jsonrpc: '2.0', method: 'instance.method', params: { foo: 'bar' }, id: '$$id$$' },
				{ jsonrpc: '2.0', method: 'instance.method', params: { foobar: 'baz' } }
			],
			[{ jsonrpc: '2.0', result: '$$BAZ$$', id: '$$id$$' }],
			{ pre: function() {
				interfaces.instance.method.andReturn('$$BAZ$$')	
			  }, 
			  assert: function() {
				expect(interfaces.instance.method).toHaveBeenCalled();
				expect(interfaces.instance.method.calls[0].args[0]).toEqual({ foo: 'bar' });
				expect(interfaces.instance.method.calls[1].args[0]).toEqual({ foobar: 'baz' });
			}}
		));

		it('it should call instance method with correct context', requestExpectResponse(
			[
				{ jsonrpc: '2.0', method: 'instance.method', params: {}, id: '$$id$$' },
				{ jsonrpc: '2.0', method: 'instance.method', params: {} }
			],
			IGNORE,
			{ pre: function() {
				interfaces.instance.method.andCallFake(function() {
					expect(this).toBe(interfaces.instance);
				});
			}}
		));

		it('it should return error on thrown exception', requestExpectResponse(
			[
				{ jsonrpc: '2.0', method: 'fn', id: '$$id$$' },
				{ jsonrpc: '2.0', method: 'fn' }
			],
			[{ jsonrpc: '2.0', error: { code: 500, message: 'exception message', data: 'exception data' }, id: '$$id$$' }],
			{ pre: function() {
				interfaces.fn.andCallFake(function() {
					throw { code: 500, message: 'exception message', data: 'exception data' };
				});
			}}
		))
	});

	describe('http adapter', function() {
		var req, res, body;
		beforeEach(function() {
			req = { body: '' }
			res = {
				writeHead: function() {},
				header: function() {},
				end: function() {}
			}
			spyOn(res, 'writeHead');
			spyOn(res, 'header');
			spyOn(res, 'end');

			rpc = jsonrpc2.http(interfaces);
		});

		describe('context', function() {
			it('should return context from params', requestExpectResponse(
				{ jsonrpc: '2.0', method: 'fn', id: '$$id$$' },
				IGNORE,
				{ runs: function(r) {
					req.body = r;
					rpc(req, res);
				  }, 
				  assert: function() {
					expect(interfaces.fn).toHaveBeenCalled();
					expect(interfaces.fn.calls[0].args[1].request).toBe(req);
					expect(interfaces.fn.calls[0].args[1].response).toBe(res);
					expect(interfaces.fn.calls[0].args[1].data).toBe(req.body);
				}}
			));

			it('should write the response', requestExpectResponse(
				{ jsonrpc: '2.0', method: 'fn', id: '$$id$$' },
				IGNORE,
				{ pre: function() {
					interfaces.fn.andReturn('$$FOOBAR$$')
				  },
				  runs: function(r) {
					req.body = r;
					rpc(req, res);
				  },
				  assert: function() {
					expect(res.writeHead).toHaveBeenCalledWith(200);
					expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/json');
					expect(res.end).toHaveBeenCalledWith('{"jsonrpc":"2.0","result":"$$FOOBAR$$","id":"$$id$$"}');
				}}
			));

			it('should write the response for notification', requestExpectResponse(
				{ jsonrpc: '2.0', method: 'fn' },
				IGNORE,
				{ pre: function() {
					interfaces.fn.andReturn('$$FOOBAR$$')
				  },
				  runs: function(r) {
					req.body = r;
					rpc(req, res);
				  },
				  assert: function() {
					expect(res.writeHead).toHaveBeenCalledWith(200);
					expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/json');
					expect(res.end).toHaveBeenCalledWith(undefined);
				}}
			));
		});
	});
});