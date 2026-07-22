// piece by piece
// not loading the data everything at once
// read large files
// updload files
// downloading files
// video/audio processing
// compression

// CHUNKS

// here is my full 500mb file
// here is chunk 1 t 5

//memory efficient
// stream types
// readable streams -> source of data
// writable stream -> destination
// transform stream -> read the data, changi it and pass that forward
import { Readable } from "node:stream"
import { pipeline } from "node:stream";

const readableStream = Readable.from([
    "hello ",
    "from ",
    "node.js",
    "streams"
]);

const upperCaseTransfar = new Transform({
    transform(chunk, encoding, callback){
        const text = chunk.toString();

        callback(null, text.toUpperCase())
    }
})

const writableString = new Writable({
    write(chunk, encoding, callback){
        console.log('Received chunk', chunk.toString())

        callback()
    }
})

async function main(){
    try {
        await pipeline(readableStream, upperCaseTransfar, writableString)
        console.log("Stream completed")
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        console.log("stream failed:", mg)
    }
}

main()