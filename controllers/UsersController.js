// adds a user to the db
import ObjectId from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');

class UsersController {
  static async postNew(req, res) {
    // reject if missing email
    if (!req.body.email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    // reject if missing pw
    if (!req.body.password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    // check if user with given email already exists in db
    const users = dbClient.db.collection('users');
    const emailExists = await users.findOne({ email: req.body.email });
    if (emailExists) {
      return res.status(400).json({ error: 'Already exist' });
    }
    // hash password
    const hashedPw = sha1(req.body.password);
    // create new user
    const newUser = {
      email: req.body.email,
      password: hashedPw,
    };
    // insert new user into db
    const result = await users.insertOne(newUser);
    return res.status(201).json({ id: result.insertedId, email: newUser.email });
  }

  static async getMe(req, res) {
    // we look for the token in the header X-Token, where each authenticated API endpoint of ours
    // looks for the authorization token
    const tokenFromX = req.headers['x-token'];
    if (!tokenFromX) {
      // tell them, if they don't have it, they can't even log out, nice try
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // let's do a check and see if it's actually in our redis store
    const tokenInRedis = await redisClient.get(`auth_${tokenFromX}`);
    if (!tokenInRedis) {
      // tell them, forget it, we don't even know who you are
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      // now we proceed confidently to query the monogodb database
      // first we turn the id string from redis into a proper ObjectId à la MongoDb
      const currentUserObjectId = new ObjectId(tokenInRedis);
      const userFound = await dbClient.db.collection('users').findOne({ _id: currentUserObjectId });
      if (!userFound) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.status(200).json({ email: userFound.email, id: userFound._id });
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

export default UsersController;
