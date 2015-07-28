


var cluster = require('cluster');
var path = require('path');
var glob = require('glob');
var fs = require('fs');
var watch = require('watch');
var shlex = require('shell-quote');
var Server = require('./server');
var debounce = require('debounce');
var dotenv = require('dotenv/lib/main').parse;

var work_dir = process.env.WORKER_DIR || '../cgm-remote-monitor';
var work_env = process.env.WORKER_ENV || './envs';
var env = {
    base: __dirname
  , WORKER_DIR: path.resolve(work_dir)
  , WORKER_ENV: path.resolve(__dirname, work_env)
  , HOSTEDPORTS: 5000
};
var ctx = {
    base: __dirname
  , last_port : env.HOSTEDPORTS
};

function read (config) {
  var lines = fs.readFileSync(path.resolve(env.WORKER_ENV, config));
  var e = dotenv(lines);
  return e;
  var e = { };
  lines.toString( ).split('\n').forEach(function (line) {
    var p = line.split('=');
    if (p.length == 2) {
      var val =  p.slice(1).join('=').trim( );
      e[p[0].trim( )] = shlex.parse(val).join('');
    }
  });
  return e;
}

function create (env) {
  process.chdir(env.WORKER_DIR);
  create.handlers = { };
  // ctx.last_port = env.HOSTEDPORTS;
  cluster.setupMaster(
    {
      exec: 'server.js'
    }
  );
  return cluster;

}


function fork (env) {
  console.log('CREATE FORK', ctx.last_port);
  var port = env.PORT = ctx.last_port++;

  function start (failures) {
    env.port = port;
    env.PORT = port;
    var worker = cluster.fork(env);
    worker.custom_env = env;
    worker.failures = failures;
    create.handlers[env.envfile] = {worker: worker, env: env, port: env.PORT};
    worker.on('disconnect', console.log.bind(console, 'DISCONNECT'));
    worker.on('exit', console.log.bind(console, 'EXIT'));
    worker.on('exit', function (ev) {
      console.log('EXITED!?', worker.suicide, worker.failures, arguments);
      if (worker.suicide !== true && worker.failures > 3) {
        console.log('quitting FAILURES', worker.failures);
      } else {
        if (!worker.remove) {
          // worker = start(worker.suicide ? worker.failures : worker.failures+1);
          console.log('INNER PRE recreating', env);
          var refreshed = read(env.envfile);
          env = merge(env, refreshed);
          worker.custom_env = env;
          worker = start(worker.suicide ? worker.failures : worker.failures+1);
          /*
          scan(create.env, env.envfile, function iter (err, environs) {

            env = environs[0];
            console.log('INNER recreating', env);
            // worker.kill( );
            worker = start(worker.suicide ? worker.failures : worker.failures+1);
          });
          */
        }
      }
    });
    worker.on('error', console.log.bind(console, 'ERROR'));
    watch.createMonitor(path.dirname(env.envfile), { filter: function (ff, stat) {
        // console.log('changing', path.basename(ff), path.basename(env.envfile));
        return path.basename(ff) === path.basename(env.envfile);
        if (worker.remove && worker.suicide) {
        } else {
        }
      } }, function (monitor) {
      monitor.on("changed", function (f, curr, prev) {
        console.log('killing', f, env.envfile);
        // env = ;
        scan(create.env, f, function iter (err, environs) {

          env = environs[0];
          console.log('recreating', env);
          worker.custom_env = env;
          worker.kill( );
        });
      });
      monitor.on("removed", function (f, curr, prev) {
        console.log('killing', f, env.envfile);
        worker.remove = true;
        if (worker.state != 'dead') {
          worker.kill( );
        }
      });
      worker.on('exit', function (ev) {
        monitor.stop( );
        // if (!worker.suicide) { }
      });
    });
    /*
    */
    return worker;
  }

  return start(0);
}

function scan (env, cb, p) {
  if (!cb.call) {
    if (p && p.call) {
      var tmp = p;
      p = cb;
      cb = tmp;
    }
  } else {
    p = env.WORKER_ENV + '/*.env';
  }
  glob(p, function (err, matches) {
    if (err) { return cb(err, matches); }
    var configs = [ ];
    if (!Array.isArray(matches )) {
      matches = [matches];
    }
    matches.forEach(function iter (file) {
      var defaults = merge({envfile: file}, env);
      var custom = read(file);
      configs.push(merge({PATH: process.env.PATH}, merge(defaults, custom)));
    });
    cb(null, configs);
  });
}


// Merge object b into object a
function merge(a, b) {
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
}

create.env     = env;
create.scan    = scan;
create.read    = read;
create.fork    = fork;
create.merge   = merge;
module.exports = create;


if (!module.parent) {
  process.env.WORKER_DIR = env.WORKER_DIR;
  var init = require('./init')(function ready ( ) {
    console.log(env);
    scan(env, function iter (err, environs) {
      var master = create(env);
      environs.forEach(function map (env, i) {
        console.log('i', i);
        setTimeout(function ( ) {
          console.log('starting', 'i', i);
          fork(env);

        }, i*4*1000);
      });
    });

  });

  console.log('MONITOR', env.WORKER_ENV);
  fs.watch(env.WORKER_ENV,
  // debounce(
  function (event, file) {
    // new file
    var f = path.resolve(env.WORKER_ENV, file);
    console.log('changed', file, event);
    var worker = create.handlers[f] ? create.handlers[f].worker : { state: 'missing' };
    var valid = [null, 'listening', 'online'];
    if (event == 'rename' && fs.existsSync(f)) {
      if (valid.indexOf(worker.state) < 1) {
        if (worker.failures) { worker.failures = 0; }
        scan(env, f, function iter (err, environs) {
          environs.forEach(function map (env) {
            fork(env);
          });
        });
      }
    } else {
      if (fs.existsSync(f)) {
        console.log("KILLING IT", worker.state);
        if (valid.indexOf(worker.state) > 1) {
          worker && worker.suicide && worker.suicide.call && worker.suicide( );
        }
      }
    }
  }
  // ,  10)
  );

  var server = Server({cluster: cluster, create:create});
  var port = process.env.INTERNAL_PORT || process.env.PORT || 3434;
  server.listen(port);
  server.on('listen', console.log.bind(console, 'port', port));
}
