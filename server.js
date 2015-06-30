
var restify = require('restify');
var fs = require('fs');
var path = require('path');

function createServer (opts) {
  var cluster = opts.cluster;
  var master = opts.create;
  var server = restify.createServer(opts);

  server.use(restify.queryParser( ));
  server.use(restify.bodyParser( ));

  server.get('/cluster', function (req, res, next) {
    var h = { };
    var worker;
    for (var id in cluster.workers) {
      worker = cluster.workers[id];
      var v = {
        id: id
      , custom_env: worker.custom_env
      , state: worker.state
      , isDead: worker.isDead && worker.isDead( )
      , url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/'
      , status_url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/api/v1/status.json'
      };
      
      // console.log(worker);
      h[id] = v;
    }
    res.send(h);
    next( );
    
  });

  server.get('/cluster/:id', function (req, res, next) {
    var h = { };
    var worker = cluster.workers[req.params.id];
    var v = {
      id: id
    , custom_env: worker.custom_env
    , state: worker.state
    , isDead: worker.isDead && worker.isDead( )
    , url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/'
    , status_url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/api/v1/status.json'
    };

    res.send(h);
    next( );

  });

  server.get('/history', function (req, res, next) {
    var h = { };
    var worker;
    for (var file in master.handlers) {
      worker = master.handlers[file].worker;
      // console.log(worker);
      var v = {
        id: worker.id
      , custom_env: worker.custom_env
      , state: worker.state
      , isDead: worker.isDead && worker.isDead( )
      // , url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/'
      // , status_url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/api/v1/status.json'
      };
      
      h[file] = v;
    }
    res.send(h);
    next( );
    
  });

  server.get('/environs', function (req, res, next) {
    master.scan(master.env, function iter (err, environs) {
      var h = { };
      var worker;
      for (var i in environs) {
        var environ = environs[i];
        var file = environ.envfile;
        var handler = master.handlers[file];
        var worker = handler ? handler.worker : { };
        // console.log(worker);
        var v = {
          id: worker.id || null
        , custom_env: worker.custom_env || environ
        , state: worker.state || 'missing'
        , isDead: worker.isDead && worker.isDead( )
        // , url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/'
        // , status_url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/api/v1/status.json'
        };
        
        h[file] = v;
      }
      res.send(h);
      next( );
    });
  });

  server.get('/environs/:name', function (req, res, next) {
    var file = path.resolve(master.env.WORKER_ENV, req.params.name + '.env');
    var handler = master.handlers[file];
    var worker = handler ? handler.worker : { };
    var v = {
      id: worker.id || null
    , custom_env: worker.custom_env
    , state: worker.state || 'missing'
    , isDead: worker.isDead && worker.isDead( )
    // , url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/'
    // , status_url: "http://" + [ 'localhost', worker.custom_env.PORT ].join(':') + '/api/v1/status.json'
    };

    res.send(v);
    next( );
    
  });

  server.del('/environs/:name', function (req, res, next) {
    var file = path.resolve(master.env.WORKER_ENV, req.params.name + '.env');

    fs.unlink(file, function (ev) {
      res.status(204);
      res.send("");
      next( );
    });

  });

  server.get('/environs/:name/env', function (req, res, next) {
    var file = path.resolve(master.env.WORKER_ENV, req.params.name + '.env');
    var handler = master.handlers[file];
    var worker = handler ? handler.worker : { };

    res.send(worker.custom_env);
    next( );
    
  });

  server.get('/environs/:name/env/:field', function (req, res, next) {
    var file = path.resolve(master.env.WORKER_ENV, req.params.name + '.env');
    var worker = master.handlers[file].worker || { };

    var field = worker.custom_env[req.params.field];
    if (typeof field !== 'undefined') {
      res.send(field);
    } else {
      res.status(404);
    }
    next( );
    
  });

  server.post('/environs/:name', function (req, res, next) {
    var file = path.resolve(master.env.WORKER_ENV, req.params.name + '.env');
    var text = [ ];
    var item = { };
    var out = fs.createWriteStream(file);
    out.on('close', function (ev) {
      console.log('closed done');
      res.send(item);
      next( );
    });

    console.log("FILE", file);
    console.log('query', req.query);
    console.log('input', req.body);
    var x;
    text.push(['WEB_NAME', req.params.name ].join('='));
    item['WEB_NAME'] = req.params.name;
    for (x in req.query) {
      text.push([x, req.query[x] ].join('='));
      item[x] = req.query[x];
    }
    for (x in req.body) {
      text.push([x, req.body[x] ].join('='));
      item[x] = req.body[x];
    }
    console.log('writing', out);
    out.write(text.join("\n"));

    res.status(201);
    res.header('Location', '/environs/' + req.params.name);
    out.end( );
  });

  return server;
}

exports = module.exports = createServer;

