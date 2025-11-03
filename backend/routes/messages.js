const mongoose = require('mongoose')

const GUESTBOOK_DB_ADDR = process.env.GUESTBOOK_DB_ADDR; 
const mongoURI = GUESTBOOK_DB_ADDR
  ? `mongodb://${GUESTBOOK_DB_ADDR}/guestbook`
  : process.env.MONGO_URI || 'mongodb://localhost:27017/guestbook';

const db = mongoose.connection;

db.on('disconnected', () => {
    console.error(`Disconnected: unable to reconnect to ${mongoURI}`)
    throw new Error(`Disconnected: unable to reconnect to ${mongoURI}`) 
})
db.on('error', (err) => {
    console.error(`Unable to connect to ${mongoURI}: ${err}`);
});

db.once('open', () => {
  console.log(`connected to ${mongoURI}`);
});

const connectToMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 2000
  });

  return mongoose.connection;
};

const messageSchema = mongoose.Schema({
    name: { type: String, required: [true, 'Name is required'] },
    body: { type: String, required: [true, 'Message Body is required'] },
    date: { type: Date },
    timestamps: {}
});

const messageModel = mongoose.model('Message', messageSchema);

const construct = (params) => {
    const name = params.name
    const body = params.body
    const date = params.date
    const message = new messageModel({ name: name, body: body, date: date })
    return message
};

const save = (message) => {
    console.log("saving message...")
    message.save((err) => {
        if (err) { throw err }
    })
};

// Constructs and saves message
const create = (params) => {
    try {
        const msg = construct(params)
        const validationError = msg.validateSync()
        if (validationError) { throw validationError }
        save(msg)
    } catch (error) {
        throw error
    }
}

module.exports = {
    create: create,
    messageModel: messageModel,
    connectToMongoDB: connectToMongoDB
}

