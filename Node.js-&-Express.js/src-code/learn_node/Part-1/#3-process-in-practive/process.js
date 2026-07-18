console.log(process.argv[1]);       // command-line arguments
console.log(process.env.NODE_ENV); // environment variable (e.g. "development")
console.log(process.platform);   // 'darwin', 'win32', 'linux', etc.           

// C:\Users\ADMIN\learn_node\Part-1\process-in-practive\process.js
//process.js:1
// undefined    arvs
// process.js:2     env
// win32    platform

const name = process.argv[2]; // process.argv[0]=node path, [1]=script path, [2]=first real argument

if (!name) {
  console.error('Usage: node greet.js <name>');
  process.exit(1);
}

console.log(`Hello, ${name}`);

//  The Last Line of Defense: uncaughtException and unhandledRejection
// handles SIGTERM/SIGINT

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Node's own docs are explicit on this: the process is now in an UNKNOWN state.
    // The only safe response is to log it and exit — never try to "recover" and keep serving requests.
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    process.exit(1);
  });

  

process.exit(0)