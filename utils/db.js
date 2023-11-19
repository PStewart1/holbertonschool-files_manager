const { MongoClient } = require('mongodb');

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const database = process.env.DB_DATABASE;

class DBClient {
  constructor(host = 'localhost', port = 27017, database = 'files_manager') {
    const url = `mongodb://${host}:${port}/${database}`;
    this.client = new MongoClient(url);
    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const db = this.client.db();
    const users = db.collection('users');
    const numUsers = await users.countDocuments();
    return numUsers;
  }

  async nbFiles() {
    const db = this.client.db();
    const files = db.collection('files');
    const numFiles = await files.countDocuments();
    return numFiles;
  }
}

const dbClient = new DBClient();
export default dbClient;
