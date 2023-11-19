// here we make our connection to Mongo

const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    let host = 'localhost';
    if (process.env.DB_HOST) {
      host = process.env.DB_HOST;
    }
    let port = 27017;
    if (process.env.DB_PORT) {
      port = process.env.DB_PORT;
    }
    let database = 'files_manager';
    if (process.env.DB_DATABASE) {
      database = process.env.DB_DATABASE;
    }
    const url = `mongodb://${host}:${port}/${database}`;
    this.client = new MongoClient(url);
    this.client.connect().then(
      () => {
        this.db = this.client.db(database);
      },
    ).catch((err) => console.error('Mongo DB connection failed:', err));
  }

  isAlive() {
    const aliveness = !!this.client && !!this.db;
    return aliveness;
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
