const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    let host = 'localhost';
    if (process.env.DB_HOST !== undefined) {
      host = process.env.DB_HOST;
    }
    let port = 27017;
    if (process.env.DB_PORT !== undefined) {
      port = process.env.DB_PORT;
    }
    let database = 'files_manager';
    if (process.env.DB_DATABASE !== undefined) {
      database = process.env.DB_DATABASE;
    }
    const connection_string = `mongodb://${host}:${port}/${database}`
    this.client = new MongoClient(connection_string);
    this.client.connect();
    this.db = this.client.db(database);
  }

  isAlive() {
    
  }
}
