import dbClient from '../utils/db';
var crypto = require('crypto')
var hash = crypto.createHash('sha1')

class UsersController {
  static async postNew(req, res) {
    if (!req.body.email) {
      return res.status(400).send('Missing email')
    }
    if (!req.body.password) {
      return res.status(400).send('Missing password')
    }
    const users = dbClient.db.collection('users');
    if (users.findOne({email: req.body.email})) {
      return res.status(400).send('Already exist')
    }
    const hashedPw = hash.update(req.body.password).digest('hex');
    const newUser = {
      email: req.body.email,
      password: hashedPw,
    }

    const result = await users.insertOne(newUser);
    res.status(201).json({ id: result.insertedId, email: result.email})
  } 
}

export default UsersController;
