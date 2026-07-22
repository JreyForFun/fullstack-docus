normal node js -> one main js thread

cluster module ->
    by starting multiple node js worker process

    each and every worker process ->
    itws own node js runtine
    its own v8 engine
    its own event loop
    its own main thread
    its own memory