var io = require('socket.io-client')
  , Q = require('q')
var TIMEOUT = 1000;

function async_it(name, cb) {
  var done = false
    , deferred = Q.defer()
  Q.when(deferred.promise, function() { done = true; });
  waitsFor(function() { return done; }, "completed", TIMEOUT);
  runs(function() {});

  cb(deferred);
}

describe("chatroom", function() {
  it('connect', function(){
    async_it('connect', function(deferred) {
      var socket = io.connect('http://localhost:3000/?user=user1'
                              , {'force new connection': true });
      socket.on('connect', function() {
        socket.disconnect();

      }).on('error', function(err) {
        // NOTE: disconnect() will cause this error. this should be library's bug
        if(''+err !== 'Error: Stream closed unexpectedly.') {
          console.log(err);
          expect(false).toBeTruthy();
        }
        deferred.resolve();
      }).on('disconnect', function() {
        console.log('disconnect');
        deferred.resolve();
      });
    })
  });

  it('public_chat', function(){
    async_it('public_chat', function(deferred) {
      var d = Q.defer()
        , user1_connected = Q.defer()
        , user2_connected = Q.defer()
        , user1_received = Q.defer()
        , user2_received = Q.defer()
        , user1_msg = 'it is user1 speaking'
        , user2_msg = 'it is user2 speaking'
        , user1 = io.connect('http://localhost:3000/?user=user1'
                             , {'force new connection': true })
        , user2 = io.connect('http://localhost:3000/?user=user2'
                             , {'force new connection': true })

      user1.on('connect', function() {
        user1_connected.resolve();
      }).on('disconnect', function() {
        console.log('user1 disconnect');
      }).on('error', function(err) {
        // NOTE: disconnect() will cause this error. this should be library's bug
        if(''+err !== 'Error: Stream closed unexpectedly.') {
          console.log(err);
          expect(false).toBeTruthy();
        }
        user1_received.resolve();
      }).on('public_chat', function(data) {
        expect(data).toEqual(user2_msg);
        user1_received.resolve();
      });

      user2.on('connect', function() {
        user2_connected.resolve();
      }).on('disconnect', function() {
        console.log('user2 disconnect');
      }).on('error', function(err) {
        // NOTE: disconnect() will cause this error. this should be library's bug
        if(''+err !== 'Error: Stream closed unexpectedly.') {
          console.log(err);
          expect(false).toBeTruthy();
        }
        user2_received.resolve();
      }).on('public_chat', function(data) {
        expect(data).toEqual(user1_msg);
        user2_received.resolve();
      });

      Q.when(user1_connected.promise, function() {
        Q.when(user2_connected.promise, function() {
          user1.emit('public_chat', user1_msg);
          user2.emit('public_chat', user2_msg);
        })
      })

      Q.when(user1_received.promise, function() {
        Q.when(user2_received.promise, function() {
          user1.disconnect();
          user2.disconnect();
          deferred.resolve();
        })
      });
    })
  });
});

