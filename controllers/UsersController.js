// adds a user to the db
import dbClient from '../utils/db';

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
}

export default UsersController;
