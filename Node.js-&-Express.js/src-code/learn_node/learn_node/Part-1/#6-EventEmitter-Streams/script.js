myEmitter.on('event', callback);      // listen every time the event fires
myEmitter.once('event', callback);    // listen only for the FIRST occurrence
myEmitter.off('event', callback);     // remove a specific listener
myEmitter.emit('event', ...args);     // fire the event, passing args to listeners
myEmitter.listenerCount('event');     // how many listeners are registered

import { EventEmitter } from 'events'

const emitter = new EventEmitter();

emitter.on('greet', (name)=> {
    console.log(`Hello, ${name}`)
})

emitter.emit('greet', 'innov')


// If you emit 'error' with NO listener attached, Node throws and crashes the process
emitter.emit('error', new Error('boom')); // uncaught, crashes if no 'error' listener exists

// Always attach an error listener when working with emitters that might emit 'error'
emitter.on('error', (err) => console.error('Handled:', err.message));

class Logger extends EventEmitter {
    log(message) {
      console.log(message);
      this.emit('logged', { message, timestamp: Date.now() });
    }
  }
  
  const logger = new Logger();
  
  logger.on('logged', (details) => {
    console.log('Log event fired at:', details.timestamp);
  });
  

// =========================== S T R E A M S ===========================
import fs from 'node:fs/promises';

// This loads the ENTIRE file into memory before you can use it.
// Fine for a 2KB config file. Catastrophic for a 4GB video.
const data = await fs.readFile('./huge-video.mp4');

// This reads the file in small chunks, using constant memory regardless of file size
const stream = fs.createReadStream('./huge-video.mp4');

stream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes`);
});

stream.on('end', () => {
  console.log('Finished reading');
});

stream.on('error', (err) => {
  console.error('Stream error:', err);
});


const readStream = fs.createReadStream('./huge-video.mp4');
const writeStream = fs.createWriteStream('./huge-video-copy.mp4');

readStream.pipe(writeStream);

writeStream.on('finish', () => {
  console.log('File copied successfully');
});





