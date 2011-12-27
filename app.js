
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , io = require('socket.io')
  , parseCookie = require('connect').utils.parseCookie
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore()

var app = module.exports = express.createServer()
  , io = io.listen(app)

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ store: sessionStore
                          , secret: 'secret'
                          , key: 'express.sid'}));
  app.use(express.methodOverride());
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res) {
  var options = {
      locals: {
        title: 'ChatRoom'
        , user: req.session&& req.session.auth&& req.session.auth.user
      }
  };
  res.render('index', options)
});

// for simplicy, use HTTP GET instead of POST
app.get('/login', function(req,res) {
  var user = req.param('user');
  if(user) {
    req.session.auth = {
      user: user
    }
    res.redirect('/');
  } else {
    res.send('for demo, login vi http://localhost:3000/login?user=XXX.');
  }
});

app.get('/logout', function(req,res) {
  delete req.session.auth;
  res.redirect('/');
});

io.set('authorization', function(data, accept) {
  // THIS IS A BACKDOOR FOR TESTING.
  // RIGHT NOW, socket.io-client DOES NOT ALLOWED YOU TO PASS COOKIE.
  // REMOVE IT, IF YOU ARE IN PRODUCTION ENVIRONMENT.
  if(data.query.user) {
    data.session = {};
    data.session.auth = {user: data.query.user}
    return accept(null, true);
  }
  // END OF BACKDOOR
  if (data.headers.cookie) {
    data.cookie = parseCookie(data.headers.cookie);
    data.sessionID = data.cookie['express.sid'];
    // (literally) get the session data from the session store
    sessionStore.get(data.sessionID, function(err, session) {
      if (err || !session) {
        // if we cannot grab a session, turn down the connection
        accept('Error', false);
      } else {
        // save the session data and accept the connection
        if( session.auth && session.auth.user ) {
          data.session = session;
          console.log('okok');
          accept(null, true);
        } else {
          accept('not a registered user', false);
        }
      }
    });
  } else {
    return accept('No cookie transmitted.', false);
  }
});

io.sockets.on('connection', function(socket) {
  var user = socket.handshake.session.auth.user
  socket.emit('system', "welcome! " + user);
  socket.on('disconnect', function() {
    console.log('on disconnect.');
  });

  socket.on('message', function(data, fn) {
    console.log('on message. data:%s, fn:%s', data, fn );
    if(fn) fn();
  });

  // custom events
  socket.on('public_chat', function(data, fn) {
    console.log('on public_chat. data:%s, fn:%s', data, fn );
    socket.broadcast.emit('public_chat', data)
    if(fn) fn();
  });
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
