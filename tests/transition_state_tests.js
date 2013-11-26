var TransitionState = Router.TransitionState;

var UnresolvedHandlerInfoByObject = Router.UnresolvedHandlerInfoByObject;
var UnresolvedHandlerInfoByParam = Router.UnresolvedHandlerInfoByParam;

var bb = new backburner.Backburner(['promises']);

function customAsync(callback, promise) {
  bb.defer('promises', promise, callback, promise);
}

function flushBackburner() {
  bb.end();
  bb.begin();
}

function noop() {}

module("TransitionState", {

  setup: function() {
    RSVP.configure('async', customAsync);
    bb.begin();
  },

  teardown: function() {
    bb.end();
  }
});

test("it starts off with default state", function() {
  var state = new TransitionState();
  deepEqual(state.handlerInfos, [], "it has an array of handlerInfos");
});

test("#resolve delegates to handleInfo objects' resolve()", function() {

  expect(6);

  var state = new TransitionState();

  var counter = 0;

  var resolvedHandlerInfos = [{}, {}];

  state.handlerInfos = [
    {
      resolve: function(shouldContinue) {
        ++counter;
        equal(counter, 1);
        shouldContinue();
        return RSVP.resolve(resolvedHandlerInfos[0]);
      }
    },
    {
      resolve: function(shouldContinue) {
        ++counter;
        equal(counter, 2);
        shouldContinue();
        return RSVP.resolve(resolvedHandlerInfos[1]);
      }
    },
  ];

  function keepGoing() {
    ok(true, "continuation function was called");
  }

  state.resolve(keepGoing).then(function(result) {
    ok(!result.error);
    deepEqual(result.state.handlerInfos, resolvedHandlerInfos);
  });
});

test("State resolution can be halted", function() {

  expect(2);

  var state = new TransitionState();

  state.handlerInfos = [
    {
      resolve: function(shouldContinue) {
        return shouldContinue();
      }
    },
    {
      resolve: function() {
        ok(false, "I should not be entered because we threw an error in shouldContinue");
      }
    },
  ];

  function keepGoing() {
    return RSVP.reject("NOPE");
  }

  state.resolve(keepGoing).fail(function(reason) {
    equal(reason.error, "NOPE");
    ok(reason.wasAborted, "state resolution was correctly marked as aborted");
  });

  flushBackburner();
});


test("Integration w/ HandlerInfos", function() {

  expect(5);

  var state = new TransitionState();

  var fooModel = {};
  var barModel = {};
  var transition = {};

  debugger;

  state.handlerInfos = [
    new UnresolvedHandlerInfoByParam({
      name: 'foo',
      params: { foo_id: '123' },
      handler: {
        model: function(params, payload) {
          equal(payload, transition);
          equal(params.foo_id, '123', "foo#model received expected params");
          return RSVP.resolve(fooModel);
        }
      }
    }),
    new UnresolvedHandlerInfoByObject({
      name: 'bar',
      names: ['bar_id'],
      context: RSVP.resolve(barModel),
      handler: {}
    })
  ];

  state.resolve(noop, transition).then(function(result) {
    var models = result.state.handlerInfos.map(function(handlerInfo) {
      return handlerInfo.context;
    });

    ok(!result.error);
    equal(models[0], fooModel);
    equal(models[1], barModel);
  });
});



