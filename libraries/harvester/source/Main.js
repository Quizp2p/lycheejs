
lychee.define('harvester.Main').requires([
	'lychee.Input',
	'lychee.data.JSON',
	'harvester.data.Host',
	'harvester.net.Server',
	'harvester.mod.Fertilizer',
	'harvester.mod.Package',
	'harvester.mod.Server',
	'harvester.serve.API',
	'harvester.serve.File',
	'harvester.serve.Redirect'
]).includes([
	'lychee.event.Emitter'
]).exports(function(lychee, harvester, global, attachments) {

	var _JSON = lychee.data.JSON;


	/*
	 * HELPERS
	 */

	var _LIBRARIES  = {};
	var _PROJECTS   = {};
	var _PUBLIC_IPS = (function() {

		var os = null;

		try {
			os = require('os');
		} catch(e) {
		}


		if (os !== null) {


			var candidates = [];


			Object.values(os.networkInterfaces()).forEach(function(iface) {

				iface.forEach(function(alias) {

					if (alias.internal === false) {

						if (alias.family === 'IPv6' && alias.scopeid === 0) {
							candidates.push('[' + alias.address + ']');
						} else if (alias.family === 'IPv4') {
							candidates.push(alias.address);
						}

					}

				});

			});


			return candidates.unique();

		}


		return [];

	})();

	var _process_admin = function(data, ready) {

		var host = this.getHost('admin');
		var url  = data.headers.url || null;

		if (host !== null && url !== null) {

			var parameters = {};

			if (data.headers.method.match(/PUT|POST/)) {
				parameters = _JSON.decode(data.payload) || {};
			}


			var tmp = data.headers.url.split('?')[1] || '';
			if (tmp.length > 0) {

				url = data.headers.url.split('?')[0];
				tmp.split('&').forEach(function(value) {

					var key = value.split('=')[0];
					var val = value.split('=')[1];


					if (!isNaN(parseInt(val, 10))) {
						parameters[key] = parseInt(val, 10);
					} else if (val === 'true') {
						parameters[key] = true;
					} else if (val === 'false') {
						parameters[key] = false;
					} else if (val === 'null') {
						parameters[key] = null;
					} else {
						parameters[key] = val;
					}

				});

			}


			if (Object.keys(parameters).length > 0) {
				data.headers.parameters = parameters;
			}


			if (harvester.serve.API.can(host, url) === true) {

				harvester.serve.API.process(host, url, data, ready);
				return true;

			}

		}


		ready(null);

		return false;

	};

	var _process_server = function(data, ready) {

		if (data.headers.host === 'admin') {
			ready(null);
			return false;
		}


		var host = this.getHost(data.headers.host);
		var url  = data.headers.url || null;

		if (host !== null && url !== null) {

			var parameters = {};

			var tmp = data.headers.url.split('?')[1] || '';
			if (tmp.length > 0) {

				url = data.headers.url.split('?')[0];
				tmp.split('&').forEach(function(value) {

					var key = value.split('=')[0];
					var val = value.split('=')[1];


					if (!isNaN(parseInt(val, 10))) {
						parameters[key] = parseInt(val, 10);
					} else if (val === 'true') {
						parameters[key] = true;
					} else if (val === 'false') {
						parameters[key] = false;
					} else if (val === 'null') {
						parameters[key] = null;
					} else {
						parameters[key] = val;
					}

				});

			}


			if (Object.keys(parameters).length > 0) {
				data.headers.parameters = parameters;
			}


			if (harvester.serve.API.can(host, url) === true) {

				harvester.serve.API.process(host, url, data, ready);
				return true;

			} else if (harvester.serve.File.can(host, url) === true) {

				harvester.serve.File.process(host, url, data, ready);
				return true;

			} else if (harvester.serve.Redirect.can(host, url) === true) {

				harvester.serve.Redirect.process(host, url, data, ready);
				return true;

			}

		}


		ready(null);

		return false;

	};



	/*
	 * FEATURE DETECTION
	 */

	var _defaults = {

		port:   null,
		hosts:  null,

		server: {
			host: null,
			port: 8080
		}

	};


	(function(libraries, projects) {

		var filesystem = new harvester.data.Filesystem();


		filesystem.dir('/libraries').filter(function(value) {
			return !value.match(/README\.md/);
		}).forEach(function(id) {

			var info1 = filesystem.info('/libraries/' + id + '/lychee.pkg');
			if ((info1 !== null && info1.type === 'file')) {
				libraries[id] = new harvester.data.Project(id, '/libraries/' + id);
			}

		});

		filesystem.dir('/projects').filter(function(value) {
			return !value.match(/cultivator|README\.md/);
		}).forEach(function(id) {

			var info1 = filesystem.info('/projects/' + id + '/index.html');
			var info2 = filesystem.info('/projects/' + id + '/lychee.pkg');
			if ((info1 !== null && info1.type === 'file') || (info2 !== null && info2.type === 'file')) {
				projects[id] = new harvester.data.Project(id, '/projects/' + id);
			}

		});

		filesystem.dir('/projects/cultivator').filter(function(value) {
			return !value.match(/design|index\.html|robots\.txt/);
		}).forEach(function(id) {

			var info1 = filesystem.info('/projects/cultivator/' + id + '/index.html');
			var info2 = filesystem.info('/projects/cultivator/' + id + '/lychee.pkg');
			if ((info1 !== null && info1.type === 'file') || (info2 !== null && info2.type === 'file')) {
				projects['cultivator/' + id] = new harvester.data.Project('cultivator/' + id, '/projects/cultivator/' + id);
			}

		});

	})(_LIBRARIES, _PROJECTS);



	/*
	 * IMPLEMENTATION
	 */

	var Class = function(settings) {

		this.settings = lychee.extendunlink({}, _defaults, settings);
		this.defaults = lychee.extendunlink({}, this.settings);

		this.hosts     = {};
		this.modules   = {};
		this.server    = null;


		if (settings.hosts instanceof Object) {

			for (var id in settings.hosts) {

				var project = settings.hosts[id];
				if (project === null) {

					this.setHost(id, null, null);

				} else {

					var cache = _PROJECTS[project] || null;
					if (cache !== null) {
						this.setHost(id, null, [ cache ]);
					}

				}

			}

		}


		if (typeof settings.port === 'number') {
			this.settings.server.port = (settings.port | 0);
		}


		this.setHost('admin', null, null);


		lychee.event.Emitter.call(this);


		/*
		 * INITIALIZATION
		 */

		this.bind('load', function() {

			var settings = this.settings.server || null;
			if (settings !== null) {

				this.admin  = new harvester.net.Server({ port: 4848 });
				this.server = new harvester.net.Server(settings);

				this.admin.bind('serve', function(data, ready) {
					_process_admin.call(this, data, ready);
				}, this);

				this.server.bind('serve', function(data, ready) {
					_process_server.call(this, data, ready);
				}, this);

			}

		}, this, true);

		this.bind('init', function() {

			var settings = this.settings.server || null;
			if (settings !== null) {

				this.admin.connect();
				this.server.connect();


				var port  = this.server.port;
				var hosts = Object.keys(this.hosts).filter(function(host) {
					return host !== 'admin';
				}).map(function(host) {

					if (host.indexOf(':') !== -1) {
						return 'http://[' + host + ']:' + port;
					} else {
						return 'http://' + host + ':' + port;
					}

				});

				console.log('\n\n');
				console.log('Open your web browser and surf to one of the following hosts:');
				console.log('\n');
				hosts.forEach(function(host) {
					console.log(host);
				});
				console.log('\n\n');

			}

		}, this, true);


		(function(libraries, projects) {

			libraries.forEach(function(library, l) {

				if (harvester.mod.Package.can(library) === true) {
					harvester.mod.Package.process(library);
				}

				if (harvester.mod.Fertilizer.can(library) === true) {
					harvester.mod.Fertilizer.process(library);
				}

			});

			setTimeout(function() {

				projects.forEach(function(project, p) {

					if (harvester.mod.Package.can(project) === true) {
						harvester.mod.Package.process(project);
					}

					if (harvester.mod.Server.can(project) === true) {
						harvester.mod.Server.process(project);
					}


					if (harvester.mod.Fertilizer.can(project) === true) {

						setTimeout(function() {
							harvester.mod.Fertilizer.process(project);
						}, p * 2000);

					}

				});

			}, libraries.length * 1000);

		})(Object.values(_LIBRARIES), Object.values(_PROJECTS));



		/*
		 * INITIALIZATION: DEVELOPMENT MODE
		 */

		if (settings.hosts['localhost'] === null) {

			this.bind('init', function() {

				if (this.server !== null) {

					this.server.bind('serve', function(data, ready) {

						var host = this.getHost(data.headers.host);
						if (host === null) {
							this.setHost(data.headers.host, null, null);
						}

					}, this);

				}

			}, this);

			_PUBLIC_IPS.forEach(function(ip) {
				this.setHost(ip, null, null);
			}.bind(this));

			setInterval(function() {

				Object.values(_LIBRARIES).forEach(function(library) {

					if (harvester.mod.Package.can(library) === true) {
						harvester.mod.Package.process(library);
					}

				});

				Object.values(_PROJECTS).forEach(function(project) {

					if (harvester.mod.Package.can(project) === true) {
						harvester.mod.Package.process(project);
					}

				});

			}.bind(this), 30000);

		}

	};


	Class.prototype = {

		/*
		 * MAIN API
		 */

		init: function() {

			this.trigger('load', []);
			this.trigger('init', []);

		},

		destroy: function() {

			for (var id in _PROJECTS) {

				var project = _PROJECTS[id];
				if (project.server !== null) {

					if (typeof project.server.destroy === 'function') {
						project.server.destroy();
					}

				}

			}


			if (this.server !== null) {
				this.server.disconnect();
				this.server = null;
			}


			this.trigger('destroy', []);

		},



		/*
		 * CUSTOM API
		 */

		getHost: function(identifier) {

			var id = (identifier || '');
			if (id.match(/\[.*\]+/g)) {
				id = id.match(/([0-9a-f\:]+)/g)[0];
			} else if (id.indexOf(':')) {
				id = id.split(':')[0];
			}


			return this.hosts[id] || null;

		},

		setHost: function(identifier, libraries, projects) {

			identifier = typeof identifier === 'string' ? identifier : null;
			libraries  = libraries instanceof Array     ? libraries  : Object.values(_LIBRARIES);
			projects   = projects instanceof Array      ? projects   : Object.values(_PROJECTS);


			if (identifier !== null) {

				var id = (identifier || '');
				if (id.match(/\[.*\]+/g)) {
					id = id.match(/([0-9a-f\:]+)/g)[0];
				} else if (id.indexOf(':')) {
					id = id.split(':')[0];
				}


				this.hosts[id] = new harvester.data.Host({
					cultivator: projects.length > 1,
					libraries:  libraries,
					projects:   projects
				});


				return true;

			}


			return false;

		}

	};


	return Class;

});
