// user registered
// send a welcome email
// write a log 
// notify some other service

// emit one event -> listeners listen to this event, do something 

// .on( - register on listener)
// .once() - register one listener that tuns only one time
// .emit() - triggers an event and sends to the listeners
import EventEmitter from "node:events"

const appEvents = new EventEmitter()

const userRegisterPayload = {
    id: typeof(number),
    email: typeof(string)
}

appEvents.on('sser:registered', (user) => {
    console.log(`email listener: welcome email sent to this use ${user}`)
});

appEvents.on("user:registered", (user)=> {
    console.log(`log listener: user ${user.id} and email is ${user.email}`)
})

appEvents.once("app.started", () => {
    console.log("once listener: app started ")
})

function registerUser(){
    const user = {
        id: 1,
        email: "sangan@getMaxListeners.com"
    }

    console.log("user saved");

    appEvents.emit("user:registered", user)

    console.log('register user: event listerns completed')
}

appEvents.emit("app.started")

registerUser()
