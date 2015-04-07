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

function getTouchDelta( event, initial ) {
    var deltaX = ( event.touches[ 0 ].pageX - initial.x );
    var deltaY = ( event.touches[ 0 ].pageY - initial.y );
    return Math.sqrt( ( deltaX * deltaX ) + ( deltaY * deltaY ) );
}

Emit.prototype.handleEvent = function( event ) {
    var self = this;

    var touches = event.touches;
    var delta = -1;

    if ( typeof event.propagationStoppedAt !== 'number' || isNaN( event.propagationStoppedAt ) ) {
        event.propagationStoppedAt = 100; // highest possible value
    }

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

            var selector = 'a,button,input,[data-emit]';
            var originalElement = event.target || event.srcElement;
            var el = originalElement;
            
            var depth = -1;
            var handled = false;
            while( el && event.propagationStoppedAt > depth && ++depth < 100 ) {
                event.emitTarget = el;
                event.depth = depth;
                
                if ( !el.hasAttribute( 'data-emit' ) ) {
                    // if it's a link, button or input and it has no emit attribute, allow the event to pass
                    if ( el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'INPUT' ) {
                        return;
                    }
                    else {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                }

                var forceAllowDefault = el.tagName == 'INPUT' && ( el.type == 'checkbox' || el.type == 'radio' );

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
                    event.propagationStoppedAt = depth;
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

                handled |= self._emit( el, event, forceAllowDefault );
                el = closest( el, selector, false, document );
            }
            
            if ( !handled ) {
                self.emit( 'unhandled', event );
            }
            else if ( depth >= 100 ) {
                throw new Error( 'Exceeded depth limit for Emit calls.' );
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
                return false;
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
        event.propagationStoppedAt = event.depth;
    }

    var emissionList = element.getAttribute( 'data-emit' );
    if ( !emissionList ) {
        // allow for empty behaviors that catch events
        return true;
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

        return true;
    }
    
    emissions.forEach( function( emission ) {
        self.emit( emission, event );
    } );
    
    return true;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMi9saWIvZXZlbnRlbWl0dGVyMi5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiFcbiAqIEV2ZW50RW1pdHRlcjJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9oaWoxbngvRXZlbnRFbWl0dGVyMlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBoaWoxbnhcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuOyFmdW5jdGlvbih1bmRlZmluZWQpIHtcblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgPyBBcnJheS5pc0FycmF5IDogZnVuY3Rpb24gX2lzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XG4gIH07XG4gIHZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbiAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBpZiAodGhpcy5fY29uZikge1xuICAgICAgY29uZmlndXJlLmNhbGwodGhpcywgdGhpcy5fY29uZik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29uZmlndXJlKGNvbmYpIHtcbiAgICBpZiAoY29uZikge1xuXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcblxuICAgICAgY29uZi5kZWxpbWl0ZXIgJiYgKHRoaXMuZGVsaW1pdGVyID0gY29uZi5kZWxpbWl0ZXIpO1xuICAgICAgY29uZi5tYXhMaXN0ZW5lcnMgJiYgKHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBjb25mLm1heExpc3RlbmVycyk7XG4gICAgICBjb25mLndpbGRjYXJkICYmICh0aGlzLndpbGRjYXJkID0gY29uZi53aWxkY2FyZCk7XG4gICAgICBjb25mLm5ld0xpc3RlbmVyICYmICh0aGlzLm5ld0xpc3RlbmVyID0gY29uZi5uZXdMaXN0ZW5lcik7XG5cbiAgICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJUcmVlID0ge307XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRXZlbnRFbWl0dGVyKGNvbmYpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICB0aGlzLm5ld0xpc3RlbmVyID0gZmFsc2U7XG4gICAgY29uZmlndXJlLmNhbGwodGhpcywgY29uZik7XG4gIH1cblxuICAvL1xuICAvLyBBdHRlbnRpb24sIGZ1bmN0aW9uIHJldHVybiB0eXBlIG5vdyBpcyBhcnJheSwgYWx3YXlzICFcbiAgLy8gSXQgaGFzIHplcm8gZWxlbWVudHMgaWYgbm8gYW55IG1hdGNoZXMgZm91bmQgYW5kIG9uZSBvciBtb3JlXG4gIC8vIGVsZW1lbnRzIChsZWFmcykgaWYgdGhlcmUgYXJlIG1hdGNoZXNcbiAgLy9cbiAgZnVuY3Rpb24gc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCBpKSB7XG4gICAgaWYgKCF0cmVlKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHZhciBsaXN0ZW5lcnM9W10sIGxlYWYsIGxlbiwgYnJhbmNoLCB4VHJlZSwgeHhUcmVlLCBpc29sYXRlZEJyYW5jaCwgZW5kUmVhY2hlZCxcbiAgICAgICAgdHlwZUxlbmd0aCA9IHR5cGUubGVuZ3RoLCBjdXJyZW50VHlwZSA9IHR5cGVbaV0sIG5leHRUeXBlID0gdHlwZVtpKzFdO1xuICAgIGlmIChpID09PSB0eXBlTGVuZ3RoICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgLy9cbiAgICAgIC8vIElmIGF0IHRoZSBlbmQgb2YgdGhlIGV2ZW50KHMpIGxpc3QgYW5kIHRoZSB0cmVlIGhhcyBsaXN0ZW5lcnNcbiAgICAgIC8vIGludm9rZSB0aG9zZSBsaXN0ZW5lcnMuXG4gICAgICAvL1xuICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZWFmID0gMCwgbGVuID0gdHJlZS5fbGlzdGVuZXJzLmxlbmd0aDsgbGVhZiA8IGxlbjsgbGVhZisrKSB7XG4gICAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnNbbGVhZl0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjdXJyZW50VHlwZSA9PT0gJyonIHx8IGN1cnJlbnRUeXBlID09PSAnKionKSB8fCB0cmVlW2N1cnJlbnRUeXBlXSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBldmVudCBlbWl0dGVkIGlzICcqJyBhdCB0aGlzIHBhcnRcbiAgICAgIC8vIG9yIHRoZXJlIGlzIGEgY29uY3JldGUgbWF0Y2ggYXQgdGhpcyBwYXRjaFxuICAgICAgLy9cbiAgICAgIGlmIChjdXJyZW50VHlwZSA9PT0gJyonKSB7XG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzEpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH0gZWxzZSBpZihjdXJyZW50VHlwZSA9PT0gJyoqJykge1xuICAgICAgICBlbmRSZWFjaGVkID0gKGkrMSA9PT0gdHlwZUxlbmd0aCB8fCAoaSsyID09PSB0eXBlTGVuZ3RoICYmIG5leHRUeXBlID09PSAnKicpKTtcbiAgICAgICAgaWYoZW5kUmVhY2hlZCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBUaGUgbmV4dCBlbGVtZW50IGhhcyBhIF9saXN0ZW5lcnMsIGFkZCBpdCB0byB0aGUgaGFuZGxlcnMuXG4gICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09ICcqJyB8fCBicmFuY2ggPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgaWYodHJlZVticmFuY2hdLl9saXN0ZW5lcnMgJiYgIWVuZFJlYWNoZWQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBObyBtYXRjaCBvbiB0aGlzIG9uZSwgc2hpZnQgaW50byB0aGUgdHJlZSBidXQgbm90IGluIHRoZSB0eXBlIGFycmF5LlxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9XG5cbiAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2N1cnJlbnRUeXBlXSwgaSsxKSk7XG4gICAgfVxuXG4gICAgeFRyZWUgPSB0cmVlWycqJ107XG4gICAgaWYgKHhUcmVlKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGxpc3RlbmVyIHRyZWUgd2lsbCBhbGxvdyBhbnkgbWF0Y2ggZm9yIHRoaXMgcGFydCxcbiAgICAgIC8vIHRoZW4gcmVjdXJzaXZlbHkgZXhwbG9yZSBhbGwgYnJhbmNoZXMgb2YgdGhlIHRyZWVcbiAgICAgIC8vXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHhUcmVlLCBpKzEpO1xuICAgIH1cblxuICAgIHh4VHJlZSA9IHRyZWVbJyoqJ107XG4gICAgaWYoeHhUcmVlKSB7XG4gICAgICBpZihpIDwgdHlwZUxlbmd0aCkge1xuICAgICAgICBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBsaXN0ZW5lciBvbiBhICcqKicsIGl0IHdpbGwgY2F0Y2ggYWxsLCBzbyBhZGQgaXRzIGhhbmRsZXIuXG4gICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQnVpbGQgYXJyYXlzIG9mIG1hdGNoaW5nIG5leHQgYnJhbmNoZXMgYW5kIG90aGVycy5cbiAgICAgICAgZm9yKGJyYW5jaCBpbiB4eFRyZWUpIHtcbiAgICAgICAgICBpZihicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB4eFRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICAvLyBXZSBrbm93IHRoZSBuZXh0IGVsZW1lbnQgd2lsbCBtYXRjaCwgc28ganVtcCB0d2ljZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IGN1cnJlbnRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIEN1cnJlbnQgbm9kZSBtYXRjaGVzLCBtb3ZlIGludG8gdGhlIHRyZWUuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaCA9IHt9O1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaFticmFuY2hdID0geHhUcmVlW2JyYW5jaF07XG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeyAnKionOiBpc29sYXRlZEJyYW5jaCB9LCBpKzEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIC8vIFdlIGhhdmUgcmVhY2hlZCB0aGUgZW5kIGFuZCBzdGlsbCBvbiBhICcqKidcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgfSBlbHNlIGlmKHh4VHJlZVsnKiddICYmIHh4VHJlZVsnKiddLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbJyonXSwgdHlwZUxlbmd0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpc3RlbmVycztcbiAgfVxuXG4gIGZ1bmN0aW9uIGdyb3dMaXN0ZW5lclRyZWUodHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIHR5cGUgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcblxuICAgIC8vXG4gICAgLy8gTG9va3MgZm9yIHR3byBjb25zZWN1dGl2ZSAnKionLCBpZiBzbywgZG9uJ3QgYWRkIHRoZSBldmVudCBhdCBhbGwuXG4gICAgLy9cbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0eXBlLmxlbmd0aDsgaSsxIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmKHR5cGVbaV0gPT09ICcqKicgJiYgdHlwZVtpKzFdID09PSAnKionKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdHJlZSA9IHRoaXMubGlzdGVuZXJUcmVlO1xuICAgIHZhciBuYW1lID0gdHlwZS5zaGlmdCgpO1xuXG4gICAgd2hpbGUgKG5hbWUpIHtcblxuICAgICAgaWYgKCF0cmVlW25hbWVdKSB7XG4gICAgICAgIHRyZWVbbmFtZV0gPSB7fTtcbiAgICAgIH1cblxuICAgICAgdHJlZSA9IHRyZWVbbmFtZV07XG5cbiAgICAgIGlmICh0eXBlLmxlbmd0aCA9PT0gMCkge1xuXG4gICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gbGlzdGVuZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gW3RyZWUuX2xpc3RlbmVycywgbGlzdGVuZXJdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkodHJlZS5fbGlzdGVuZXJzKSkge1xuXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMud2FybmVkKSB7XG5cbiAgICAgICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG0gPiAwICYmIHRyZWUuX2xpc3RlbmVycy5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5sZW5ndGgpO1xuICAgICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgbmFtZSA9IHR5cGUuc2hpZnQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuXG4gIC8vIDEwIGxpc3RlbmVycyBhcmUgYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaFxuICAvLyBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbiAgLy9cbiAgLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4gIC8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZGVsaW1pdGVyID0gJy4nO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IG47XG4gICAgaWYgKCF0aGlzLl9jb25mKSB0aGlzLl9jb25mID0ge307XG4gICAgdGhpcy5fY29uZi5tYXhMaXN0ZW5lcnMgPSBuO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZXZlbnQgPSAnJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pIHtcbiAgICB0aGlzLm1hbnkoZXZlbnQsIDEsIGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm1hbnkgPSBmdW5jdGlvbihldmVudCwgdHRsLCBmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIoKSB7XG4gICAgICBpZiAoLS10dGwgPT09IDApIHtcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgbGlzdGVuZXIuX29yaWdpbiA9IGZuO1xuXG4gICAgdGhpcy5vbihldmVudCwgbGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XG5cbiAgICBpZiAodHlwZSA9PT0gJ25ld0xpc3RlbmVyJyAmJiAhdGhpcy5uZXdMaXN0ZW5lcikge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfVxuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSAqX2FsbCogZnVuY3Rpb25zIGFuZCBpbnZva2UgdGhlbS5cbiAgICBpZiAodGhpcy5fYWxsKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKGkgPSAwLCBsID0gdGhpcy5fYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgdGhpcy5fYWxsW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuXG4gICAgICBpZiAoIXRoaXMuX2FsbCAmJlxuICAgICAgICAhdGhpcy5fZXZlbnRzLmVycm9yICYmXG4gICAgICAgICEodGhpcy53aWxkY2FyZCAmJiB0aGlzLmxpc3RlbmVyVHJlZS5lcnJvcikpIHtcblxuICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBhcmd1bWVudHNbMV07IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcjtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGhhbmRsZXIgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlciwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSlcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gc2xvd2VyXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmIChoYW5kbGVyKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICAgIHZhciBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAobGlzdGVuZXJzLmxlbmd0aCA+IDApIHx8ICEhdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiAhIXRoaXMuX2FsbDtcbiAgICB9XG5cbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb24gb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcbiAgICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyc1wiLlxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBncm93TGlzdGVuZXJUcmVlLmNhbGwodGhpcywgdHlwZSwgbGlzdGVuZXIpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcbiAgICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gICAgfVxuICAgIGVsc2UgaWYodHlwZW9mIHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG5cbiAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25BbnkgPSBmdW5jdGlvbihmbikge1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbkFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgaWYoIXRoaXMuX2FsbCkge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBmdW5jdGlvbiB0byB0aGUgZXZlbnQgbGlzdGVuZXIgY29sbGVjdGlvbi5cbiAgICB0aGlzLl9hbGwucHVzaChmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub247XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlTGlzdGVuZXIgb25seSB0YWtlcyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcnMsbGVhZnM9W107XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIGhhbmRsZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xuICAgIH1cblxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICBoYW5kbGVycyA9IGxlYWYuX2xpc3RlbmVycztcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xuXG4gICAgICAgIHZhciBwb3NpdGlvbiA9IC0xO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChoYW5kbGVyc1tpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0uX29yaWdpbiAmJiBoYW5kbGVyc1tpXS5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3NpdGlvbiA8IDApIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoaGFuZGxlcnMgPT09IGxpc3RlbmVyIHx8XG4gICAgICAgIChoYW5kbGVycy5saXN0ZW5lciAmJiBoYW5kbGVycy5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmZBbnkgPSBmdW5jdGlvbihmbikge1xuICAgIHZhciBpID0gMCwgbCA9IDAsIGZucztcbiAgICBpZiAoZm4gJiYgdGhpcy5fYWxsICYmIHRoaXMuX2FsbC5sZW5ndGggPiAwKSB7XG4gICAgICBmbnMgPSB0aGlzLl9hbGw7XG4gICAgICBmb3IoaSA9IDAsIGwgPSBmbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmKGZuID09PSBmbnNbaV0pIHtcbiAgICAgICAgICBmbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmY7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICF0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICB2YXIgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuXG4gICAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICAgIGxlYWYuX2xpc3RlbmVycyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIGhhbmRsZXJzID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXJzLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgICAgcmV0dXJuIGhhbmRsZXJzO1xuICAgIH1cblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgdGhpcy5fZXZlbnRzW3R5cGVdID0gW107XG4gICAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzQW55ID0gZnVuY3Rpb24oKSB7XG5cbiAgICBpZih0aGlzLl9hbGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICB9O1xuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gQ29tbW9uSlNcbiAgICBleHBvcnRzLkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXG4gICAgd2luZG93LkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbn0oKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCAnZXZlbnRlbWl0dGVyMicgKS5FdmVudEVtaXR0ZXIyO1xuXG4vKlxuICAgIGRlcGVuZGVuY2llc1xuKi9cblxuLyogYmluZGluZyAqL1xudmFyIGJpbmRpbmdNZXRob2QgPSB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCc7XG52YXIgZXZlbnRQcmVmaXggPSBiaW5kaW5nTWV0aG9kICE9PSAnYWRkRXZlbnRMaXN0ZW5lcicgPyAnb24nIDogJyc7XG5cbmZ1bmN0aW9uIGJpbmQoIGVsLCB0eXBlLCBmbiwgY2FwdHVyZSApIHtcbiAgICBlbFsgYmluZGluZ01ldGhvZCBdKCBldmVudFByZWZpeCArIHR5cGUsIGZuLCBjYXB0dXJlIHx8IGZhbHNlICk7XG4gICAgcmV0dXJuIGZuO1xufVxuXG4vKiBtYXRjaGluZyAqL1xudmFyIHZlbmRvck1hdGNoID0gRWxlbWVudC5wcm90b3R5cGUubWF0Y2hlcyB8fCBFbGVtZW50LnByb3RvdHlwZS53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHwgRWxlbWVudC5wcm90b3R5cGUubW96TWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm1zTWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm9NYXRjaGVzU2VsZWN0b3I7XG5cbmZ1bmN0aW9uIG1hdGNoZXMoIGVsLCBzZWxlY3RvciApIHtcbiAgICBpZiAoICFlbCB8fCBlbC5ub2RlVHlwZSAhPT0gMSApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIHZlbmRvck1hdGNoICkge1xuICAgICAgICByZXR1cm4gdmVuZG9yTWF0Y2guY2FsbCggZWwsIHNlbGVjdG9yICk7XG4gICAgfVxuICAgIHZhciBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yLCBlbC5wYXJlbnROb2RlICk7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgIGlmICggbm9kZXNbIGkgXSA9PSBlbCApIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAgXG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLyogY2xvc2VzdCAqL1xuXG5mdW5jdGlvbiBjbG9zZXN0KCBlbGVtZW50LCBzZWxlY3RvciwgY2hlY2tTZWxmLCByb290ICkge1xuICAgIGVsZW1lbnQgPSBjaGVja1NlbGYgPyB7cGFyZW50Tm9kZTogZWxlbWVudH0gOiBlbGVtZW50O1xuXG4gICAgcm9vdCA9IHJvb3QgfHwgZG9jdW1lbnQ7XG5cbiAgICAvKiBNYWtlIHN1cmUgYGVsZW1lbnQgIT09IGRvY3VtZW50YCBhbmQgYGVsZW1lbnQgIT0gbnVsbGBcbiAgICAgICBvdGhlcndpc2Ugd2UgZ2V0IGFuIGlsbGVnYWwgaW52b2NhdGlvbiAqL1xuICAgIHdoaWxlICggKCBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlICkgJiYgZWxlbWVudCAhPT0gZG9jdW1lbnQgKSB7XG4gICAgICAgIGlmICggbWF0Y2hlcyggZWxlbWVudCwgc2VsZWN0b3IgKSApIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogQWZ0ZXIgYG1hdGNoZXNgIG9uIHRoZSBlZGdlIGNhc2UgdGhhdFxuICAgICAgICAgICB0aGUgc2VsZWN0b3IgbWF0Y2hlcyB0aGUgcm9vdFxuICAgICAgICAgICAod2hlbiB0aGUgcm9vdCBpcyBub3QgdGhlIGRvY3VtZW50KSAqL1xuICAgICAgICBpZiAoZWxlbWVudCA9PT0gcm9vdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKlxuICAgIGVuZCBkZXBlbmRlbmNpZXNcbiovXG5cbmZ1bmN0aW9uIEVtaXQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIEV2ZW50RW1pdHRlcjIuY2FsbCggc2VsZiApO1xuXG4gICAgc2VsZi52YWxpZGF0b3JzID0gW107XG4gICAgc2VsZi50b3VjaE1vdmVEZWx0YSA9IDEwO1xuICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuXG4gICAgYmluZCggZG9jdW1lbnQsICd0b3VjaHN0YXJ0Jywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNobW92ZScsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICd0b3VjaGVuZCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdjbGljaycsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdpbnB1dCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdzdWJtaXQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xufVxuXG5FbWl0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIEV2ZW50RW1pdHRlcjIucHJvdG90eXBlICk7XG5cbmZ1bmN0aW9uIGdldFRvdWNoRGVsdGEoIGV2ZW50LCBpbml0aWFsICkge1xuICAgIHZhciBkZWx0YVggPSAoIGV2ZW50LnRvdWNoZXNbIDAgXS5wYWdlWCAtIGluaXRpYWwueCApO1xuICAgIHZhciBkZWx0YVkgPSAoIGV2ZW50LnRvdWNoZXNbIDAgXS5wYWdlWSAtIGluaXRpYWwueSApO1xuICAgIHJldHVybiBNYXRoLnNxcnQoICggZGVsdGFYICogZGVsdGFYICkgKyAoIGRlbHRhWSAqIGRlbHRhWSApICk7XG59XG5cbkVtaXQucHJvdG90eXBlLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciB0b3VjaGVzID0gZXZlbnQudG91Y2hlcztcbiAgICB2YXIgZGVsdGEgPSAtMTtcblxuICAgIGlmICggdHlwZW9mIGV2ZW50LnByb3BhZ2F0aW9uU3RvcHBlZEF0ICE9PSAnbnVtYmVyJyB8fCBpc05hTiggZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkQXQgKSApIHtcbiAgICAgICAgZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkQXQgPSAxMDA7IC8vIGhpZ2hlc3QgcG9zc2libGUgdmFsdWVcbiAgICB9XG5cbiAgICBzd2l0Y2ggKCBldmVudC50eXBlICkge1xuICAgICAgICBjYXNlICd0b3VjaHN0YXJ0JzpcbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBzZWxmLmxhc3RUb3VjaFBvaW50ID0ge1xuICAgICAgICAgICAgICAgIHg6IHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggPyB0b3VjaGVzWyAwIF0ucGFnZVggOiAwLFxuICAgICAgICAgICAgICAgIHk6IHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggPyB0b3VjaGVzWyAwIF0ucGFnZVkgOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd0b3VjaG1vdmUnOlxuICAgICAgICAgICAgaWYgKCB0b3VjaGVzICYmIHRvdWNoZXMubGVuZ3RoICYmIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgKSB7XG4gICAgICAgICAgICAgICAgZGVsdGEgPSBnZXRUb3VjaERlbHRhKCBldmVudCwgc2VsZi5pbml0aWFsVG91Y2hQb2ludCApO1xuICAgICAgICAgICAgICAgIGlmICggZGVsdGEgPiBzZWxmLnRvdWNoTW92ZURlbHRhICkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmluaXRpYWxUb3VjaFBvaW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWxmLmxhc3RUb3VjaFBvaW50ID0ge1xuICAgICAgICAgICAgICAgICAgICB4OiB0b3VjaGVzWyAwIF0ucGFnZVgsXG4gICAgICAgICAgICAgICAgICAgIHk6IHRvdWNoZXNbIDAgXS5wYWdlWVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2NsaWNrJzpcbiAgICAgICAgY2FzZSAndG91Y2hlbmQnOlxuICAgICAgICBjYXNlICdpbnB1dCc6XG4gICAgICAgIGNhc2UgJ3N1Ym1pdCc6XG4gICAgICAgICAgICAvLyBlYXQgYW55IGxhdGUtZmlyaW5nIGNsaWNrIGV2ZW50cyBvbiB0b3VjaCBkZXZpY2VzXG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT09ICdjbGljaycgJiYgc2VsZi5sYXN0VG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICBpZiAoIGV2ZW50LnRvdWNoZXMgJiYgZXZlbnQudG91Y2hlcy5sZW5ndGggKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbHRhID0gZ2V0VG91Y2hEZWx0YSggZXZlbnQsIHNlbGYubGFzdFRvdWNoUG9pbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBkZWx0YSA8IHNlbGYudG91Y2hNb3ZlRGVsdGEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBjYW5jZWxpbmcgdG91Y2hlcyB0aGF0IGhhdmUgbW92ZWQgdG9vIG11Y2hcbiAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSA9PT0gJ3RvdWNoZW5kJyAmJiAhc2VsZi5pbml0aWFsVG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzZWxlY3RvciA9ICdhLGJ1dHRvbixpbnB1dCxbZGF0YS1lbWl0XSc7XG4gICAgICAgICAgICB2YXIgb3JpZ2luYWxFbGVtZW50ID0gZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQ7XG4gICAgICAgICAgICB2YXIgZWwgPSBvcmlnaW5hbEVsZW1lbnQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBkZXB0aCA9IC0xO1xuICAgICAgICAgICAgdmFyIGhhbmRsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHdoaWxlKCBlbCAmJiBldmVudC5wcm9wYWdhdGlvblN0b3BwZWRBdCA+IGRlcHRoICYmICsrZGVwdGggPCAxMDAgKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuZW1pdFRhcmdldCA9IGVsO1xuICAgICAgICAgICAgICAgIGV2ZW50LmRlcHRoID0gZGVwdGg7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhZWwuaGFzQXR0cmlidXRlKCAnZGF0YS1lbWl0JyApICkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBpdCdzIGEgbGluaywgYnV0dG9uIG9yIGlucHV0IGFuZCBpdCBoYXMgbm8gZW1pdCBhdHRyaWJ1dGUsIGFsbG93IHRoZSBldmVudCB0byBwYXNzXG4gICAgICAgICAgICAgICAgICAgIGlmICggZWwudGFnTmFtZSA9PT0gJ0EnIHx8IGVsLnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBmb3JjZUFsbG93RGVmYXVsdCA9IGVsLnRhZ05hbWUgPT0gJ0lOUFVUJyAmJiAoIGVsLnR5cGUgPT0gJ2NoZWNrYm94JyB8fCBlbC50eXBlID09ICdyYWRpbycgKTtcblxuICAgICAgICAgICAgICAgIHZhciB2YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGZvciAoIHZhciB2YWxpZGF0b3JJbmRleCA9IDA7IHZhbGlkYXRvckluZGV4IDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKyt2YWxpZGF0b3JJbmRleCApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAhc2VsZi52YWxpZGF0b3JzWyB2YWxpZGF0b3JJbmRleCBdLmNhbGwoIHRoaXMsIGVsLCBldmVudCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGVhdCB0aGUgZXZlbnQgaWYgYSB2YWxpZGF0b3IgZmFpbGVkXG4gICAgICAgICAgICAgICAgaWYgKCAhdmFsaWRhdGVkICkge1xuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkQXQgPSBkZXB0aDtcbiAgICAgICAgICAgICAgICAgICAgZWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YoIHNlbGYudmFsaWRhdGUgKSA9PSAnZnVuY3Rpb24nICYmICFzZWxmLnZhbGlkYXRlLmNhbGwoIHNlbGYsIGVsICkgKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCBlbC50YWdOYW1lID09ICdGT1JNJyApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBldmVudC50eXBlICE9ICdzdWJtaXQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIGVsLnRhZ05hbWUgPT0gJ0lOUFVUJyApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAhKCBlbC50eXBlID09ICdzdWJtaXQnIHx8IGVsLnR5cGUgPT0gJ2NoZWNrYm94JyB8fCBlbC50eXBlID09ICdyYWRpbycgfHwgZWwudHlwZSA9PSAnZmlsZScgKSAmJiBldmVudC50eXBlICE9ICdpbnB1dCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICggZWwudGFnTmFtZSA9PSAnU0VMRUNUJyApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBldmVudC50eXBlICE9ICdpbnB1dCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhhbmRsZWQgfD0gc2VsZi5fZW1pdCggZWwsIGV2ZW50LCBmb3JjZUFsbG93RGVmYXVsdCApO1xuICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCAhaGFuZGxlZCApIHtcbiAgICAgICAgICAgICAgICBzZWxmLmVtaXQoICd1bmhhbmRsZWQnLCBldmVudCApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoIGRlcHRoID49IDEwMCApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoICdFeGNlZWRlZCBkZXB0aCBsaW1pdCBmb3IgRW1pdCBjYWxscy4nICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG5FbWl0LnByb3RvdHlwZS5fZW1pdCA9IGZ1bmN0aW9uKCBlbGVtZW50LCBldmVudCwgZm9yY2VEZWZhdWx0ICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBvcHRpb25TdHJpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdC1vcHRpb25zJyApO1xuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgdmFyIGlnbm9yZVN0cmluZyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0LWlnbm9yZScgKTtcbiAgICB2YXIgaTtcblxuICAgIGlmICggaWdub3JlU3RyaW5nICYmIGlnbm9yZVN0cmluZy5sZW5ndGggKSB7XG4gICAgICAgIHZhciBpZ25vcmVkRXZlbnRzID0gaWdub3JlU3RyaW5nLnRvTG93ZXJDYXNlKCkuc3BsaXQoICcgJyApO1xuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IGlnbm9yZWRFdmVudHMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT0gaWdub3JlZEV2ZW50c1sgaSBdICkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICggb3B0aW9uU3RyaW5nICYmIG9wdGlvblN0cmluZy5sZW5ndGggKSB7XG4gICAgICAgIHZhciBvcHRzID0gb3B0aW9uU3RyaW5nLnRvTG93ZXJDYXNlKCkuc3BsaXQoICcgJyApO1xuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IG9wdHMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBvcHRpb25zWyBvcHRzWyBpIF0gXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoICFmb3JjZURlZmF1bHQgJiYgIW9wdGlvbnMuYWxsb3dkZWZhdWx0ICkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIGlmICggIW9wdGlvbnMuYWxsb3dwcm9wYWdhdGUgKSB7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBldmVudC5wcm9wYWdhdGlvblN0b3BwZWRBdCA9IGV2ZW50LmRlcHRoO1xuICAgIH1cblxuICAgIHZhciBlbWlzc2lvbkxpc3QgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcgKTtcbiAgICBpZiAoICFlbWlzc2lvbkxpc3QgKSB7XG4gICAgICAgIC8vIGFsbG93IGZvciBlbXB0eSBiZWhhdmlvcnMgdGhhdCBjYXRjaCBldmVudHNcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdmFyIGVtaXNzaW9ucyA9IGVtaXNzaW9uTGlzdC5zcGxpdCggJywnICk7XG4gICAgaWYgKCBvcHRpb25zLmRlYm91bmNlICkge1xuICAgICAgICBzZWxmLnRpbWVvdXRzID0gc2VsZi50aW1lb3V0cyB8fCB7fTtcbiAgICAgICAgaWYgKCBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoIHNlbGYudGltZW91dHNbIGVsZW1lbnQgXSApO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICAgICAgdmFyIF9lbWlzc2lvbnMgPSBlbWlzc2lvbnM7XG4gICAgICAgICAgICB2YXIgX2V2ZW50ID0gZXZlbnQ7XG4gICAgICAgICAgICBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gPSBzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBfZW1pc3Npb25zLmZvckVhY2goIGZ1bmN0aW9uKCBlbWlzc2lvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lbWl0KCBlbWlzc2lvbiwgX2V2ZW50ICk7XG4gICAgICAgICAgICAgICAgfSApO1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCggc2VsZi50aW1lb3V0c1sgX2VsZW1lbnQgXSApO1xuICAgICAgICAgICAgICAgIHNlbGYudGltZW91dHNbIF9lbGVtZW50IF0gPSBudWxsO1xuICAgICAgICAgICAgfSwgMjUwICk7XG4gICAgICAgIH0gKSgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBlbWlzc2lvbnMuZm9yRWFjaCggZnVuY3Rpb24oIGVtaXNzaW9uICkge1xuICAgICAgICBzZWxmLmVtaXQoIGVtaXNzaW9uLCBldmVudCApO1xuICAgIH0gKTtcbiAgICBcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkVtaXQucHJvdG90eXBlLmFkZFZhbGlkYXRvciA9IGZ1bmN0aW9uKCB2YWxpZGF0b3IgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGZvdW5kID0gZmFsc2U7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIHNlbGYudmFsaWRhdG9yc1sgaSBdID09IHZhbGlkYXRvciApIHtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCBmb3VuZCApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHNlbGYudmFsaWRhdG9ycy5wdXNoKCB2YWxpZGF0b3IgKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkVtaXQucHJvdG90eXBlLnJlbW92ZVZhbGlkYXRvciA9IGZ1bmN0aW9uKCB2YWxpZGF0b3IgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGZvdW5kID0gZmFsc2U7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIHNlbGYudmFsaWRhdG9yc1sgaSBdID09IHZhbGlkYXRvciApIHtcbiAgICAgICAgICAgIHNlbGYudmFsaWRhdG9ycy5zcGxpY2UoIGksIDEgKTtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZvdW5kO1xufTtcblxuRW1pdC5zaW5nbGV0b24gPSBFbWl0LnNpbmdsZXRvbiB8fCBuZXcgRW1pdCgpO1xuRW1pdC5zaW5nbGV0b24uRW1pdCA9IEVtaXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdC5zaW5nbGV0b247XG4iXX0=
