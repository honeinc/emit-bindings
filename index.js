var Emitter = require( 'emitter' );
var bind = require( 'event' ).bind;
var closest = require( 'closest' );

module.exports = Emit.singleton || ( Emit.singleton = new Emit() );

function Emit( options ) {
    var self = this;
    Emitter( self );
    
    self.validators = [];
    self.touchMoveDelta = 10;
    self.initialTouchPoint = null;

    bind( document, 'touchstart', self );
    bind( document, 'touchmove', self );
    bind( document, 'touchend', self );
    bind( document, 'click', self );
    bind( document, 'input', self );
    bind( document, 'submit', self );
}

var t = function() { return true; };
var f = function() { return false; };

function GetTouchDelta( event, initial ) {
    var deltaX = ( event.touches[ 0 ].pageX - initial.x );
    var deltaY = ( event.touches[ 0 ].pageY - initial.y );
    return Math.sqrt( ( deltaX * deltaX ) + ( deltaY * deltaY ) );
}

Emit.prototype.handleEvent = function( event ) {
    var self = this;

    if ( typeof( event.isPropagationStopped ) == 'undefined' )
    {
        event.isPropagationStopped = f;
    }
    
    switch( event.type )
    {
        case 'touchstart':
            var touches = event.touches;
            
            self.initialTouchPoint = self.lastTouchPoint = {
                x: touches && touches.length ? touches[ 0 ].pageX : 0,
                y: touches && touches.length ? touches[ 0 ].pageY : 0
            };

            break;
        
        case 'touchmove':
            var touches = event.touches;
    
            if ( touches && touches.length && self.initialTouchPoint )
            {
                var delta = GetTouchDelta( event, self.initialTouchPoint );
                if ( delta > self.touchMoveDelta )
                {
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
            if ( event.type == 'click' && self.lastTouchPoint )
            {
                if ( event.touches && event.touches.length )
                {
                    var delta = GetTouchDelta( event, self.lastTouchPoint );
                    if ( delta < self.touchMoveDelta )
                    {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                }
            }

            var selector = '[data-emit]';
            var originalElement = event.target || event.srcElement;
            var forceAllowDefault = originalElement.tagName == 'INPUT' && ( originalElement.type == 'checkbox' || originalElement.type == 'radio' );
            var el = closest( originalElement, selector, true, document );
            
            if ( el )
            {
                var depth = -1;
                while( el && !event.isPropagationStopped() && ++depth < 100 )
                {
                    var validated = true;
                    for ( var validatorIndex = 0; validatorIndex < self.validators.length; ++validatorIndex )
                    {
                        if ( !self.validators[ validatorIndex ].call( this, el, event ) )
                        {
                            validated = false;
                            break;
                        }
                    }
                    
                    // eat the event if a validator failed
                    if ( !validated )
                    {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() )
                        {
                            event.isPropagationStopped = t;
                        }

                        el = null;
                        continue;
                    }
                    
                    if ( typeof( self.validate ) == 'function' && !self.validate.call( self, el ) )
                    {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                    
                    if ( el.tagName == 'FORM' )
                    {
                        if ( event.type != 'submit' )
                        {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'INPUT' )
                    {
                        if ( !( el.type == 'submit' || el.type == 'checkbox' || el.type == 'radio' || el.type == 'file' ) && event.type != 'input' )
                        {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'SELECT' )
                    {
                        if ( event.type != 'input' )
                        {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }

                    event.emitTarget = el;
                    self.Emit( el, event, forceAllowDefault );
                    el = closest( el, selector, false, document );
                }
                
                if ( depth >= 100 )
                {
                    console.error( 'Exceeded depth limit for Emit calls.' );
                }
            }
            else
            {
                self.emit( 'unhandled', event );
            }

            self.initialTouchPoint = null;
            
            break;
    }
}

Emit.prototype.Emit = function( element, event, forceDefault ) {
    var self = this;
    var optionString = element.getAttribute( 'data-emit-options' );
    var options = {};
    var ignoreString = element.getAttribute( 'data-emit-ignore' );
    
    if ( ignoreString && ignoreString.length )
    {
        var ignoredEvents = ignoreString.toLowerCase().split( ' ' );
        for ( var i = 0; i < ignoredEvents.length; ++i )
        {
            if ( event.type == ignoredEvents[ i ] )
            {
                return;
            }
        }
    }

    if ( optionString && optionString.length )
    {
        var opts = optionString.toLowerCase().split( ' ' );
        for ( var i = 0; i < opts.length; ++i )
        {
            options[ opts[ i ] ] = true;
        }
    }
    
    if ( !forceDefault && !options.allowdefault )
    {
        event.preventDefault();
    }
    
    if ( !options.allowpropagate )
    {
        event.stopPropagation();
        event.stopImmediatePropagation();
        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() )
        {
            event.isPropagationStopped = t;
        }
    }

    var emission = element.getAttribute( 'data-emit' );
    if ( !emission )
    {
        // allow for empty behaviors that catch events
        return;
    }

    self.emit( emission, event );
}

Emit.prototype.AddValidator = function( validator ) {
    var self = this;
    
    var found = false;
    for ( var i = 0; i < self.validators.length; ++i )
    {
        if ( self.validators[ i ] == validator )
        {
            found = true;
            break;
        }
    }
    
    if ( found )
    {
        return false;
    }
    
    self.validators.push( validator );
    return true;
}

Emit.prototype.RemoveValidator = function( validator ) {
    var self = this;
    
    var found = false;
    for ( var i = 0; i < self.validators.length; ++i )
    {
        if ( self.validators[ i ] == validator )
        {
            self.validators.splice( i, 1 );
            found = true;
            break;
        }
    }
    
    return found;
}