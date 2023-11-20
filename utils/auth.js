import redisClient from './redis';
import dbClient from './db';

const { ObjectId } = require('mongodb');

async function authenticate(req) {
  // we look for the token in the header X-Token, where each authenticated API endpoint of ours
  // looks for the authorization token
  const tokenFromX = req.headers['x-token'];
  if (!tokenFromX) {
    // tell them, if they don't have it, they can't even log out, nice try
    throw new Error('Unauthorized');
  }
  // let's do a check and see if it's actually in our redis store
  const tokenInRedis = await redisClient.get(`auth_${tokenFromX}`);
  if (!tokenInRedis) {
    // tell them, forget it, we don't even know who you are
    throw new Error('Unauthorized');
  }
  // now we proceed confidently to query the monogodb database
  // first we turn the id string from redis into a proper ObjectId à la MongoDb
  const currentUserObjectId = new ObjectId(tokenInRedis);
  const userFound = await dbClient.db.collection('users').findOne({ _id: currentUserObjectId });
  if (!userFound) {
    throw new Error('Unauthorized');
  }
  return userFound;
}

export default authenticate;