describe("join room.", function() {
  it('client can speak to a room only after he join that room.', function(){
    async_it('private room', function(deferred) {
      var socket = io.connect('http://localhost:3000/?user=probe'
                             , {'force new connection': true })
      socket.on('connect', function() {
        var msg = {
          room: 'protoss'
          , sender:'probe'
          , msg:'greeting' }
        socket.emit('speak', msg, function(err) {
          expect(err).toBeTruthy();
          expect(err.error).toEqual('403');
          socket.disconnect();
        });
      }).on('disconnect', function() {
        deferred.resolve();
      });
    });
  });
  it('clients in the room can receive room\'s messages.', function(){
    async_it('join room', function(deferred) {
      var d = Q.defer()
        , join1 = Q.defer()
        , join2 = Q.defer()
        , end = Q.defer()
        , socket = io.connect('http://localhost:3000/?user=probe'
                             , {'force new connection': true })
        , socket2 = io.connect('http://localhost:3000/?user=zealot'
                             , {'force new connection': true })
      socket.on('connect', function() {
        socket.emit('join', 'protoss', join1.resolve);
      })
      socket2.on('connect', function() {
        socket2.emit('join', 'protoss', join2.resolve);
      })

      Q.when(join1.promise, function() {
        Q.when(join2.promise, function() {
          var msg = {
            room: 'protoss'
            , sender:'probe'
            , msg:'greeting' }
          socket2.once('speak', function(data) {
            expect(data).toEqual(msg);
            end.resolve();
          });
          socket.emit('speak', msg);
        })
      });

      Q.when(end.promise, function() {
        socket.disconnect();
        socket2.disconnect();

        deferred.resolve();
      });
    });
  });

  it('client should not receive message anymore after leave.', function(){
    async_it('leave room', function(deferred) {
      var d = Q.defer()
        , join1 = Q.defer()
        , join2 = Q.defer()
        , step1 = Q.defer()
        , step2 = Q.defer()
        , end = Q.defer()
        , socket = io.connect('http://localhost:3000/?user=probe'
                             , {'force new connection': true })
        , socket2 = io.connect('http://localhost:3000/?user=zealot'
                             , {'force new connection': true })
      socket.on('connect', function() {
        socket.emit('join', 'protoss', join1.resolve);
      })
      socket2.on('connect', function() {
        socket2.emit('join', 'protoss', join2.resolve);
      })

      Q.when(join1.promise, function() {
        Q.when(join2.promise, function() {
          var msg = {
            room: 'protoss'
            , sender:'probe'
            , msg:'greeting' }
          socket2.once('speak', function(data) {
            expect(data).toEqual(msg);
            step1.resolve();
          });
          socket.emit('speak', msg);
        })
      });

      Q.when(step1.promise, function() {
        socket2.emit('leave', 'protoss', step2.resolve);
      });
      Q.when(step2.promise, function() {
        var msg = {
          room: 'protoss'
          , sender:'probe'
          , msg:'greeting' }
        socket2.once('speak', function(data) {
          // SHOULD NOT BE CALLED
          expect(false).toBeTruthy();
        });
        socket.emit('speak', msg, function() {
          // NO IMPLICIT WAY TO KNOW IF SOCKET2 WILL GET MESSAGE OR NOT.
          setTimeout(end.resolve, 300);
        });
      });

      Q.when(end.promise, function() {
        socket.disconnect();
        socket2.disconnect();

        deferred.resolve();
      });
    });
  });

  it('only room\'s members can join.', function(){
    async_it('private room', function(deferred) {
      var socket = io.connect('http://localhost:3000/?user=probe'
                             , {'force new connection': true })
      socket.on('connect', function() {

        socket.emit('join', 'zerg', function(err) {
          expect(err).toBeTruthy();
          expect(err.error).toEqual('403');

          socket.disconnect();
        });
      }).on('disconnect', function() {
        deferred.resolve();
      });
    });
  });

  it('private room messages should not be received by outsider', function(){
    async_it('private room', function(deferred) {
      var socket = io.connect('http://localhost:3000/?user=probe'
                             , {'force new connection': true })
        , socket2 = io.connect('http://localhost:3000/?user=zealot'
                             , {'force new connection': true })
        , socket3 = io.connect('http://localhost:3000/?user=drone'
                             , {'force new connection': true })
        , socket4 = io.connect('http://localhost:3000/?user=marine'
                             , {'force new connection': true })
        , join1 = Q.defer(), join2 = Q.defer(), join3 = Q.defer()
        , join4 = Q.defer(), step1 = Q.defer(), end = Q.defer()

      // wait for all clients connected
      socket.on('connect', function() {
        socket.emit('join', 'protoss', join1.resolve);
      });
      socket2.on('connect', function() {
        socket2.emit('join', 'protoss', join2.resolve);
      });
      socket3.on('connect', function() {
        socket3.emit('join', 'zerg', join3.resolve);
      });
      socket4.on('connect', join4.resolve);

      Q.when(join1.promise, function() {
        Q.when(join2.promise, function() {
          Q.when(join3.promise, function() {
            Q.when(join4.promise, function() {
              step1.resolve();
            })
          })
        })
      });
      // start to do private chat room speak.
      Q.when(step1.promise, function() {
        var msg = {
          room: 'protoss'
          , sender:'probe'
          , msg:'greeting' }
        var received = false;
        var compromised = false;
        socket2.once('speak', function(data) {
          console.dir(data);
          expect(data).toEqual(msg);
          received = true;
        });
        socket3.once('speak', function(data) {
          expect(false).toBeTruthy();
          compromised = true;
        });
        socket4.once('speak', function(data) {
          expect(false).toBeTruthy();
          compromised = true;
        });
        socket.emit('speak', msg, function() {
          // NO IMPLICIT WAY TO KNOW IF OTHERS WILL GET MESSAGE OR NOT.
          setTimeout(function() {
            expect(received).toBeTruthy();
            expect(compromised).toBeFalsy();
            end.resolve();
          }, 300);
        });
      });
      Q.when(end.promise, function() {
        socket.disconnect();
        socket2.disconnect();
        socket3.disconnect();
        socket4.disconnect();

        deferred.resolve();
      });
    });
  });
});
