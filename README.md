# Emit

Emit events on DOM element interaction using data-emit attributes.

# Install

```
npm install --save honeinc/emit
```

To include a prebuilt version directly in your page, use build/emit-(version).js or build/emit-(version).min.js:

```
<script type="text/javascript" src="emit-1.0.0.min.js"></script>

<script>
var emit = require( 'emit' );

emit.on( 'foo', function( event ) {
    console.log( 'got a foo event' );
} );
</script>

```

# Examples

Check out the [examples/index.html](examples/index.html)

# Why would I need this?

Emit is a simple, small (~12kb minified, ~5kb minified+gzipped) way to bind javascript actions to DOM nodes without
using the more classic selector style favored by jQuery. It allows for better separation of concerns: no longer
are element classes how you find and bind to actions in your UI. Instead, you mark up your DOM with the events
you'd like various elements to emit when they are clicked (or touched, Emit also helps eliminate the 300ms click
delay on mobile devices).

It is similar to Google's [JsAction](https://github.com/google/jsaction), except it is simpler and smaller (but, of
course, less robust).

# Advanced Usage

## Options

### debounce

Will debounce this event, only firing 250ms after the user has stopped interacting with the element. This is
great for text input fields where you don't want to fire after each keystroke, but once the user has paused
in their typing.

```
<input type="text" data-emit="changed" data-emit-options="debounce" />
```

### allowdefault

Allows the default action. By default, emit will prevent the default action. By adding this option, the
default will happen as well. This can be useful for navigation links where you want the browser to
navigate, but you also want to be able to listen for an event.

```
<a href="/foo" data-emit='foo' data-emit-options="allowdefault">Emit 'foo', also navigate to /foo</a>
```

It's also usually necessary on something like a checkbox, where you want the box to be checked when
the user clicks it.

```
<input type="checkbox" data-emit="checked" data-emit-options="allowdefault">Emit 'checked' but also check the checkbox.</input>
```

### allowpropagate

Allows propagation. By default, emit will stop the propagation of an event. Setting this option will
allow the event to continue propagating.

```
<button data-emit="clicked" data-emit-options="allowpropagate">Emit 'clicked' but don't stop event propagation.</button>
```

## Ignoring events

Sometimes you don't want to listen to all the normal events (click, touchend, input, submit):

```html
<a data-emit="foo" data-emit-ignore="click">foo</a> <!- will not emit 'foo' when clicked -->
```
## Validators

You can add/remove 'validators' within Emit that can validate that a given event should fire.

If one of the validators fails on an element, the event will be stopped and eaten at that element.

### Emit.addValidator

addValidator will add a validation function to Emit. It takes a single function as an argument.

The validation function will be called back when Emit is handling an event. The function's this
context will be set to Emit and it will received two arguments: the element being processed and
the event:

```javasscript

// add a validator to stop clicks on elements that have the data-busy attribute
emit.addValidator( function( element, event ) {
    return !$( element ).data( 'busy' );
} );

```

### Emit.removeValidator

removeValidator will remove the given validation function from Emit's list of validators. It takes
a single argument: the function to remove.

```javascript
function busyCheck( element, event ) {
    return !$( element ).data( 'busy' );
}

Emit.addValidator( busyCheck );

Emit.removeValidator( busyCheck );
```

# License

MIT

# Changelog
1.0.0
------
* Switch to browserify.

0.0.11
------
* Allow inputs on A tags through unless the A tag has a data-emit attribute

0.0.10
------
* Add a 'debounce' option

0.0.9
-----
* Fix scrolling triggering events
* jshint/beautify

0.0.8
-----
* Allow for emitting multiple comma-separated events

0.0.7
-----
* Add ability to add/remove validators

0.0.6
-----
* Allow clicks on file inputs
* Fix an issue with isPropagationStopped
* Fix an issue with preventing defaults on bubbled events
* Fix an issue with checkbox/radio and prevent default

0.0.5
-----
* Add event.emitTarget instead of possibly read-only currentTarget

0.0.4
-----
* Add select element handling

0.0.3
-----
* Add data-emit-ignore support
* Fix submit/input handling to only emit on appropriate events

0.0.2
-----
* Make sure events have a currentTarget that points to the current element

0.0.1
-----
* Initial release
