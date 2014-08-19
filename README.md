# Emit

Emit events on DOM element interaction using data-emit attributes.

# Examples

```html
<a data-emit='foo'>Emit 'foo'</a>

<a data-emit='bar'>Emit 'bar'</a>

<div data-emit='baz.wrapper'>
    <a data-emit='baz' data-emit-options="allowpropagate">Emit 'baz' and, due to propagation, 'baz.wrapper'.</a>
</div>

<a data-emit='yak' href="#yak" data-emit-options="allowdefault">Emit 'yak' and allow default navigation to #yak.</a>

<a data-emit='yak,foo,bar' href="#">Emit 'yak', 'foo' and 'bar' events.</a>

<!-- emits 'submitted' on form submit -->
<form data-emit="submitted">

    <!-- emits 'input.changed' on input -->
    <input type="text" data-emit="input.changed" />
    
    <!-- debounce emits, only emitting after 250ms have passed since last input -->
    <input type="text" data-emit="debounced.changed" data-emit-options="debounce" />
    
    <!-- allowdefault will let the checkbox check -->    
    <input type="checkbox" data-emit="checked" data-emit-options="allowdefault">This is a checkbox.</input>
    
    <!-- allowdefault will let the radio button select -->
    <input type="radio" data-emit="selected" data-emit-options="allowdefault">This is a radio button.</input>
    
    <!-- allowdefault will let the form submission event fire -->
    <input type="submit" value="Submit" data-emit="submit.clicked" data-emit-options="allowdefault" />
</form>

<!-- catch click/touch event -->
<div style="border: 1px solid black; padding: 30px; text-align: center;" data-emit="">
    <a data-emit='floog'>Emit 'floog' but clicking elsewhere in this div should *not* produce an 'unhandled' event.</a>
</div>

```

Using [component](http://component.io):

```javascript
var emit = require( 'emit' );

emit.on( 'foo', function( event ) {
    // do something fun, like logging to the console
    console.log( 'got a foo event' );
} );

emit.on( 'input.changed', function( event ) {
    var target = event.emitTarget; // prefer using event.emitTarget to event.currentTarget unless you're sure you know what's up
} );
```

# Install

For [component](http://component.io) do:

```
component install honeinc/emit
```

To include a prebuilt version directly in your page, use built/emit.js or built/emit.min.js:

```
<script type="text/javascript" src="emit.min.js"></script> <!-- injects window.Emit -->

<script>
    Emit.on( 'foo', function( event ) {
        console.log( 'got a foo event' );
    } );
</script>

```

## Why don't you have bower/npm/etc support?

I don't use bower and I don't see how this would be used in node. However, send a tested PR adding support and I
will accept it.

# Why would I need this?

Emit is a simple, small (~10kb minified, ~4kb minified+gzipped) way to bind javascript actions to DOM nodes without
using the more classic selector style favored by jQuery. It allows for better separation of concerns: no longer
are element classes how you find and bind to actions in your UI. Instead, you mark up your DOM with the events
you'd like various elements to emit when they are clicked (or touched, Emit also helps eliminate the 300ms click
delay on mobile devices).

It is similar to Google's [JsAction](https://github.com/google/jsaction), except it is simpler and smaller (but, of
course, less robust).

# Advanced Usage

## Ignoring events

Sometimes you don't want to listen to all the normal events (click, touchend, input, submit):

```html
<a data-emit="foo" data-ignore="click">foo</a> <!- will not emit 'foo' when clicked -->
```
## Validators

You can add/remove 'validators' within Emit that can validate that a given event should fire.

If one of the validators fails on an element, the event will be stopped and eaten at that element.

### Emit.AddValidator

AddValidator will add a validation function to Emit. It takes a single function as an argument.

The validation function will be called back when Emit is handling an event. The function's this
context will be set to Emit and it will received two arguments: the element being processed and
the event:

```javasscript

// add a validator to stop clicks on elements that have the data-busy attribute
Emit.AddValidator( function( element, event ) {
    return !$( element ).data( 'busy' );
} );

```

### Emit.RemoveValidator

RemoveValidator will remove the given validation function from Emit's list of validators. It takes
a single argument: the function to remove.

```javascript
function BusyCheck( element, event ) {
    return !$( element ).data( 'busy' );
}

Emit.AddValidator( BusyCheck );

Emit.RemoveValidator( BusyCheck );
```


```

# License

MIT

# Changelog
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
