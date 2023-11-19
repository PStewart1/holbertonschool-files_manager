// contains the controller for our app; i.e., what happens on the routes

import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(request, response) {
    const redisConnected = redisClient.isAlive();
    const dbConeccted = dbClient.isAlive();
    return response.status(200).send({ redis: redisConnected, db: dbConeccted });
  }

  static async getStats(req, res) {
    const userCount = await dbClient.nbUsers();
    const fileCount = await dbClient.nbFiles();
    return res.status(200).json({ users: userCount, files: fileCount });
  }
}

export default AppController;
