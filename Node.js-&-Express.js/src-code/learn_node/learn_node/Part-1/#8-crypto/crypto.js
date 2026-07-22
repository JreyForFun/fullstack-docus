import crypto from 'crypto';

const randomId = crypto.randomUUID();
const randomInt = crypto.randomInt(1, 100);

console.log(randomId, randomInt);
const resetToken = crypto.randomBytes(16).toString('hex');
console.log(resetToken);

// crypto.createHash()

const text = "Hello Ging"
const hashed = crypto.createHash('sha256').update(text).digest('hex')
console.log('hashed', hashed);

// webhook 
// signed tokens

const secret = "my-super"
const message = "user_id=1"

const signature = crypto.createHmac('sha256', secret).update(message).digest('hex')
console.log('signature', signature)

console.log(
 'is hash and signature the same:',  message === signature
)