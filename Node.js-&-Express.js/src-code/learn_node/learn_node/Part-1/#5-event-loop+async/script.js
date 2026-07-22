import fs from 'fs/promises'

console.log('1: sync start');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve().then(() => console.log('3: promise'));

process.nextTick(() => console.log('4: nextTick'));

console.log('5: sync end');

// Output order:
// 1: sync start
// 5: sync end
// 4: nextTick      <- microtask, highest priority, runs before Promises
// 3: promise       <- microtask, runs before next event loop phase
// 2: setTimeout     <- macrotask, waits for the Timers phase

async function readAllThree(){
    try {
        const itemA = await fs.readFile('./a.txt', 'utf-8')
        const itemB = await fs.readFile('./b.txt', 'utf-8')
        const itemC = await fs.readFile('./c.txt', 'utf-8')
        console.log(itemA, itemB, itemC)
    } catch(err){
        console.log(err)
    }
}

// RUNNING THINGS IN PARALLEL

// FAST — all three start at once, we wait for all to finish
const [dataA, dataB, dataC] = await Promise.all([
    fs.readFile('./a.txt', 'utf-8'),
    fs.readFile('./b.txt', 'utf-8'),
    fs.readFile('./c.txt', 'utf-8'),
  ]);   




