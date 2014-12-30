require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}],"emit-bindings":[function(require,module,exports){
'use strict';

var EventEmitter2 = require( 'eventemitter2' ).EventEmitter2;

/*
    dependencies
*/

/* binding */
var bindingMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
var eventPrefix = bindingMethod !== 'addEventListener' ? 'on' : '';

function bind( el, type, fn, capture ) {
    el[ bindingMethod ]( eventPrefix + type, fn, capture || false );
    return fn;
}

/* matching */
var vendorMatch = Element.prototype.matches || Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector;

function matches( el, selector ) {
    if ( !el || el.nodeType !== 1 ) {
        return false;
    }
    if ( vendorMatch ) {
        return vendorMatch.call( el, selector );
    }
    var nodes = document.querySelectorAll( selector, el.parentNode );
    for ( var i = 0; i < nodes.length; ++i ) {
        if ( nodes[ i ] == el ) {
            return true;  
        } 
    }
    return false;
}

/* closest */

function closest( element, selector, checkSelf, root ) {
    element = checkSelf ? {parentNode: element} : element;

    root = root || document;

    /* Make sure `element !== document` and `element != null`
       otherwise we get an illegal invocation */
    while ( ( element = element.parentNode ) && element !== document ) {
        if ( matches( element, selector ) ) {
            return element;
        }

        /* After `matches` on the edge case that
           the selector matches the root
           (when the root is not the document) */
        if (element === root) {
            return;
        }
    }
}

/*
    end dependencies
*/

function Emit() {
    var self = this;
    EventEmitter2.call( self );

    self.validators = [];
    self.touchMoveDelta = 10;
    self.initialTouchPoint = null;

    bind( document, 'touchstart', self.handleEvent.bind( self ) );
    bind( document, 'touchmove', self.handleEvent.bind( self ) );
    bind( document, 'touchend', self.handleEvent.bind( self ) );
    bind( document, 'click', self.handleEvent.bind( self ) );
    bind( document, 'input', self.handleEvent.bind( self ) );
    bind( document, 'submit', self.handleEvent.bind( self ) );
}

Emit.prototype = Object.create( EventEmitter2.prototype );

function t() {
    return true;
}
function f() {
    return false;
}

function getTouchDelta( event, initial ) {
    var deltaX = ( event.touches[ 0 ].pageX - initial.x );
    var deltaY = ( event.touches[ 0 ].pageY - initial.y );
    return Math.sqrt( ( deltaX * deltaX ) + ( deltaY * deltaY ) );
}

Emit.prototype.handleEvent = function( event ) {
    var self = this;

    if ( typeof( event.isPropagationStopped ) == 'undefined' ) {
        event.isPropagationStopped = f;
    }

    var touches = event.touches;
    var delta = -1;
    switch ( event.type ) {
        case 'touchstart':
            self.initialTouchPoint = self.lastTouchPoint = {
                x: touches && touches.length ? touches[ 0 ].pageX : 0,
                y: touches && touches.length ? touches[ 0 ].pageY : 0
            };

            break;

        case 'touchmove':
            if ( touches && touches.length && self.initialTouchPoint ) {
                delta = getTouchDelta( event, self.initialTouchPoint );
                if ( delta > self.touchMoveDelta ) {
                    self.initialTouchPoint = null;
                }

                self.lastTouchPoint = {
                    x: touches[ 0 ].pageX,
                    y: touches[ 0 ].pageY
                };
            }

            break;

        case 'click':
        case 'touchend':
        case 'input':
        case 'submit':
            // eat any late-firing click events on touch devices
            if ( event.type === 'click' && self.lastTouchPoint ) {
                if ( event.touches && event.touches.length ) {
                    delta = getTouchDelta( event, self.lastTouchPoint );
                    if ( delta < self.touchMoveDelta ) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                }
            }

            // handle canceling touches that have moved too much
            if ( event.type === 'touchend' && !self.initialTouchPoint ) {
                return;
            }

            var selector = '[data-emit]';
            var originalElement = event.target || event.srcElement;
            
            // if it's a link and it has no emit attribute, allow the event to pass
            if ( !originalElement.getAttribute( 'data-emit' ) && ( originalElement.tagName === 'A' || originalElement.tagName === 'BUTTON' || originalElement.tagName === 'INPUT' ) ) {
                return;
            }
            
            var forceAllowDefault = originalElement.tagName == 'INPUT' && ( originalElement.type == 'checkbox' || originalElement.type == 'radio' );
            var el = closest( originalElement, selector, true, document );

            if ( el ) {
                var depth = -1;
                while ( el && !event.isPropagationStopped() && ++depth < 100 ) {
                    var validated = true;
                    for ( var validatorIndex = 0; validatorIndex < self.validators.length; ++validatorIndex ) {
                        if ( !self.validators[ validatorIndex ].call( this, el, event ) ) {
                            validated = false;
                            break;
                        }
                    }

                    // eat the event if a validator failed
                    if ( !validated ) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() ) {
                            event.isPropagationStopped = t;
                        }

                        el = null;
                        continue;
                    }

                    if ( typeof( self.validate ) == 'function' && !self.validate.call( self, el ) ) {
                        el = closest( el, selector, false, document );
                        continue;
                    }

                    if ( el.tagName == 'FORM' ) {
                        if ( event.type != 'submit' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'INPUT' ) {
                        if ( !( el.type == 'submit' || el.type == 'checkbox' || el.type == 'radio' || el.type == 'file' ) && event.type != 'input' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'SELECT' ) {
                        if ( event.type != 'input' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }

                    event.emitTarget = el;
                    self._emit( el, event, forceAllowDefault );
                    el = closest( el, selector, false, document );
                }

                if ( depth >= 100 ) {
                    throw new Error( 'Exceeded depth limit for Emit calls.' );
                }
            }
            else {
                self.emit( 'unhandled', event );
            }

            self.initialTouchPoint = null;

            break;
    }
};

Emit.prototype._emit = function( element, event, forceDefault ) {
    var self = this;
    var optionString = element.getAttribute( 'data-emit-options' );
    var options = {};
    var ignoreString = element.getAttribute( 'data-emit-ignore' );
    var i;

    if ( ignoreString && ignoreString.length ) {
        var ignoredEvents = ignoreString.toLowerCase().split( ' ' );
        for ( i = 0; i < ignoredEvents.length; ++i ) {
            if ( event.type == ignoredEvents[ i ] ) {
                return;
            }
        }
    }

    if ( optionString && optionString.length ) {
        var opts = optionString.toLowerCase().split( ' ' );
        for ( i = 0; i < opts.length; ++i ) {
            options[ opts[ i ] ] = true;
        }
    }

    if ( !forceDefault && !options.allowdefault ) {
        event.preventDefault();
    }

    if ( !options.allowpropagate ) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() ) {
            event.isPropagationStopped = t;
        }
    }

    var emissionList = element.getAttribute( 'data-emit' );
    if ( !emissionList ) {
        // allow for empty behaviors that catch events
        return;
    }

    var emissions = emissionList.split( ',' );
    if ( options.debounce ) {
        self.timeouts = self.timeouts || {};
        if ( self.timeouts[ element ] ) {
            clearTimeout( self.timeouts[ element ] );
        }
        
        (function() {
            var _element = element;
            var _emissions = emissions;
            var _event = event;
            self.timeouts[ element ] = setTimeout( function() {
                _emissions.forEach( function( emission ) {
                    self.emit( emission, _event );
                } );
                clearTimeout( self.timeouts[ _element ] );
                self.timeouts[ _element ] = null;
            }, 250 );
        } )();

        return;
    }
    
    emissions.forEach( function( emission ) {
        self.emit( emission, event );
    } );
};

Emit.prototype.addValidator = function( validator ) {
    var self = this;

    var found = false;
    for ( var i = 0; i < self.validators.length; ++i ) {
        if ( self.validators[ i ] == validator ) {
            found = true;
            break;
        }
    }

    if ( found ) {
        return false;
    }

    self.validators.push( validator );
    return true;
};

Emit.prototype.removeValidator = function( validator ) {
    var self = this;

    var found = false;
    for ( var i = 0; i < self.validators.length; ++i ) {
        if ( self.validators[ i ] == validator ) {
            self.validators.splice( i, 1 );
            found = true;
            break;
        }
    }

    return found;
};

Emit.singleton = Emit.singleton || new Emit();
Emit.singleton.Emit = Emit;

module.exports = Emit.singleton;
},{"eventemitter2":1}]},{},[])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMi9saWIvZXZlbnRlbWl0dGVyMi5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXG4gKiBFdmVudEVtaXR0ZXIyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vaGlqMW54L0V2ZW50RW1pdHRlcjJcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgaGlqMW54XG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cbjshZnVuY3Rpb24odW5kZWZpbmVkKSB7XG5cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5ID8gQXJyYXkuaXNBcnJheSA6IGZ1bmN0aW9uIF9pc0FycmF5KG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICB9O1xuICB2YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4gIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgaWYgKHRoaXMuX2NvbmYpIHtcbiAgICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIHRoaXMuX2NvbmYpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbmZpZ3VyZShjb25mKSB7XG4gICAgaWYgKGNvbmYpIHtcblxuICAgICAgdGhpcy5fY29uZiA9IGNvbmY7XG5cbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcbiAgICAgIGNvbmYubWF4TGlzdGVuZXJzICYmICh0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gY29uZi5tYXhMaXN0ZW5lcnMpO1xuICAgICAgY29uZi53aWxkY2FyZCAmJiAodGhpcy53aWxkY2FyZCA9IGNvbmYud2lsZGNhcmQpO1xuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xuXG4gICAgICBpZiAodGhpcy53aWxkY2FyZCkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyVHJlZSA9IHt9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEV2ZW50RW1pdHRlcihjb25mKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgdGhpcy5uZXdMaXN0ZW5lciA9IGZhbHNlO1xuICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIGNvbmYpO1xuICB9XG5cbiAgLy9cbiAgLy8gQXR0ZW50aW9uLCBmdW5jdGlvbiByZXR1cm4gdHlwZSBub3cgaXMgYXJyYXksIGFsd2F5cyAhXG4gIC8vIEl0IGhhcyB6ZXJvIGVsZW1lbnRzIGlmIG5vIGFueSBtYXRjaGVzIGZvdW5kIGFuZCBvbmUgb3IgbW9yZVxuICAvLyBlbGVtZW50cyAobGVhZnMpIGlmIHRoZXJlIGFyZSBtYXRjaGVzXG4gIC8vXG4gIGZ1bmN0aW9uIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgaSkge1xuICAgIGlmICghdHJlZSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzPVtdLCBsZWFmLCBsZW4sIGJyYW5jaCwgeFRyZWUsIHh4VHJlZSwgaXNvbGF0ZWRCcmFuY2gsIGVuZFJlYWNoZWQsXG4gICAgICAgIHR5cGVMZW5ndGggPSB0eXBlLmxlbmd0aCwgY3VycmVudFR5cGUgPSB0eXBlW2ldLCBuZXh0VHlwZSA9IHR5cGVbaSsxXTtcbiAgICBpZiAoaSA9PT0gdHlwZUxlbmd0aCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiBhdCB0aGUgZW5kIG9mIHRoZSBldmVudChzKSBsaXN0IGFuZCB0aGUgdHJlZSBoYXMgbGlzdGVuZXJzXG4gICAgICAvLyBpbnZva2UgdGhvc2UgbGlzdGVuZXJzLlxuICAgICAgLy9cbiAgICAgIGlmICh0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGVhZiA9IDAsIGxlbiA9IHRyZWUuX2xpc3RlbmVycy5sZW5ndGg7IGxlYWYgPCBsZW47IGxlYWYrKykge1xuICAgICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzW2xlYWZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY3VycmVudFR5cGUgPT09ICcqJyB8fCBjdXJyZW50VHlwZSA9PT0gJyoqJykgfHwgdHJlZVtjdXJyZW50VHlwZV0pIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgZXZlbnQgZW1pdHRlZCBpcyAnKicgYXQgdGhpcyBwYXJ0XG4gICAgICAvLyBvciB0aGVyZSBpcyBhIGNvbmNyZXRlIG1hdGNoIGF0IHRoaXMgcGF0Y2hcbiAgICAgIC8vXG4gICAgICBpZiAoY3VycmVudFR5cGUgPT09ICcqJykge1xuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsxKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9IGVsc2UgaWYoY3VycmVudFR5cGUgPT09ICcqKicpIHtcbiAgICAgICAgZW5kUmVhY2hlZCA9IChpKzEgPT09IHR5cGVMZW5ndGggfHwgKGkrMiA9PT0gdHlwZUxlbmd0aCAmJiBuZXh0VHlwZSA9PT0gJyonKSk7XG4gICAgICAgIGlmKGVuZFJlYWNoZWQgJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gVGhlIG5leHQgZWxlbWVudCBoYXMgYSBfbGlzdGVuZXJzLCBhZGQgaXQgdG8gdGhlIGhhbmRsZXJzLlxuICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSAnKicgfHwgYnJhbmNoID09PSAnKionKSB7XG4gICAgICAgICAgICAgIGlmKHRyZWVbYnJhbmNoXS5fbGlzdGVuZXJzICYmICFlbmRSZWFjaGVkKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gTm8gbWF0Y2ggb24gdGhpcyBvbmUsIHNoaWZ0IGludG8gdGhlIHRyZWUgYnV0IG5vdCBpbiB0aGUgdHlwZSBhcnJheS5cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfVxuXG4gICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVtjdXJyZW50VHlwZV0sIGkrMSkpO1xuICAgIH1cblxuICAgIHhUcmVlID0gdHJlZVsnKiddO1xuICAgIGlmICh4VHJlZSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBsaXN0ZW5lciB0cmVlIHdpbGwgYWxsb3cgYW55IG1hdGNoIGZvciB0aGlzIHBhcnQsXG4gICAgICAvLyB0aGVuIHJlY3Vyc2l2ZWx5IGV4cGxvcmUgYWxsIGJyYW5jaGVzIG9mIHRoZSB0cmVlXG4gICAgICAvL1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4VHJlZSwgaSsxKTtcbiAgICB9XG5cbiAgICB4eFRyZWUgPSB0cmVlWycqKiddO1xuICAgIGlmKHh4VHJlZSkge1xuICAgICAgaWYoaSA8IHR5cGVMZW5ndGgpIHtcbiAgICAgICAgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGEgbGlzdGVuZXIgb24gYSAnKionLCBpdCB3aWxsIGNhdGNoIGFsbCwgc28gYWRkIGl0cyBoYW5kbGVyLlxuICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1aWxkIGFycmF5cyBvZiBtYXRjaGluZyBuZXh0IGJyYW5jaGVzIGFuZCBvdGhlcnMuXG4gICAgICAgIGZvcihicmFuY2ggaW4geHhUcmVlKSB7XG4gICAgICAgICAgaWYoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgeHhUcmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gV2Uga25vdyB0aGUgbmV4dCBlbGVtZW50IHdpbGwgbWF0Y2gsIHNvIGp1bXAgdHdpY2UuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMik7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBjdXJyZW50VHlwZSkge1xuICAgICAgICAgICAgICAvLyBDdXJyZW50IG5vZGUgbWF0Y2hlcywgbW92ZSBpbnRvIHRoZSB0cmVlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2ggPSB7fTtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2hbYnJhbmNoXSA9IHh4VHJlZVticmFuY2hdO1xuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHsgJyoqJzogaXNvbGF0ZWRCcmFuY2ggfSwgaSsxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAvLyBXZSBoYXZlIHJlYWNoZWQgdGhlIGVuZCBhbmQgc3RpbGwgb24gYSAnKionXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH0gZWxzZSBpZih4eFRyZWVbJyonXSAmJiB4eFRyZWVbJyonXS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlWycqJ10sIHR5cGVMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gIH1cblxuICBmdW5jdGlvbiBncm93TGlzdGVuZXJUcmVlKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICB0eXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG5cbiAgICAvL1xuICAgIC8vIExvb2tzIGZvciB0d28gY29uc2VjdXRpdmUgJyoqJywgaWYgc28sIGRvbid0IGFkZCB0aGUgZXZlbnQgYXQgYWxsLlxuICAgIC8vXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdHlwZS5sZW5ndGg7IGkrMSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZih0eXBlW2ldID09PSAnKionICYmIHR5cGVbaSsxXSA9PT0gJyoqJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHRyZWUgPSB0aGlzLmxpc3RlbmVyVHJlZTtcbiAgICB2YXIgbmFtZSA9IHR5cGUuc2hpZnQoKTtcblxuICAgIHdoaWxlIChuYW1lKSB7XG5cbiAgICAgIGlmICghdHJlZVtuYW1lXSkge1xuICAgICAgICB0cmVlW25hbWVdID0ge307XG4gICAgICB9XG5cbiAgICAgIHRyZWUgPSB0cmVlW25hbWVdO1xuXG4gICAgICBpZiAodHlwZS5sZW5ndGggPT09IDApIHtcblxuICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IGxpc3RlbmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IFt0cmVlLl9saXN0ZW5lcnMsIGxpc3RlbmVyXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc0FycmF5KHRyZWUuX2xpc3RlbmVycykpIHtcblxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzLndhcm5lZCkge1xuXG4gICAgICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtID4gMCAmJiB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhblxuICAvLyAxMCBsaXN0ZW5lcnMgYXJlIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2hcbiAgLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG4gIC8vXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmRlbGltaXRlciA9ICcuJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xuICAgIGlmICghdGhpcy5fY29uZikgdGhpcy5fY29uZiA9IHt9O1xuICAgIHRoaXMuX2NvbmYubWF4TGlzdGVuZXJzID0gbjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmV2ZW50ID0gJyc7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKSB7XG4gICAgdGhpcy5tYW55KGV2ZW50LCAxLCBmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5tYW55ID0gZnVuY3Rpb24oZXZlbnQsIHR0bCwgZm4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKCkge1xuICAgICAgaWYgKC0tdHRsID09PSAwKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGxpc3RlbmVyLl9vcmlnaW4gPSBmbjtcblxuICAgIHRoaXMub24oZXZlbnQsIGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIHZhciB0eXBlID0gYXJndW1lbnRzWzBdO1xuXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIH1cblxuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgKl9hbGwqIGZ1bmN0aW9ucyBhbmQgaW52b2tlIHRoZW0uXG4gICAgaWYgKHRoaXMuX2FsbCkge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuX2FsbC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIHRoaXMuX2FsbFtpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcblxuICAgICAgaWYgKCF0aGlzLl9hbGwgJiZcbiAgICAgICAgIXRoaXMuX2V2ZW50cy5lcnJvciAmJlxuICAgICAgICAhKHRoaXMud2lsZGNhcmQgJiYgdGhpcy5saXN0ZW5lclRyZWUuZXJyb3IpKSB7XG5cbiAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgYXJndW1lbnRzWzFdOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuY2F1Z2h0LCB1bnNwZWNpZmllZCAnZXJyb3InIGV2ZW50LlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXI7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBoYW5kbGVyID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpXG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIHNsb3dlclxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaGFuZGxlcikge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgICB2YXIgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gKGxpc3RlbmVycy5sZW5ndGggPiAwKSB8fCAhIXRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gISF0aGlzLl9hbGw7XG4gICAgfVxuXG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMub25BbnkodHlwZSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT0gXCJuZXdMaXN0ZW5lcnNcIiEgQmVmb3JlXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lcnNcIi5cbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgZ3Jvd0xpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB7XG4gICAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICAgIH1cbiAgICBlbHNlIGlmKHR5cGVvZiB0aGlzLl9ldmVudHNbdHlwZV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuXG4gICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uQW55ID0gZnVuY3Rpb24oZm4pIHtcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb25Bbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLl9hbGwpIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXG4gICAgdGhpcy5fYWxsLnB1c2goZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gZG9lcyBub3QgdXNlIGxpc3RlbmVycygpLCBzbyBubyBzaWRlIGVmZmVjdCBvZiBjcmVhdGluZyBfZXZlbnRzW3R5cGVdXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgIGxlYWZzLnB1c2goe19saXN0ZW5lcnM6aGFuZGxlcnN9KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICBpZiAoaXNBcnJheShoYW5kbGVycykpIHtcblxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0ubGlzdGVuZXIgJiYgaGFuZGxlcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLl9vcmlnaW4gJiYgaGFuZGxlcnNbaV0uX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zaXRpb24gPCAwKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgbGVhZi5fbGlzdGVuZXJzLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFuZGxlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGhhbmRsZXJzID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAoaGFuZGxlcnMuX29yaWdpbiAmJiBoYW5kbGVycy5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmQW55ID0gZnVuY3Rpb24oZm4pIHtcbiAgICB2YXIgaSA9IDAsIGwgPSAwLCBmbnM7XG4gICAgaWYgKGZuICYmIHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoID4gMCkge1xuICAgICAgZm5zID0gdGhpcy5fYWxsO1xuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZihmbiA9PT0gZm5zW2ldKSB7XG4gICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgdmFyIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcblxuICAgICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgICBsZWFmLl9saXN0ZW5lcnMgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBoYW5kbGVycyA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVycywgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICAgIHJldHVybiBoYW5kbGVycztcbiAgICB9XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFtdO1xuICAgIGlmICghaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyc0FueSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgaWYodGhpcy5fYWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgfTtcblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRFbWl0dGVyO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIENvbW1vbkpTXG4gICAgZXhwb3J0cy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsLlxuICAgIHdpbmRvdy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG59KCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudEVtaXR0ZXIyID0gcmVxdWlyZSggJ2V2ZW50ZW1pdHRlcjInICkuRXZlbnRFbWl0dGVyMjtcblxuLypcbiAgICBkZXBlbmRlbmNpZXNcbiovXG5cbi8qIGJpbmRpbmcgKi9cbnZhciBiaW5kaW5nTWV0aG9kID0gd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgPyAnYWRkRXZlbnRMaXN0ZW5lcicgOiAnYXR0YWNoRXZlbnQnO1xudmFyIGV2ZW50UHJlZml4ID0gYmluZGluZ01ldGhvZCAhPT0gJ2FkZEV2ZW50TGlzdGVuZXInID8gJ29uJyA6ICcnO1xuXG5mdW5jdGlvbiBiaW5kKCBlbCwgdHlwZSwgZm4sIGNhcHR1cmUgKSB7XG4gICAgZWxbIGJpbmRpbmdNZXRob2QgXSggZXZlbnRQcmVmaXggKyB0eXBlLCBmbiwgY2FwdHVyZSB8fCBmYWxzZSApO1xuICAgIHJldHVybiBmbjtcbn1cblxuLyogbWF0Y2hpbmcgKi9cbnZhciB2ZW5kb3JNYXRjaCA9IEVsZW1lbnQucHJvdG90eXBlLm1hdGNoZXMgfHwgRWxlbWVudC5wcm90b3R5cGUud2Via2l0TWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm1vek1hdGNoZXNTZWxlY3RvciB8fCBFbGVtZW50LnByb3RvdHlwZS5tc01hdGNoZXNTZWxlY3RvciB8fCBFbGVtZW50LnByb3RvdHlwZS5vTWF0Y2hlc1NlbGVjdG9yO1xuXG5mdW5jdGlvbiBtYXRjaGVzKCBlbCwgc2VsZWN0b3IgKSB7XG4gICAgaWYgKCAhZWwgfHwgZWwubm9kZVR5cGUgIT09IDEgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCB2ZW5kb3JNYXRjaCApIHtcbiAgICAgICAgcmV0dXJuIHZlbmRvck1hdGNoLmNhbGwoIGVsLCBzZWxlY3RvciApO1xuICAgIH1cbiAgICB2YXIgbm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciwgZWwucGFyZW50Tm9kZSApO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIG5vZGVzWyBpIF0gPT0gZWwgKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgIFxuICAgICAgICB9IFxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbi8qIGNsb3Nlc3QgKi9cblxuZnVuY3Rpb24gY2xvc2VzdCggZWxlbWVudCwgc2VsZWN0b3IsIGNoZWNrU2VsZiwgcm9vdCApIHtcbiAgICBlbGVtZW50ID0gY2hlY2tTZWxmID8ge3BhcmVudE5vZGU6IGVsZW1lbnR9IDogZWxlbWVudDtcblxuICAgIHJvb3QgPSByb290IHx8IGRvY3VtZW50O1xuXG4gICAgLyogTWFrZSBzdXJlIGBlbGVtZW50ICE9PSBkb2N1bWVudGAgYW5kIGBlbGVtZW50ICE9IG51bGxgXG4gICAgICAgb3RoZXJ3aXNlIHdlIGdldCBhbiBpbGxlZ2FsIGludm9jYXRpb24gKi9cbiAgICB3aGlsZSAoICggZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZSApICYmIGVsZW1lbnQgIT09IGRvY3VtZW50ICkge1xuICAgICAgICBpZiAoIG1hdGNoZXMoIGVsZW1lbnQsIHNlbGVjdG9yICkgKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIEFmdGVyIGBtYXRjaGVzYCBvbiB0aGUgZWRnZSBjYXNlIHRoYXRcbiAgICAgICAgICAgdGhlIHNlbGVjdG9yIG1hdGNoZXMgdGhlIHJvb3RcbiAgICAgICAgICAgKHdoZW4gdGhlIHJvb3QgaXMgbm90IHRoZSBkb2N1bWVudCkgKi9cbiAgICAgICAgaWYgKGVsZW1lbnQgPT09IHJvb3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLypcbiAgICBlbmQgZGVwZW5kZW5jaWVzXG4qL1xuXG5mdW5jdGlvbiBFbWl0KCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBFdmVudEVtaXR0ZXIyLmNhbGwoIHNlbGYgKTtcblxuICAgIHNlbGYudmFsaWRhdG9ycyA9IFtdO1xuICAgIHNlbGYudG91Y2hNb3ZlRGVsdGEgPSAxMDtcbiAgICBzZWxmLmluaXRpYWxUb3VjaFBvaW50ID0gbnVsbDtcblxuICAgIGJpbmQoIGRvY3VtZW50LCAndG91Y2hzdGFydCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICd0b3VjaG1vdmUnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAndG91Y2hlbmQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAnY2xpY2snLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAnaW5wdXQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAnc3VibWl0Jywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbn1cblxuRW1pdC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBFdmVudEVtaXR0ZXIyLnByb3RvdHlwZSApO1xuXG5mdW5jdGlvbiB0KCkge1xuICAgIHJldHVybiB0cnVlO1xufVxuZnVuY3Rpb24gZigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFRvdWNoRGVsdGEoIGV2ZW50LCBpbml0aWFsICkge1xuICAgIHZhciBkZWx0YVggPSAoIGV2ZW50LnRvdWNoZXNbIDAgXS5wYWdlWCAtIGluaXRpYWwueCApO1xuICAgIHZhciBkZWx0YVkgPSAoIGV2ZW50LnRvdWNoZXNbIDAgXS5wYWdlWSAtIGluaXRpYWwueSApO1xuICAgIHJldHVybiBNYXRoLnNxcnQoICggZGVsdGFYICogZGVsdGFYICkgKyAoIGRlbHRhWSAqIGRlbHRhWSApICk7XG59XG5cbkVtaXQucHJvdG90eXBlLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICggdHlwZW9mKCBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCApID09ICd1bmRlZmluZWQnICkge1xuICAgICAgICBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9IGY7XG4gICAgfVxuXG4gICAgdmFyIHRvdWNoZXMgPSBldmVudC50b3VjaGVzO1xuICAgIHZhciBkZWx0YSA9IC0xO1xuICAgIHN3aXRjaCAoIGV2ZW50LnR5cGUgKSB7XG4gICAgICAgIGNhc2UgJ3RvdWNoc3RhcnQnOlxuICAgICAgICAgICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IHNlbGYubGFzdFRvdWNoUG9pbnQgPSB7XG4gICAgICAgICAgICAgICAgeDogdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCA/IHRvdWNoZXNbIDAgXS5wYWdlWCA6IDAsXG4gICAgICAgICAgICAgICAgeTogdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCA/IHRvdWNoZXNbIDAgXS5wYWdlWSA6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3RvdWNobW92ZSc6XG4gICAgICAgICAgICBpZiAoIHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggJiYgc2VsZi5pbml0aWFsVG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICBkZWx0YSA9IGdldFRvdWNoRGVsdGEoIGV2ZW50LCBzZWxmLmluaXRpYWxUb3VjaFBvaW50ICk7XG4gICAgICAgICAgICAgICAgaWYgKCBkZWx0YSA+IHNlbGYudG91Y2hNb3ZlRGVsdGEgKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYubGFzdFRvdWNoUG9pbnQgPSB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHRvdWNoZXNbIDAgXS5wYWdlWCxcbiAgICAgICAgICAgICAgICAgICAgeTogdG91Y2hlc1sgMCBdLnBhZ2VZXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnY2xpY2snOlxuICAgICAgICBjYXNlICd0b3VjaGVuZCc6XG4gICAgICAgIGNhc2UgJ2lucHV0JzpcbiAgICAgICAgY2FzZSAnc3VibWl0JzpcbiAgICAgICAgICAgIC8vIGVhdCBhbnkgbGF0ZS1maXJpbmcgY2xpY2sgZXZlbnRzIG9uIHRvdWNoIGRldmljZXNcbiAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSA9PT0gJ2NsaWNrJyAmJiBzZWxmLmxhc3RUb3VjaFBvaW50ICkge1xuICAgICAgICAgICAgICAgIGlmICggZXZlbnQudG91Y2hlcyAmJiBldmVudC50b3VjaGVzLmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsdGEgPSBnZXRUb3VjaERlbHRhKCBldmVudCwgc2VsZi5sYXN0VG91Y2hQb2ludCApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGRlbHRhIDwgc2VsZi50b3VjaE1vdmVEZWx0YSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIGNhbmNlbGluZyB0b3VjaGVzIHRoYXQgaGF2ZSBtb3ZlZCB0b28gbXVjaFxuICAgICAgICAgICAgaWYgKCBldmVudC50eXBlID09PSAndG91Y2hlbmQnICYmICFzZWxmLmluaXRpYWxUb3VjaFBvaW50ICkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHNlbGVjdG9yID0gJ1tkYXRhLWVtaXRdJztcbiAgICAgICAgICAgIHZhciBvcmlnaW5hbEVsZW1lbnQgPSBldmVudC50YXJnZXQgfHwgZXZlbnQuc3JjRWxlbWVudDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gaWYgaXQncyBhIGxpbmsgYW5kIGl0IGhhcyBubyBlbWl0IGF0dHJpYnV0ZSwgYWxsb3cgdGhlIGV2ZW50IHRvIHBhc3NcbiAgICAgICAgICAgIGlmICggIW9yaWdpbmFsRWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnICkgJiYgKCBvcmlnaW5hbEVsZW1lbnQudGFnTmFtZSA9PT0gJ0EnIHx8IG9yaWdpbmFsRWxlbWVudC50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBvcmlnaW5hbEVsZW1lbnQudGFnTmFtZSA9PT0gJ0lOUFVUJyApICkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGZvcmNlQWxsb3dEZWZhdWx0ID0gb3JpZ2luYWxFbGVtZW50LnRhZ05hbWUgPT0gJ0lOUFVUJyAmJiAoIG9yaWdpbmFsRWxlbWVudC50eXBlID09ICdjaGVja2JveCcgfHwgb3JpZ2luYWxFbGVtZW50LnR5cGUgPT0gJ3JhZGlvJyApO1xuICAgICAgICAgICAgdmFyIGVsID0gY2xvc2VzdCggb3JpZ2luYWxFbGVtZW50LCBzZWxlY3RvciwgdHJ1ZSwgZG9jdW1lbnQgKTtcblxuICAgICAgICAgICAgaWYgKCBlbCApIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVwdGggPSAtMTtcbiAgICAgICAgICAgICAgICB3aGlsZSAoIGVsICYmICFldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpICYmICsrZGVwdGggPCAxMDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKCB2YXIgdmFsaWRhdG9ySW5kZXggPSAwOyB2YWxpZGF0b3JJbmRleCA8IHNlbGYudmFsaWRhdG9ycy5sZW5ndGg7ICsrdmFsaWRhdG9ySW5kZXggKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICFzZWxmLnZhbGlkYXRvcnNbIHZhbGlkYXRvckluZGV4IF0uY2FsbCggdGhpcywgZWwsIGV2ZW50ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBlYXQgdGhlIGV2ZW50IGlmIGEgdmFsaWRhdG9yIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICBpZiAoICF2YWxpZGF0ZWQgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mKCBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCApICE9ICdmdW5jdGlvbicgfHwgIWV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkKCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgPSB0O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mKCBzZWxmLnZhbGlkYXRlICkgPT0gJ2Z1bmN0aW9uJyAmJiAhc2VsZi52YWxpZGF0ZS5jYWxsKCBzZWxmLCBlbCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIGVsLnRhZ05hbWUgPT0gJ0ZPUk0nICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBldmVudC50eXBlICE9ICdzdWJtaXQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICggZWwudGFnTmFtZSA9PSAnSU5QVVQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhKCBlbC50eXBlID09ICdzdWJtaXQnIHx8IGVsLnR5cGUgPT0gJ2NoZWNrYm94JyB8fCBlbC50eXBlID09ICdyYWRpbycgfHwgZWwudHlwZSA9PSAnZmlsZScgKSAmJiBldmVudC50eXBlICE9ICdpbnB1dCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKCBlbC50YWdOYW1lID09ICdTRUxFQ1QnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBldmVudC50eXBlICE9ICdpbnB1dCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZXZlbnQuZW1pdFRhcmdldCA9IGVsO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9lbWl0KCBlbCwgZXZlbnQsIGZvcmNlQWxsb3dEZWZhdWx0ICk7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIGRlcHRoID49IDEwMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCAnRXhjZWVkZWQgZGVwdGggbGltaXQgZm9yIEVtaXQgY2FsbHMuJyApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuZW1pdCggJ3VuaGFuZGxlZCcsIGV2ZW50ICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG5FbWl0LnByb3RvdHlwZS5fZW1pdCA9IGZ1bmN0aW9uKCBlbGVtZW50LCBldmVudCwgZm9yY2VEZWZhdWx0ICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb3B0aW9uU3RyaW5nID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQtb3B0aW9ucycgKTtcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIHZhciBpZ25vcmVTdHJpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdC1pZ25vcmUnICk7XG4gICAgdmFyIGk7XG5cbiAgICBpZiAoIGlnbm9yZVN0cmluZyAmJiBpZ25vcmVTdHJpbmcubGVuZ3RoICkge1xuICAgICAgICB2YXIgaWdub3JlZEV2ZW50cyA9IGlnbm9yZVN0cmluZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCAnICcgKTtcbiAgICAgICAgZm9yICggaSA9IDA7IGkgPCBpZ25vcmVkRXZlbnRzLmxlbmd0aDsgKytpICkge1xuICAgICAgICAgICAgaWYgKCBldmVudC50eXBlID09IGlnbm9yZWRFdmVudHNbIGkgXSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIG9wdGlvblN0cmluZyAmJiBvcHRpb25TdHJpbmcubGVuZ3RoICkge1xuICAgICAgICB2YXIgb3B0cyA9IG9wdGlvblN0cmluZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCAnICcgKTtcbiAgICAgICAgZm9yICggaSA9IDA7IGkgPCBvcHRzLmxlbmd0aDsgKytpICkge1xuICAgICAgICAgICAgb3B0aW9uc1sgb3B0c1sgaSBdIF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCAhZm9yY2VEZWZhdWx0ICYmICFvcHRpb25zLmFsbG93ZGVmYXVsdCApIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG5cbiAgICBpZiAoICFvcHRpb25zLmFsbG93cHJvcGFnYXRlICkge1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGlmICggdHlwZW9mKCBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCApICE9ICdmdW5jdGlvbicgfHwgIWV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkKCkgKSB7XG4gICAgICAgICAgICBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9IHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZW1pc3Npb25MaXN0ID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnICk7XG4gICAgaWYgKCAhZW1pc3Npb25MaXN0ICkge1xuICAgICAgICAvLyBhbGxvdyBmb3IgZW1wdHkgYmVoYXZpb3JzIHRoYXQgY2F0Y2ggZXZlbnRzXG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZW1pc3Npb25zID0gZW1pc3Npb25MaXN0LnNwbGl0KCAnLCcgKTtcbiAgICBpZiAoIG9wdGlvbnMuZGVib3VuY2UgKSB7XG4gICAgICAgIHNlbGYudGltZW91dHMgPSBzZWxmLnRpbWVvdXRzIHx8IHt9O1xuICAgICAgICBpZiAoIHNlbGYudGltZW91dHNbIGVsZW1lbnQgXSApIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCggc2VsZi50aW1lb3V0c1sgZWxlbWVudCBdICk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICB2YXIgX2VtaXNzaW9ucyA9IGVtaXNzaW9ucztcbiAgICAgICAgICAgIHZhciBfZXZlbnQgPSBldmVudDtcbiAgICAgICAgICAgIHNlbGYudGltZW91dHNbIGVsZW1lbnQgXSA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF9lbWlzc2lvbnMuZm9yRWFjaCggZnVuY3Rpb24oIGVtaXNzaW9uICkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmVtaXQoIGVtaXNzaW9uLCBfZXZlbnQgKTtcbiAgICAgICAgICAgICAgICB9ICk7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KCBzZWxmLnRpbWVvdXRzWyBfZWxlbWVudCBdICk7XG4gICAgICAgICAgICAgICAgc2VsZi50aW1lb3V0c1sgX2VsZW1lbnQgXSA9IG51bGw7XG4gICAgICAgICAgICB9LCAyNTAgKTtcbiAgICAgICAgfSApKCk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBlbWlzc2lvbnMuZm9yRWFjaCggZnVuY3Rpb24oIGVtaXNzaW9uICkge1xuICAgICAgICBzZWxmLmVtaXQoIGVtaXNzaW9uLCBldmVudCApO1xuICAgIH0gKTtcbn07XG5cbkVtaXQucHJvdG90eXBlLmFkZFZhbGlkYXRvciA9IGZ1bmN0aW9uKCB2YWxpZGF0b3IgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGZvdW5kID0gZmFsc2U7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIHNlbGYudmFsaWRhdG9yc1sgaSBdID09IHZhbGlkYXRvciApIHtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCBmb3VuZCApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHNlbGYudmFsaWRhdG9ycy5wdXNoKCB2YWxpZGF0b3IgKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkVtaXQucHJvdG90eXBlLnJlbW92ZVZhbGlkYXRvciA9IGZ1bmN0aW9uKCB2YWxpZGF0b3IgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGZvdW5kID0gZmFsc2U7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIHNlbGYudmFsaWRhdG9yc1sgaSBdID09IHZhbGlkYXRvciApIHtcbiAgICAgICAgICAgIHNlbGYudmFsaWRhdG9ycy5zcGxpY2UoIGksIDEgKTtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZvdW5kO1xufTtcblxuRW1pdC5zaW5nbGV0b24gPSBFbWl0LnNpbmdsZXRvbiB8fCBuZXcgRW1pdCgpO1xuRW1pdC5zaW5nbGV0b24uRW1pdCA9IEVtaXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdC5zaW5nbGV0b247Il19
