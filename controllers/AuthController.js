// contains the auth controller; i.e., logs people in

import redisClient from '../utils/redis';
import dbClient from '../utils/db';
const sha1 = require('sha1');
const { uuidv4 } = require('uuid');

class AuthController {
  static async getConnect(req, res) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
        // c'mon, you gotta be authorized
        return res.status(401).json({error: 'Unauthorized'});
    }
    // first we parse the header, b/c the string looks like "Basic [credentials]" where
    // [credentials] is encoded in Base64 in the format email:pass
    const encodedAuth = authorizationHeader.split(' ')[1];
    // next we'll decode it into a buffer, which is a class node provides for binary data,
    // and decode that into a string and split it to get the email and the password separately
    const [email, password] = Buffer.from(encodedAuth, 'base64').toString().split(':');
    // then we'll encode it again (because we are incorrigible) because our db stores passwords
    // with an sha1-encoded hash.
    const youSha11NotPass = sha1(password);
    // now we can check the database:
    try {
        // we use the dbClient to find the user
        const foundUser = await dbClient.db.collection('users').findOne({ email, password: youSha11NotPass});
        // we tell them to hit the road if they are not found in the db
        if (!foundUser) {
            return res.status(401).json({error: 'Unauthorized'});
        }
        // if we find them, then we make a random token using uuidv4
        const token = uuidv4();
        // then we make a new key to store in redis with the auth token
        const newKey = `auth_${token}`;
        // we prepare to tell it to expire in a day
        const dayLength = 24 * 60 * 60;
        // and we set the value in redis
        await redisClient.set(newKey, foundUser._id.toString(), dayLength);
        // and return the token with a status code of 200
        return res.status(200).json({ token });
    } catch (error) {
        // sometimes things don't work out like you hoped, though
        return res.status(500).json({ error: error.message });
    }
  }

  static async getDisconnect(req, res) {
    // we look for the token in the header X-Token, where each authenticated API endpoint of ours
    // looks for the authorization token
    const tokenFromX = req.headers['x-token'];
    if (!tokenFromX) {
        // tell them, if they don't have it, they can't even log out, nice try
        return res.status(401).json({error: 'Unauthorized'});
    }
    // let's do a check and see if it's actually in our redis store
    const tokenIsInRedis = await redisClient.get(`auth_${tokenFromX}`) != null;
    if (!tokenIsInRedis) {
        // tell them, forget it, we don't even know who you are
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // with those checks done, we know it's here, so let's delete it!
    await redisClient.del(`auth_${tokenFromX}`);
    // and send a response with no message, just a status code of 204
    return res.status(204).end();
  }
}

export default AuthController;
