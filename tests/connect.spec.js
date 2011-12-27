var io = require('socket.io-client')

var TIMEOUT = 5000;

describe("chatroom", function() {
  function async_it(name, cb) {
    var done = false;
    var Q = require('q')
      , deferred = Q.defer()
    
    Q.when(deferred.promise, function() { done = true; });
    waitsFor(function() {
      return done;
    }, "completed", TIMEOUT);

    runs(function() {
    });
    
    cb(deferred);
  }
  
  it('connect', function(){
    async_it('connect', function(deferred) {
      var socket = io.connect('http://localhost:3000');
      socket.on('connect', function() {
        socket.disconnect();
      }).on('disconnect', function() {
        deferred.resolve();
      });
    })
  });
});