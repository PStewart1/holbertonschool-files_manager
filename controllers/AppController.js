import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(request, response) {
    const redisConnected = redisClient.isAlive();
    const dbConeccted = dbClient.isAlive();
    return response.status(200).send({redis: redisConnected, db: dbConeccted})    
  }

  // static getStats(request, response) {

  // }
}

export default AppController;
