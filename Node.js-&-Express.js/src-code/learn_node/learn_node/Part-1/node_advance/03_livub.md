## libuv native library used by node

help node js to handle async operations across diff os system

event loop
worker thread pool
timers
async i/o operations

v8 does not prive
js operations
network socket handling
timers
general
event loop for node js apis

node js need something else ???
node js needs a another layer to coordinate this runtime features

event loop ->
complete i/o operations
timers -> if some timers are in ready state
pending callbacks
socket activity

thread pool
libuv provides a shared worker

this pool is used by only those operations that can not be handled efficiently

many file system operations
cryptographic ope
compression related work

timers ->
libuv helps node js track those timers and imp -> determine when the timer is become eligible to execute
timer -> 5 sec delay -> does not mean the JS sleeps on the main thread
runtime record the timer and continue processing other task